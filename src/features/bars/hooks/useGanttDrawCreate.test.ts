import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dayjs from "core/dates";
import { resolveGeometry } from "shared/constants";
import { GanttStoreContext } from "shared/context";
import { createGanttStore } from "shared/store";
import {
  defaultTaskDraft,
  drawSlotTopPx,
  useGanttDrawCreate,
} from "features/bars/hooks/useGanttDrawCreate";

// Effects never run under renderToString, so each is kept for a test that mounts and unmounts
const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (create: () => void | (() => void)) => void effects.push(create),
}));

describe("drawSlotTopPx", () => {
  const ROWS = 4;
  const geometry = resolveGeometry();
  const ROW = geometry.rowHeight;
  const blankTop = ROWS * ROW;

  it("refuses a press on a row", () => {
    expect(drawSlotTopPx(0, ROWS, geometry)).toBeNull();
    expect(drawSlotTopPx(ROW * 2 + 1, ROWS, geometry)).toBeNull();
    expect(drawSlotTopPx(blankTop - 1, ROWS, geometry)).toBeNull();
  });

  it("draws from the first pixel under the last row", () => {
    expect(drawSlotTopPx(blankTop, ROWS, geometry)).toBe(blankTop);
  });

  it("pins the ghost to that one band however far down the press was", () => {
    expect(drawSlotTopPx(blankTop + ROW * 7, ROWS, geometry)).toBe(blankTop);
    expect(drawSlotTopPx(blankTop + 4000, ROWS, geometry)).toBe(blankTop);
  });

  it("treats the whole canvas as blank when there are no rows", () => {
    expect(drawSlotTopPx(0, 0, geometry)).toBe(0);
    expect(drawSlotTopPx(500, 0, geometry)).toBe(0);
  });

  it("finds the blank band under rows of the height it is given", () => {
    const tall = resolveGeometry(50);
    expect(drawSlotTopPx(blankTop, ROWS, tall)).toBeNull();
    expect(drawSlotTopPx(ROWS * 50, ROWS, tall)).toBe(ROWS * 50);
  });
});

describe("defaultTaskDraft", () => {
  const cells = (...days: string[]) =>
    days.map((day) => ({ startDate: dayjs(day), widthPx: 72 }));

  it("proposes the tick today lands on, one tick long", () => {
    const draft = defaultTaskDraft(
      dayjs("2025-01-03T14:00:00Z"),
      cells("2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"),
      "week"
    );

    expect(draft).toEqual({
      startDate: dayjs("2025-01-03").toISOString(),
      endDate: dayjs("2025-01-04").toISOString(),
    });
  });

  it("falls back to the first tick when today is off the timeline", () => {
    const draft = defaultTaskDraft(
      dayjs("2030-06-01"),
      cells("2025-01-01", "2025-01-02"),
      "week"
    );

    expect(draft?.startDate).toBe(dayjs("2025-01-01").toISOString());
  });

  it("proposes nothing while the timeline has no cells", () => {
    expect(defaultTaskDraft(dayjs(), [], "week")).toBeNull();
  });
});

describe("the click that trails a draw", () => {
  const geometry = resolveGeometry();
  const ROWS = 2;
  const SLOT_Y = ROWS * geometry.rowHeight + 5;
  const content = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  let doc: EventTarget;

  beforeEach(() => {
    doc = new EventTarget();
    vi.stubGlobal("document", doc);
  });
  afterEach(() => vi.unstubAllGlobals());

  function mount(onTaskCreate = vi.fn()) {
    const store = createGanttStore("week");
    store.getState().setBottomRowCells(
      Array.from({ length: 10 }, (_, i) => ({
        startDate: dayjs("2026-01-05").add(i, "day"),
        widthPx: 40,
      }))
    );
    let draw!: ReturnType<typeof useGanttDrawCreate>;
    const Probe = () => {
      draw = useGanttDrawCreate({ enabled: true, rowCount: ROWS, onTaskCreate, geometry });
      return null;
    };
    renderToString(
      createElement(GanttStoreContext.Provider, { value: store }, createElement(Probe))
    );
    return draw;
  }

  const pressAt = (draw: ReturnType<typeof useGanttDrawCreate>, clientY: number) =>
    draw.onDrawPointerDown({
      isPrimary: true,
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 20,
      clientY,
      target: content,
      currentTarget: content,
    } as never);

  const releaseAt = (clientX: number) => {
    for (const type of ["pointermove", "pointerup"]) {
      doc.dispatchEvent(Object.assign(new Event(type), { pointerId: 1, clientX, clientY: SLOT_Y }));
    }
  };

  it("claims the click after a finished draw, once", () => {
    const onTaskCreate = vi.fn();
    const draw = mount(onTaskCreate);
    pressAt(draw, SLOT_Y);
    releaseAt(180);

    expect(onTaskCreate).toHaveBeenCalledTimes(1);
    expect(draw.consumeDrawClick()).toBe(true);
    expect(draw.consumeDrawClick()).toBe(false);
  });

  it("leaves a plain click on the blank band alone", () => {
    const draw = mount();
    pressAt(draw, SLOT_Y);
    releaseAt(20);

    expect(draw.consumeDrawClick()).toBe(false);
  });

  it("forgets a draw whose click landed elsewhere once the next press comes", () => {
    const draw = mount();
    pressAt(draw, SLOT_Y);
    releaseAt(180);
    pressAt(draw, 5);

    expect(draw.consumeDrawClick()).toBe(false);
  });

  it("drops a draw whose chart unmounts before the release", () => {
    const onTaskCreate = vi.fn();
    effects.length = 0;
    const draw = mount(onTaskCreate);
    const unmount = effects.map((create) => create());
    pressAt(draw, SLOT_Y);
    unmount.forEach((cleanup) => cleanup?.());
    releaseAt(180);

    expect(onTaskCreate).not.toHaveBeenCalled();
  });
});
