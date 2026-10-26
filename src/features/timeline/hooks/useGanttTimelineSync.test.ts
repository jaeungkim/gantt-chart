import { createElement, type RefObject } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import dayjs from "core/dates";
import { useGanttTimelineSync } from "features/timeline/hooks/useGanttTimelineSync";
import { useGanttVirtualization } from "features/timeline/hooks/useGanttVirtualization";
import type { GanttVirtualization, GanttZoomAnchor } from "features/timeline/types";
import { dateAtOffsetPx } from "features/timeline/utils/geometry";
import { NO_RANGE_EXTENSION } from "features/timeline/utils/viewport";
import { resolveGeometry } from "shared/constants";
import { GanttStoreContext, useGanttStore } from "shared/context";
import { createGanttStore } from "shared/store";
import type { Task } from "shared/task";
import type { GanttScaleKey } from "shared/types";

const CLIENT_W = 1224;
const geometry = resolveGeometry();

const TASKS: Task[] = Array.from({ length: 40 }, (_, i) => ({
  id: `t${i + 1}`,
  name: `Task ${i + 1}`,
  startDate: dayjs("2026-01-05").add(6 * i, "day").format("YYYY-MM-DD"),
  endDate: dayjs("2026-01-05").add(6 * i + 4, "day").format("YYYY-MM-DD"),
  parentId: null,
  sequence: String(i + 1),
}));

type Zoom = (scale: GanttScaleKey, anchor: GanttZoomAnchor) => void;

// The hooks in Gantt.tsx's order: the window syncs before the scroll compensation runs
function Chart({
  scrollRef,
  onRender,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onRender: (virtual: GanttVirtualization, zoomTo: Zoom) => void;
}) {
  const rawTasks = useGanttStore((state) => state.rawTasks);
  const bottomRowCells = useGanttStore((state) => state.bottomRowCells);
  const selectedScale = useGanttStore((state) => state.selectedScale);
  const virtual = useGanttVirtualization({
    rowCount: rawTasks.length,
    bottomRowCells,
    scrollRef,
    geometry,
  });
  const zoomTo = useGanttTimelineSync({
    rawTasks,
    selectedScale,
    visibleRange: undefined,
    hierarchy: false,
    extension: NO_RANGE_EXTENSION,
    scrollRef,
    bottomRowCells,
    syncWindow: virtual.syncWindow,
  });
  onRender(virtual, zoomTo);
  return null;
}

// react-dom's client reads window.event, also from work it schedules after a test ends
(globalThis as { window?: unknown }).window ??= globalThis;

let root: Root | null = null;
afterEach(() => {
  root?.unmount();
  root = null;
  vi.unstubAllGlobals();
});

// No scroll events fire here, so only a sync in the same layout pass can move the window
function mount() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  // react-dom's client also reads the container's document, which node lacks
  const doc: Record<string, unknown> = {
    nodeType: 9,
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  };
  doc.defaultView = {
    document: doc,
    HTMLIFrameElement: class {},
    getSelection: () => null,
  };
  const container = {
    nodeType: 1,
    tagName: "DIV",
    ownerDocument: doc,
    addEventListener() {},
    removeEventListener() {},
  };

  const store = createGanttStore("month");
  store.getState().setRawTasks(TASKS);
  const box = {
    scrollTop: 0,
    scrollLeft: 0,
    clientWidth: CLIENT_W,
    clientHeight: 600,
    addEventListener() {},
    removeEventListener() {},
  };
  const chart = {} as { virtual: GanttVirtualization; zoomTo: Zoom };

  root = createRoot(container as unknown as Element);
  flushSync(() =>
    root!.render(
      createElement(
        GanttStoreContext.Provider,
        { value: store },
        createElement(Chart, {
          scrollRef: { current: box as unknown as HTMLDivElement },
          onRender: (virtual, zoomTo) => Object.assign(chart, { virtual, zoomTo }),
        })
      )
    )
  );
  box.scrollLeft = 900;
  return { store, box, chart };
}

const rendered = () => new Promise((resolve) => setTimeout(resolve, 0));

// The tick cells the last render produced must span the viewport the scroll now shows
function coversViewport(virtual: GanttVirtualization, scrollLeft: number) {
  const first = virtual.virtualCells[0];
  const last = virtual.virtualCells[virtual.virtualCells.length - 1];
  return (
    first.start <= scrollLeft &&
    last.start + last.size >= scrollLeft + CLIENT_W
  );
}

describe("useGanttTimelineSync re-syncs the virtual window", () => {
  it("after a zoom moves the scroll to its anchor", async () => {
    const { store, box, chart } = mount();
    const viewportX = CLIENT_W / 2;
    const date = dateAtOffsetPx(
      box.scrollLeft + viewportX,
      store.getState().bottomRowCells,
      "month"
    )!;

    chart.zoomTo("week", { date, viewportX });
    await rendered();

    expect(store.getState().selectedScale).toBe("week");
    expect(box.scrollLeft).toBeGreaterThan(900 + CLIENT_W);
    expect(coversViewport(chart.virtual, box.scrollLeft)).toBe(true);
  });

  it("after cells prepended at the front shift the scroll", async () => {
    const { store, box, chart } = mount();
    const early: Task = {
      ...TASKS[0],
      id: "early",
      sequence: "0",
      startDate: "2025-01-06",
      endDate: "2025-01-10",
    };

    store.getState().setRawTasks([early, ...TASKS]);
    await rendered();

    expect(box.scrollLeft).toBeGreaterThan(900 + CLIENT_W);
    expect(coversViewport(chart.virtual, box.scrollLeft)).toBe(true);
  });
});
