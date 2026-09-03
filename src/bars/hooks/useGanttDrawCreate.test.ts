import { describe, expect, it } from "vitest";
import dayjs from "core/dates";
import { NODE_HEIGHT } from "shared/constants";
import {
  defaultTaskDraft,
  drawSlotTopPx,
} from "bars/hooks/useGanttDrawCreate";

// .gantt-content grows past the last row; that blank region is one draw target, not a stack of empty rows
describe("drawSlotTopPx", () => {
  const ROWS = 4;
  const blankTop = ROWS * NODE_HEIGHT;

  it("refuses a press on a row", () => {
    expect(drawSlotTopPx(0, ROWS)).toBeNull();
    expect(drawSlotTopPx(NODE_HEIGHT * 2 + 1, ROWS)).toBeNull();
    // The last pixel of the last row still belongs to that row
    expect(drawSlotTopPx(blankTop - 1, ROWS)).toBeNull();
  });

  it("draws from the first pixel under the last row", () => {
    expect(drawSlotTopPx(blankTop, ROWS)).toBe(blankTop);
  });

  it("pins the ghost to that one band however far down the press was", () => {
    expect(drawSlotTopPx(blankTop + NODE_HEIGHT * 7, ROWS)).toBe(blankTop);
    expect(drawSlotTopPx(blankTop + 4000, ROWS)).toBe(blankTop);
  });

  it("treats the whole canvas as blank when there are no rows", () => {
    expect(drawSlotTopPx(0, 0)).toBe(0);
    expect(drawSlotTopPx(500, 0)).toBe(0);
  });
});

// A click has no drag to snap, so it borrows the drawn snapping: the tick it lands on, one tick long
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
