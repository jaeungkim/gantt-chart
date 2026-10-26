import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGanttRows } from "features/rows/utils/rows";
import { useGanttRowDrag } from "features/task-list/hooks/useGanttRowDrag";
import { useGanttTaskMove } from "features/task-list/hooks/useGanttTaskMove";
import { HEADER_HEIGHT, resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import type { Task } from "shared/task";
import { fixedAxis } from "shared/virtual/axis";
import { virtualItemsOf, windowOf } from "shared/virtual/window";

const ROW = resolveGeometry().rowHeight;
// height={380} less the 34px Add task footer and the 10px horizontal scrollbar
const CLIENT_HEIGHT = 336;

type RowDrag = ReturnType<typeof useGanttRowDrag>;

function mountDrag(count: number, scrollTop: number) {
  const tasks: Task[] = Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Task ${i + 1}`,
    startDate: "2025-01-01",
    endDate: "2025-01-05",
    parentId: null,
    sequence: String(i + 1),
  }));
  const store = createGanttStore();
  store.setState({ rawTasks: tasks });

  const rows = buildGanttRows(
    tasks.map((task, i) => ({
      ...task,
      barLeft: 0,
      barWidth: 10,
      depth: 0,
      order: i + 1,
      originalOrder: i + 1,
    }))
  );
  const axis = fixedAxis(rows.length, ROW);
  const virtualItems = virtualItemsOf(
    axis,
    windowOf(axis, scrollTop, CLIENT_HEIGHT)
  );

  // Client y of the chart's top edge; a page scroll moves it, and the body with it
  const page = { chartTop: 0 };
  const container = {
    clientHeight: CLIENT_HEIGHT,
    getBoundingClientRect: () => ({ top: page.chartTop }),
  };
  // The body sits under the sticky header and scrolls with the container
  const body = {
    closest: () => container,
    getBoundingClientRect: () => ({
      top: page.chartTop + HEADER_HEIGHT - scrollTop,
    }),
  } as unknown as HTMLDivElement;

  const onTasksChange = vi.fn();
  let drag!: RowDrag;

  function Probe({ onReady }: { onReady: (api: RowDrag) => void }) {
    const move = useGanttTaskMove({
      hierarchy: true,
      interaction: { allowReorder: true },
      onTasksChange,
      onExpand: () => {},
    });
    onReady(
      useGanttRowDrag({
        rows,
        virtualItems,
        bodyRef: { current: body },
        hierarchy: true,
        move,
      })
    );
    return null;
  }

  renderToString(
    createElement(
      GanttStoreContext.Provider,
      { value: store },
      createElement(Probe, { onReady: (api) => (drag = api) })
    )
  );

  const doc = Object.assign(new EventTarget(), {
    body: { style: { cursor: "" } },
  });
  vi.stubGlobal("document", doc);

  const pointer = (type: string, clientY: number) =>
    doc.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, clientY }));

  const rowTop = (index: number) =>
    page.chartTop + HEADER_HEIGHT - scrollTop + index * ROW;

  const press = (index: number) =>
    drag.onGripPointerDown(index, {
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 10,
      clientY: rowTop(index) + ROW / 2,
      currentTarget: { setPointerCapture() {}, releasePointerCapture() {} },
    } as unknown as React.PointerEvent);

  return { drag, store, page, press, pointer, rowTop, onTasksChange };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("row drop targets", () => {
  it("moves the row when released on a visible row", () => {
    const { press, pointer, rowTop, onTasksChange } = mountDrag(23, 0);

    press(0);
    pointer("pointermove", rowTop(5) + 2);
    pointer("pointerup", rowTop(5) + 2);

    expect(onTasksChange).toHaveBeenCalledTimes(1);
  });

  it("ignores rows rendered below the chart's bottom edge", () => {
    const { store, press, pointer, onTasksChange } = mountDrag(23, 0);

    press(0);
    pointer("pointermove", 530);
    expect(store.getState().reorderDraft).toBeNull();
    pointer("pointerup", 530);

    expect(onTasksChange).not.toHaveBeenCalled();
  });

  it("ignores rows scrolled under the sticky header", () => {
    const { store, press, pointer, onTasksChange } = mountDrag(30, 380);

    press(13);
    pointer("pointermove", 40);
    expect(store.getState().reorderDraft).toBeNull();
    pointer("pointerup", 40);

    expect(onTasksChange).not.toHaveBeenCalled();
  });

  it("does not revive the last draft when a page scroll hides the release point", () => {
    const { store, page, press, pointer, rowTop, onTasksChange } = mountDrag(
      23,
      0
    );
    const y = rowTop(5) + 2;

    press(0);
    pointer("pointermove", y);
    expect(store.getState().reorderDraft).not.toBeNull();
    page.chartTop = -300;
    pointer("pointerup", y);

    expect(onTasksChange).not.toHaveBeenCalled();
  });
});

describe("the click that closes a row drag", () => {
  it("is consumed once after a reorder", () => {
    const { drag, press, pointer, rowTop } = mountDrag(23, 0);

    press(0);
    pointer("pointermove", rowTop(5) + 2);
    pointer("pointerup", rowTop(5) + 2);

    expect(drag.consumeDragClick()).toBe(true);
    expect(drag.consumeDragClick()).toBe(false);
  });

  it("stays a click when the press never moved", () => {
    const { drag, press, pointer, rowTop } = mountDrag(23, 0);

    press(0);
    pointer("pointerup", rowTop(0) + ROW / 2);

    expect(drag.consumeDragClick()).toBe(false);
  });

  it("expires when the reorder detached the grip and no click came", async () => {
    const { drag, press, pointer, rowTop } = mountDrag(23, 0);

    press(0);
    pointer("pointermove", rowTop(5) + 2);
    pointer("pointerup", rowTop(5) + 2);
    await new Promise((resolve) => setTimeout(resolve));

    expect(drag.consumeDragClick()).toBe(false);
  });
});
