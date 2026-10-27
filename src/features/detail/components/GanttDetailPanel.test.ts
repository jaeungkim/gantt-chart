import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskTransformed } from "shared/task";
import GanttDetailPanel from "./GanttDetailPanel";

const hooks = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void)[],
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const slot = <T>(init: () => T): T => {
    const k = hooks.cursor++;
    if (!(k in hooks.slots)) hooks.slots[k] = init();
    return hooks.slots[k] as T;
  };
  const effect = (create: () => void | (() => void), deps?: unknown[]) => {
    const cell = slot(
      () => ({}) as { deps?: unknown[]; cleanup?: void | (() => void) }
    );
    const same = deps?.every((dep, k) => Object.is(dep, cell.deps?.[k]));
    if (cell.deps && same) return;
    hooks.effects.push(() => {
      cell.cleanup?.();
      cell.deps = deps;
      cell.cleanup = create();
    });
  };
  return {
    ...actual,
    useContext: () => ({}),
    useState: <T>(initial: T) => [initial, () => {}],
    useRef: <T>(current: T) => slot(() => ({ current })),
    useCallback: <T>(fn: T) => fn,
    useEffect: effect,
    useLayoutEffect: effect,
  };
});

type HostElement = { type: unknown; props: Record<string, unknown> };
type Handler = (event: unknown) => void;

function hostElements(node: unknown, out: HostElement[] = []): HostElement[] {
  if (Array.isArray(node)) node.forEach((child) => hostElements(child, out));
  else if (typeof node === "object" && node !== null && "props" in node) {
    const { type, props } = node as HostElement;
    if (typeof type === "function") hostElements(type(props), out);
    else {
      if (typeof type === "string") out.push(node as HostElement);
      hostElements(props.children, out);
    }
  }
  return out;
}

const task = {
  id: "build",
  name: "Build",
  parentId: null,
  sequence: "1",
  startDate: "2026-09-08T00:00:00.000Z",
  endDate: "2026-09-18T00:00:00.000Z",
  progress: 40,
} as TaskTransformed;

type Props = Parameters<typeof GanttDetailPanel>[0];

function render(props: Partial<Props>): HostElement[] {
  hooks.cursor = 0;
  hooks.effects = [];
  const elements = hostElements(
    GanttDetailPanel({
      task,
      tasks: [task],
      scale: "day",
      tooltip: (date) => date.format("YYYY-MM-DD"),
      onClose: () => {},
      open: true,
      ...props,
    })
  );
  hooks.effects.forEach((run) => run());
  return elements;
}

function stubDocument() {
  let listeners: ((event: Event) => void)[] = [];
  const doc = {
    addEventListener: (_: string, fn: (event: Event) => void) => {
      listeners = [...listeners, fn];
    },
    removeEventListener: (_: string, fn: (event: Event) => void) => {
      listeners = listeners.filter((entry) => entry !== fn);
    },
    dispatchEvent: (event: Event) => {
      for (const fn of listeners) if (listeners.includes(fn)) fn(event);
    },
  };
  vi.stubGlobal("document", doc);
  return doc;
}

const keydown = (key: string) =>
  Object.assign(new Event("keydown", { cancelable: true }), { key });

function documentRoot(doc: ReturnType<typeof stubDocument>) {
  const root = { focused: undefined as HostElement | undefined };
  doc.addEventListener("keydown", (event) => {
    const onKeyDown = root.focused?.props.onKeyDown as Handler | undefined;
    onKeyDown?.({
      key: (event as KeyboardEvent).key,
      nativeEvent: event,
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    });
  });
  return root;
}

afterEach(() => {
  hooks.slots = [];
  vi.unstubAllGlobals();
});

describe("Escape", () => {
  it("closes the panel when no field has focus", () => {
    const doc = stubDocument();
    documentRoot(doc);
    const onClose = vi.fn();
    render({ onClose });

    doc.dispatchEvent(keydown("Escape"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes the panel when a host listener re-renders the chart mid-dispatch", () => {
    const doc = stubDocument();
    const onClose = vi.fn();
    doc.addEventListener("keydown", () => render({ onClose: () => onClose() }));
    render({ onClose: () => onClose() });

    doc.dispatchEvent(keydown("Escape"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each(["text", "date", "range"])(
    "in a %s field leaves the panel open, with React's root on the document",
    (type) => {
      const doc = stubDocument();
      const root = documentRoot(doc);
      const onClose = vi.fn();
      const fields = render({ onClose }).filter(
        (element) => element.type === "input" && element.props.type === type
      );
      expect(fields.length).toBeGreaterThan(0);

      for (const field of fields) {
        root.focused = field;
        doc.dispatchEvent(keydown("Escape"));
      }

      expect(onClose).not.toHaveBeenCalled();
    }
  );
});

describe("Enter in a field", () => {
  it("cancels the implicit submission of a host form around the chart", () => {
    stubDocument();
    const fields = render({}).filter(
      (element) => element.type === "input" && element.props.type !== "range"
    );
    expect(fields).toHaveLength(3);

    for (const field of fields) {
      const event = { key: "Enter", preventDefault: vi.fn(), stopPropagation: vi.fn() };
      (field.props.onKeyDown as Handler)(event);
      expect(event.preventDefault).toHaveBeenCalled();
    }
  });
});

describe("accessible names", () => {
  it("names the icon-only close button and the task name input", () => {
    stubDocument();
    const elements = render({});
    const label = (type: string, className: string) =>
      elements.find(
        (element) => element.type === type && element.props.className === className
      )?.props["aria-label"];

    expect({
      close: label("button", "gantt-detail-close"),
      name: label("input", "gantt-detail-title"),
    }).toEqual({ close: "Close", name: "Task name" });
  });
});
