import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HEADER_HEIGHT, resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { Task, TaskTransformed } from "shared/task";
import { isOverVisibleContent, useGanttLinkDrag } from "./useGanttLinkDrag";

describe("isOverVisibleContent", () => {
  const edges = { left: 220, right: 1100, top: 100, bottom: 700 };
  const over = (x: number, y: number) => isOverVisibleContent(x, y, edges);
  const headerBottom = edges.top + HEADER_HEIGHT;

  it("leaves out the date header, though rows scroll under it", () => {
    expect(over(600, edges.top + 63)).toBe(false);
    expect(over(600, headerBottom - 1)).toBe(false);
    expect(over(600, headerBottom)).toBe(true);
  });

  it("leaves out the task list, though bars scroll under it", () => {
    expect(over(100, 400)).toBe(false);
    expect(over(edges.left - 1, 400)).toBe(false);
    expect(over(edges.left, 400)).toBe(true);
  });

  it("leaves out everything past the scroll container's far edges", () => {
    expect(over(edges.right, 400)).toBe(false);
    expect(over(600, edges.bottom)).toBe(false);
    expect(over(edges.right - 1, edges.bottom - 1)).toBe(true);
  });
});

const geometry = resolveGeometry();
const GRID = 220;
const BOX = { left: 0, top: 100, right: 1100, bottom: 700 };

function mountLink(scrollTop: number, scrollLeft: number, sourceIndex = 13) {
  const raw: Task[] = Array.from({ length: 30 }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Task ${i + 1}`,
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    parentId: null,
    sequence: String(i + 1),
  }));
  const rows: TaskTransformed[] = raw.map((t, i) => ({
    ...t,
    order: i + 1,
    originalOrder: i + 1,
    depth: 0,
    barLeft: 300 + i * 40,
    barWidth: 120,
  }));
  const store = createGanttStore();
  store.setState({ rawTasks: raw, rowTasks: rows });

  const onDependencyCreate = vi.fn();
  const onTasksChange = vi.fn();
  let api!: ReturnType<typeof useGanttLinkDrag>;
  function Probe() {
    api = useGanttLinkDrag({
      task: rows[sourceIndex],
      onTasksChange,
      onDependencyCreate,
      geometry,
    });
    return null;
  }
  renderToString(
    createElement(GanttStoreContext.Provider, { value: store }, createElement(Probe))
  );

  const scrollEl = {
    scrollTop,
    scrollLeft,
    getBoundingClientRect: () => BOX,
    querySelector: () => ({ offsetWidth: GRID }),
  };
  const content = {
    isConnected: true,
    getBoundingClientRect: () => ({
      left: BOX.left + GRID - scrollLeft,
      top: BOX.top + HEADER_HEIGHT - scrollTop,
    }),
  };
  const handle = {
    closest: (sel: string) =>
      sel === ".gantt-content" ? content : sel === ".gantt-scroll-container" ? scrollEl : null,
    setPointerCapture() {},
    releasePointerCapture() {},
  };

  const doc = Object.assign(new EventTarget(), { body: { style: { cursor: "" } } });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const pointer = (type: string, clientX: number, clientY: number) =>
    doc.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, clientX, clientY }));

  const over = (index: number) => ({
    x: BOX.left + GRID - scrollLeft + rows[index].barLeft + 60,
    y: BOX.top + HEADER_HEIGHT - scrollTop + index * geometry.rowHeight + geometry.rowHeight / 2,
  });

  const drag = (to: { x: number; y: number }) => {
    const src = over(sourceIndex);
    api.startLink("end")({
      isPrimary: true,
      button: 0,
      pointerId: 1,
      clientX: src.x,
      clientY: src.y,
      currentTarget: handle,
      stopPropagation() {},
      preventDefault() {},
    } as unknown as React.PointerEvent<HTMLElement>);
    pointer("pointermove", to.x, to.y);
    const draft = store.getState().linkDraft;
    pointer("pointerup", to.x, to.y);
    return draft;
  };

  return { drag, over, onDependencyCreate, onTasksChange };
}

describe("releasing a link drag", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("links a visible row", () => {
    const link = mountLink(380, 0);
    const draft = link.drag(link.over(11));

    expect(draft?.hoverTaskId).toBe("t12");
    expect(link.onDependencyCreate).toHaveBeenCalledTimes(1);
    expect(link.onTasksChange).toHaveBeenCalledTimes(1);
  });

  type Link = ReturnType<typeof mountLink>;

  it.each([
    ["the date header", 380, 0, (l: Link) => ({ x: l.over(9).x, y: BOX.top + 63 })],
    ["the task list", 0, 1000, (l: Link) => ({ x: BOX.left + 100, y: l.over(12).y })],
  ])("links nothing over %s, though a bar is scrolled under it", (_, top, left, at) => {
    const link = mountLink(top, left);
    const draft = link.drag(at(link));

    expect(draft?.hoverTaskId ?? null).toBeNull();
    expect(link.onDependencyCreate).not.toHaveBeenCalled();
    expect(link.onTasksChange).not.toHaveBeenCalled();
  });
});
