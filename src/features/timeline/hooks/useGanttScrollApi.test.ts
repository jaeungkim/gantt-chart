import { createElement, type RefObject } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import dayjs from "core/dates";
import { useGanttScrollApi } from "features/timeline/hooks/useGanttScrollApi";
import { useGanttTimelineSync } from "features/timeline/hooks/useGanttTimelineSync";
import type { GanttScrollApi } from "features/timeline/types";
import {
  calculateDateOffsetPx,
  dateAtOffsetPx,
} from "features/timeline/utils/geometry";
import { NO_RANGE_EXTENSION } from "features/timeline/utils/viewport";
import { HEADER_HEIGHT, resolveGeometry } from "shared/constants";
import { GanttStoreContext, useGanttStore } from "shared/context";
import { createGanttStore, type GanttStoreApi } from "shared/store";
import type { Task, TaskTransformed } from "shared/task";
import type { GanttBottomRowCell, GanttScaleKey } from "shared/types";

(globalThis as { window?: unknown }).window ??= globalThis;

const geometry = resolveGeometry();
const ROW = geometry.rowHeight;

const TASKS: TaskTransformed[] = Array.from({ length: 40 }, (_, i) => ({
  id: `t${i + 1}`,
  name: `Task ${i + 1}`,
  startDate: "2026-09-01",
  endDate: "2026-09-08",
  parentId: null,
  sequence: String(i + 1),
  barLeft: 100,
  barWidth: 120,
  depth: 0,
  order: i + 1,
  originalOrder: i + 1,
}));

function scrollBox(clientHeight: number) {
  const box = {
    scrollTop: 0,
    scrollLeft: 0,
    clientHeight,
    clientWidth: 1000,
    calls: [] as ScrollToOptions[],
    scrollTo(options: ScrollToOptions) {
      box.calls.push(options);
      if (options.top !== undefined) box.scrollTop = options.top;
      if (options.left !== undefined) box.scrollLeft = options.left;
    },
  };
  return box;
}

function Probe({
  box,
  bottomRowCells,
  onApi,
}: {
  box: ReturnType<typeof scrollBox>;
  bottomRowCells: GanttBottomRowCell[];
  onApi: (api: GanttScrollApi) => void;
}) {
  onApi(
    useGanttScrollApi({
      scrollRef: { current: box as unknown as HTMLDivElement },
      bottomRowCells,
      transformedTasks: TASKS,
      selectedScale: "month",
      viewportInsetPx: 0,
      zoomTo: () => {},
      geometry,
    })
  );
  return null;
}

function mountApi(
  box: ReturnType<typeof scrollBox>,
  store = createGanttStore("month")
): GanttScrollApi {
  let api!: GanttScrollApi;
  renderToString(
    createElement(
      GanttStoreContext.Provider,
      { value: store },
      createElement(Probe, {
        box,
        bottomRowCells: store.getState().bottomRowCells,
        onApi: (next) => (api = next),
      })
    )
  );
  return api;
}

describe("scrollToTask under the sticky header", () => {
  const band = (box: ReturnType<typeof scrollBox>) => ({
    top: box.scrollTop,
    bottom: box.scrollTop + box.clientHeight - HEADER_HEIGHT,
  });

  it("scrolls to a row that only the header's height pushes off screen", () => {
    const box = scrollBox(600);
    mountApi(box).scrollToTask("t15", { smooth: false });

    expect(14 * ROW).toBeGreaterThanOrEqual(band(box).top);
    expect(15 * ROW).toBeLessThanOrEqual(band(box).bottom);
  });

  it("centres the row in the band the header leaves uncovered", () => {
    const box = scrollBox(600);
    mountApi(box).scrollToTask("t30", { smooth: false });

    const { top, bottom } = band(box);
    expect(29 * ROW + ROW / 2).toBe((top + bottom) / 2);
  });
});

describe("setScale", () => {
  it.each(["toString", "constructor", "__proto__"])(
    "ignores %s, which the scale table only inherits",
    (key) => {
      const store = createGanttStore("month");
      mountApi(scrollBox(600), store).setScale(key as GanttScaleKey);

      expect(store.getState().selectedScale).toBe("month");
    }
  );
});

describe("scroll animation", () => {
  afterEach(() => vi.unstubAllGlobals());

  function scrollAll(prefersReducedMotion: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: prefersReducedMotion && query === "(prefers-reduced-motion: reduce)",
    }));
    const start = dayjs().startOf("day").subtract(10, "week");
    const store = createGanttStore("month");
    store.getState().setBottomRowCells(
      Array.from({ length: 20 }, (_, i) => ({
        startDate: start.add(i, "week"),
        widthPx: 100,
      }))
    );
    const box = scrollBox(600);
    const api = mountApi(box, store);

    api.scrollToToday();
    api.scrollToDate(start.add(3, "week").toDate());
    api.scrollToTask("t30");
    return box.calls.map((call) => call.behavior);
  }

  it("animates every scroll method by default", () => {
    expect(scrollAll(false)).toEqual(["smooth", "smooth", "smooth"]);
  });

  it("drops the animation when the user prefers reduced motion", () => {
    expect(scrollAll(true)).toEqual(["auto", "auto", "auto"]);
  });
});

