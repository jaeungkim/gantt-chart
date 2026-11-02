// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Gantt from "Gantt";
import type { Task } from "core/types";
import { click, dispatch, keydown, render } from "shared/testing/dom";

type GanttProps = ComponentProps<typeof Gantt>;

const tasks: Task[] = [
  {
    id: "build",
    name: "Build",
    parentId: null,
    sequence: "1",
    startDate: "2026-09-08T00:00:00.000Z",
    endDate: "2026-09-18T00:00:00.000Z",
    progress: 40,
    dependencies: [{ targetId: "design", type: "FS" }],
  },
  {
    id: "design",
    name: "Design",
    parentId: null,
    sequence: "2",
    startDate: "2026-09-01T00:00:00.000Z",
    endDate: "2026-09-07T00:00:00.000Z",
  },
];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const settle = () => act(async () => vi.advanceTimersByTime(1000));

const chartProps = (props: Partial<GanttProps>): GanttProps => ({
  tasks,
  showDetail: true,
  ...props,
});

async function openPanel(props: Partial<GanttProps> = {}) {
  const onDetailChange = vi.fn();
  const onTasksChange = vi.fn();
  const { host } = await render(
    createElement(Gantt, chartProps({ onDetailChange, onTasksChange, ...props }))
  );
  await click(host.querySelector('.gantt-task-bar[data-task-id="build"]')!);
  await settle();
  const closes = () => onDetailChange.mock.calls.filter(([task]) => task === null).length;
  return { host, onDetailChange, onTasksChange, closes };
}

const panel = (host: Element) => host.querySelector("aside.gantt-detail");

async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function skipKeydownListenersRemovedMidDispatch() {
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  const live = new Map<EventListenerOrEventListenerObject, EventListener>();
  vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
    if (type !== "keydown" || !listener) return add(type, listener, options);
    const guarded: EventListener = (event) => {
      if (live.get(listener) !== guarded) return;
      if (typeof listener === "function") listener(event);
      else listener.handleEvent(event);
    };
    live.set(listener, guarded);
    add(type, guarded, options);
  });
  vi.spyOn(document, "removeEventListener").mockImplementation((type, listener, options) => {
    if (type !== "keydown" || !listener) return remove(type, listener, options);
    remove(type, live.get(listener) ?? listener, options);
    live.delete(listener);
  });
}

describe("Escape in a field", () => {
  it("in a text, date or range field leaves the panel open, with React's root on the document", async () => {
    const onDetailChange = vi.fn();
    const root = createRoot(document as unknown as Element);
    try {
      await act(async () => root.render(createElement(Gantt, chartProps({ onDetailChange }))));
      await click(document.querySelector('.gantt-task-bar[data-task-id="build"]')!);
      await settle();
      const aside = document.querySelector("aside")!;
      const fields = ["text", "date", "range"].map((inputType) => [
        ...aside.querySelectorAll<HTMLInputElement>(`input[type="${inputType}"]`),
      ]);
      expect(fields.map((group) => group.length > 0)).toEqual([true, true, true]);

      for (const field of fields.flat()) await keydown("Escape", field, { cancelable: true });

      expect(onDetailChange.mock.calls.map(([task]) => task?.id ?? null)).toEqual(["build"]);
    } finally {
      await act(async () => root.unmount());
    }
  });
});

describe("opening", () => {
  it("opens on a bar click, showing the task and what it depends on", async () => {
    const { host } = await openPanel();

    expect({
      open: panel(host)?.classList.contains("gantt-detail-open"),
      name: host.querySelector<HTMLInputElement>('input[aria-label="Task name"]')?.value,
      dependsOn: host.querySelector(".gantt-detail-deps")?.textContent,
    }).toEqual({ open: true, name: "Build", dependsOn: "FSDesign" });
  });
});

describe("Escape", () => {
  it("closes the panel when no field has focus", async () => {
    const { host, closes } = await openPanel();

    await keydown("Escape");
    await settle();

    expect({ closes: closes(), panel: panel(host) }).toEqual({ closes: 1, panel: null });
  });

  it("still closes the panel when a host listener re-renders the chart mid-dispatch", async () => {
    const closes: unknown[] = [];
    const element = () =>
      createElement(
        Gantt,
        chartProps({ onDetailChange: (task) => void (task === null && closes.push(task)) })
      );
    skipKeydownListenersRemovedMidDispatch();
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    const rerenderMidDispatch = () => flushSync(() => root.render(element()));
    document.addEventListener("keydown", rerenderMidDispatch);
    try {
      await act(async () => root.render(element()));
      await click(host.querySelector('.gantt-task-bar[data-task-id="build"]')!);
      await settle();

      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

      expect(closes).toHaveLength(1);
    } finally {
      Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
      document.removeEventListener("keydown", rerenderMidDispatch);
      await act(async () => root.unmount());
      vi.restoreAllMocks();
    }
  });

});

describe("closing", () => {
  it("closes on the Close button", async () => {
    const { host, closes } = await openPanel();

    await click(host.querySelector('button[aria-label="Close"]')!);
    await settle();

    expect({ closes: closes(), panel: panel(host) }).toEqual({ closes: 1, panel: null });
  });
});

describe("Enter in a field", () => {
  it("cancels the implicit submission of a host form around the chart", async () => {
    const { host } = await openPanel();
    const fields = [
      ...host.querySelectorAll<HTMLInputElement>('aside input:not([type="range"])'),
    ];
    expect(fields).toHaveLength(3);

    for (const field of fields) {
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      await dispatch(field, event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});

describe("editing", () => {
  it("sends a renamed task to onTasksChange when the name field loses focus", async () => {
    const { host, onTasksChange } = await openPanel();
    const name = host.querySelector<HTMLInputElement>('input[aria-label="Task name"]')!;

    await type(name, "Ship");
    await dispatch(name, new FocusEvent("focusout", { bubbles: true }));

    expect(onTasksChange.mock.lastCall?.[0].map((task: Task) => task.name)).toEqual([
      "Ship",
      "Design",
    ]);
  });

  it("shows the fields as text with no inputs while the chart is read-only", async () => {
    const { host } = await openPanel({ readOnly: true });

    expect({
      inputs: panel(host)?.querySelectorAll("input").length,
      title: panel(host)?.querySelector("h2.gantt-detail-title")?.textContent,
    }).toEqual({ inputs: 0, title: "Build" });
  });
});

describe("accessible names", () => {
  it("names the icon-only close button and the task name input", async () => {
    const { host } = await openPanel();

    expect({
      close: host.querySelector("button.gantt-detail-close")?.getAttribute("aria-label"),
      name: host.querySelector("input.gantt-detail-title")?.getAttribute("aria-label"),
    }).toEqual({ close: "Close", name: "Task name" });
  });
});
