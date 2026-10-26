import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import GanttTaskGrid from "features/task-list/components/GanttTaskGrid";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { TaskTransformed } from "shared/task";

type GridProps = Parameters<typeof GanttTaskGrid>[0];
type El = ReactElement<Record<string, unknown>>;

const isEl = (node: unknown): node is El =>
  typeof node === "object" && node !== null && "props" in node;

// Root-first chain of elements down to the first one `match` accepts
function pathTo(
  node: unknown,
  match: (el: El) => boolean,
  trail: El[] = []
): El[] | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = pathTo(child, match, trail);
      if (found) return found;
    }
    return null;
  }
  if (!isEl(node)) return null;
  const here = [...trail, node];
  return match(node) ? here : pathTo(node.props.children, match, here);
}

// React's bubble phase: target first, then up, until stopPropagation()
function dispatch(path: El[], handler: "onClick" | "onDoubleClick") {
  let stopped = false;
  const event = {
    stopPropagation: () => {
      stopped = true;
    },
  };
  for (const el of [...path].reverse()) {
    const fn = el.props[handler];
    if (typeof fn === "function") fn(event);
    if (stopped) return;
  }
}

const byClass = (name: string) => (el: El) =>
  String(el.props.className).split(" ").includes(name);

function renderGrid(overrides: Partial<GridProps> = {}) {
  const parent = {
    id: "p",
    name: "Phase 1",
    isSummary: true,
    sequence: "1",
  } as unknown as TaskTransformed;
  const child = {
    id: "c",
    name: "Build",
    parentId: "p",
    sequence: "1.1",
  } as unknown as TaskTransformed;
  const props: GridProps = {
    rows: [
      { id: "p", depth: 0, tasks: [parent] },
      { id: "c", depth: 1, tasks: [child] },
    ],
    virtualItems: [
      { index: 0, start: 0, size: 38 },
      { index: 1, start: 38, size: 38 },
    ],
    totalHeight: 76,
    width: 240,
    showRowNumbers: false,
    hierarchy: true,
    collapsedIds: new Set<string>(),
    onToggleCollapse: vi.fn(),
    reorderEnabled: false,
    interaction: {},
    move: { validate: () => null, apply: vi.fn() },
    onRowClick: vi.fn(),
    onRowDoubleClick: vi.fn(),
    ...overrides,
  };

  let tree: unknown = null;
  // Real hooks and store; the grid's element tree is kept to walk its handlers
  function Capture({ onRender }: { onRender: (grid: ReactElement) => void }) {
    const grid = GanttTaskGrid(props);
    onRender(grid);
    return grid;
  }
  renderToStaticMarkup(
    createElement(
      GanttStoreContext.Provider,
      { value: createGanttStore() },
      createElement(Capture, { onRender: (grid) => (tree = grid) })
    )
  );

  const find = (match: (el: El) => boolean) => pathTo(tree, match)!;
  const pick = (match: (el: El) => boolean) => find(match).slice(-1)[0];
  return { props, parent, find, pick };
}

describe("collapse chevron", () => {
  it("lets a double click on the row's name reach onRowDoubleClick", () => {
    const { props, parent, find } = renderGrid();
    const name = find(byClass("gantt-grid-cell-text"));

    dispatch(name, "onClick");
    dispatch(name, "onClick");
    dispatch(name, "onDoubleClick");

    expect(props.onRowClick).toHaveBeenCalledTimes(2);
    expect(props.onRowDoubleClick).toHaveBeenCalledTimes(1);
    expect(vi.mocked(props.onRowDoubleClick!).mock.calls[0][0]).toBe(parent);
  });

  it("keeps a double click on itself away from the row", () => {
    const { props, find } = renderGrid();
    const chevron = find(byClass("gantt-grid-expander"));

    dispatch(chevron, "onClick");
    dispatch(chevron, "onClick");
    dispatch(chevron, "onDoubleClick");

    expect(props.onToggleCollapse).toHaveBeenCalledTimes(2);
    expect(props.onRowClick).not.toHaveBeenCalled();
    expect(props.onRowDoubleClick).not.toHaveBeenCalled();
  });
});

describe("row click after a reorder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires no onRowClick for the click that closes the drag", () => {
    const { props, find, pick } = renderGrid({
      reorderEnabled: true,
      interaction: { allowReorder: true },
    });
    // A server render attaches no refs, so the body's geometry is set by hand
    const body = pick(byClass("gantt-grid-body"));
    (body.props.ref as { current: unknown }).current = {
      closest: () => null,
      getBoundingClientRect: () => ({ top: 0 }),
    };
    const doc = Object.assign(new EventTarget(), {
      body: { style: { cursor: "" } },
    });
    vi.stubGlobal("document", doc);
    const pointer = (type: string, clientY: number) =>
      doc.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, clientY }));

    const grip = find(byClass("gantt-grid-grip"));
    const press = pick(byClass("gantt-grid-grip")).props.onPointerDown;
    (press as (event: object) => void)({
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 5,
      clientY: 19,
      stopPropagation: () => {},
      currentTarget: { setPointerCapture() {}, releasePointerCapture() {} },
    });
    pointer("pointermove", 74);
    pointer("pointerup", 74);
    dispatch(grip, "onClick");

    expect(props.move.apply).toHaveBeenCalledTimes(1);
    expect(props.onRowClick).not.toHaveBeenCalled();
  });
});

describe("icon-only buttons", () => {
  const label = (grid: ReturnType<typeof renderGrid>, name: string) =>
    grid.pick(byClass(name)).props["aria-label"];

  it("name the action they perform", () => {
    const grid = renderGrid({
      reorderEnabled: true,
      interaction: { allowReorder: true },
    });

    expect(label(grid, "gantt-grid-grip")).toBe("Drag to reorder");
    expect(label(grid, "gantt-grid-expander")).toBe("Collapse");
  });

  it("offer to expand a collapsed row", () => {
    const grid = renderGrid({ collapsedIds: new Set(["p"]) });

    expect(label(grid, "gantt-grid-expander")).toBe("Expand");
  });
});