describe("a scroll call in the same tick as a scale change", () => {
  const CLIENT_W = 1152;
  const CLIENT_H = 400;

  const tasks: Task[] = Array.from({ length: 40 }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Task ${i + 1}`,
    startDate: dayjs("2026-06-01").add(2 * i, "day").format("YYYY-MM-DD"),
    endDate: dayjs("2026-06-01").add(2 * i + 5, "day").format("YYYY-MM-DD"),
    parentId: null,
    sequence: String(i + 1),
  }));

  function animatedBox() {
    let left = 0;
    let top = 0;
    let flight: ScrollToOptions | null = null;
    return {
      clientWidth: CLIENT_W,
      clientHeight: CLIENT_H,
      get scrollLeft() {
        return left;
      },
      set scrollLeft(value: number) {
        flight = null;
        left = Math.max(0, value);
      },
      get scrollTop() {
        return top;
      },
      scrollTo(options: ScrollToOptions) {
        flight = options;
        if (options.behavior !== "smooth") this.land();
      },
      land() {
        if (flight?.left !== undefined) left = Math.max(0, flight.left);
        if (flight?.top !== undefined) top = Math.max(0, flight.top);
        flight = null;
      },
    };
  }
  type Box = ReturnType<typeof animatedBox>;

  function Chart({
    scrollRef,
    onApi,
  }: {
    scrollRef: RefObject<HTMLDivElement | null>;
    onApi: (api: GanttScrollApi) => void;
  }) {
    const rawTasks = useGanttStore((state) => state.rawTasks);
    const transformedTasks = useGanttStore((state) => state.transformedTasks);
    const bottomRowCells = useGanttStore((state) => state.bottomRowCells);
    const selectedScale = useGanttStore((state) => state.selectedScale);
    const zoomTo = useGanttTimelineSync({
      rawTasks,
      selectedScale,
      visibleRange: undefined,
      hierarchy: false,
      extension: NO_RANGE_EXTENSION,
      scrollRef,
      bottomRowCells,
      syncWindow: () => {},
    });
    onApi(
      useGanttScrollApi({
        scrollRef,
        bottomRowCells,
        transformedTasks,
        selectedScale,
        viewportInsetPx: 0,
        zoomTo,
        geometry,
      })
    );
    return null;
  }

  let root: Root | null = null;
  afterEach(() => {
    root?.unmount();
    root = null;
  });

  function mount() {
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
    store.getState().setRawTasks(tasks);
    const box = animatedBox();
    let api!: GanttScrollApi;

    root = createRoot(container as unknown as Element);
    flushSync(() =>
      root!.render(
        createElement(
          GanttStoreContext.Provider,
          { value: store },
          createElement(Chart, {
            scrollRef: { current: box as unknown as HTMLDivElement },
            onApi: (next) => (api = next),
          })
        )
      )
    );

    const { bottomRowCells } = store.getState();
    box.scrollLeft =
      calculateDateOffsetPx(dayjs("2026-06-04"), bottomRowCells, "month")! -
      CLIENT_W / 2;
    return { store, box, api: () => api };
  }

  const settle = async (box: Box) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    box.land();
  };

  const centreDate = (store: GanttStoreApi, box: Box) => {
    const { bottomRowCells, selectedScale } = store.getState();
    return dateAtOffsetPx(
      box.scrollLeft + CLIENT_W / 2,
      bottomRowCells,
      selectedScale
    )!.format("YYYY-MM-DD");
  };

  const barOnScreen = (store: GanttStoreApi, box: Box, id: string) => {
    const task = store.getState().transformedTasks.find((t) => t.id === id)!;
    const rowTop = (task.order - 1) * ROW;
    return (
      rowTop >= box.scrollTop &&
      rowTop + ROW <= box.scrollTop + CLIENT_H - HEADER_HEIGHT &&
      task.barLeft + task.barWidth > box.scrollLeft &&
      task.barLeft < box.scrollLeft + CLIENT_W
    );
  };

  it("lands scrollToDate after setScale on the new scale", async () => {
    const { store, box, api } = mount();

    api().setScale("week");
    api().scrollToDate("2026-07-20", { smooth: false });
    await settle(box);

    expect(store.getState().selectedScale).toBe("week");
    expect(centreDate(store, box)).toBe("2026-07-20");
  });

  it("lands scrollToDate after zoomToFit on the fitted scale", async () => {
    const { store, box, api } = mount();

    api().zoomToFit();
    api().scrollToDate("2026-07-20", { smooth: false });
    await settle(box);

    expect(store.getState().selectedScale).not.toBe("month");
    expect(centreDate(store, box)).toBe("2026-07-20");
  });

  it("brings the bar on screen for setScale then a smooth scrollToTask", async () => {
    const { store, box, api } = mount();

    api().setScale("week");
    api().scrollToTask("t30");
    await settle(box);

    expect(barOnScreen(store, box, "t30")).toBe(true);
  });

  it("brings the bar on screen for a smooth scrollToTask then setScale", async () => {
    const { store, box, api } = mount();

    api().scrollToTask("t30");
    api().setScale("week");
    await settle(box);

    expect(store.getState().selectedScale).toBe("week");
    expect(barOnScreen(store, box, "t30")).toBe(true);
  });

  it("still scrolls from a handle kept across a later render", async () => {
    const { store, box, api } = mount();
    const kept = api();

    store.getState().setRawTasks([...tasks]);
    await settle(box);
    kept.scrollToDate("2026-07-20", { smooth: false });
    await settle(box);

    expect(centreDate(store, box)).toBe("2026-07-20");
  });
});
