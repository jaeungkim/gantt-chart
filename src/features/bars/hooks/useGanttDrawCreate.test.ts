// @vitest-environment happy-dom
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import dayjs from "core/dates";
import type { Task } from "core/types";
import Gantt from "Gantt";
import { resolveGeometry } from "shared/constants";
import { click, keydown, pointer, render } from "shared/testing/dom";
import { defaultTaskDraft, drawSlotTopPx } from "features/bars/hooks/useGanttDrawCreate";

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

const ROW_HEIGHT = 40;
const TASKS: Task[] = [
  { id: "a", name: "A", startDate: "2025-01-01", endDate: "2025-01-05", parentId: null, sequence: "1" },
  { id: "b", name: "B", startDate: "2025-01-03", endDate: "2025-01-09", parentId: null, sequence: "2" },
];
const SLOT_Y = TASKS.length * ROW_HEIGHT + ROW_HEIGHT / 2;
const ROW_Y = ROW_HEIGHT / 2;

type GanttProps = ComponentProps<typeof Gantt>;

async function mountChart(props: Partial<GanttProps> = {}) {
  const onTaskCreate = vi.fn();
  const onTaskSelect = vi.fn();
  const { host, rerender } = await render(
    createElement(Gantt, { tasks: TASKS, rowHeight: ROW_HEIGHT, onTaskCreate, onTaskSelect, ...props })
  );
  const content = host.querySelector(".gantt-content")!;
  return {
    host,
    rerender,
    content,
    onTaskCreate,
    ghost: () => host.querySelector(".gantt-draw-ghost"),
    selections: () => onTaskSelect.mock.calls.map(([task]) => task?.id ?? null),
    selectA: () => click(host.querySelector('.gantt-task-bar[data-task-id="a"]')!),
    press: (x: number, y = SLOT_Y) => pointer("pointerdown", content, x, y),
  };
}

const move = (x: number) => pointer("pointermove", document, x, SLOT_Y);
const release = (x: number) => pointer("pointerup", document, x, SLOT_Y);

const draw = async (chart: Awaited<ReturnType<typeof mountChart>>, fromX: number, toX: number) => {
  await chart.press(fromX);
  await move(toX);
  await release(toX);
};

describe("drawing a task in the blank row", () => {
  it("proposes the weeks the pointer swept as the new task's dates", async () => {
    const chart = await mountChart();
    await draw(chart, 10, 300);

    expect(chart.onTaskCreate.mock.calls).toEqual([
      [{ startDate: "2024-11-24T00:00:00.000Z", endDate: "2024-12-15T00:00:00.000Z" }],
    ]);
  });

  it("proposes the same dates when drawn right to left", async () => {
    const chart = await mountChart();
    await draw(chart, 300, 10);

    expect(chart.onTaskCreate.mock.calls).toEqual([
      [{ startDate: "2024-11-24T00:00:00.000Z", endDate: "2024-12-15T00:00:00.000Z" }],
    ]);
  });

  it("shows a ghost over the swept weeks until the release", async () => {
    const chart = await mountChart();
    await chart.press(10);
    await move(300);

    expect(chart.ghost()?.getAttribute("style")).toContain("left: 0px; width: 378px;");

    await release(300);
    expect(chart.ghost()).toBeNull();
  });

  it("does not create a task from a drag under 4px", async () => {
    const chart = await mountChart();
    await chart.press(10);
    await move(13);

    expect(chart.ghost()).toBeNull();

    await release(13);
    expect(chart.onTaskCreate).not.toHaveBeenCalled();
  });

  it("creates a task from a drag of exactly 4px", async () => {
    const chart = await mountChart();
    await draw(chart, 10, 14);

    expect(chart.onTaskCreate).toHaveBeenCalledOnce();
  });

  it.each([
    ["Escape", () => keydown("Escape")],
    ["pointercancel", () => pointer("pointercancel", document, 300, SLOT_Y)],
  ])("cancels the draw on %s", async (_, cancel) => {
    const chart = await mountChart();
    await chart.press(10);
    await move(300);
    await cancel();

    expect(chart.ghost()).toBeNull();

    await release(300);
    expect(chart.onTaskCreate).not.toHaveBeenCalled();
  });

  it("does not draw from a press on a task row", async () => {
    const chart = await mountChart();
    await chart.press(10, ROW_Y);
    await move(300);
    await release(300);

    expect(chart.ghost()).toBeNull();
    expect(chart.onTaskCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["readOnly is set", { readOnly: true }],
    ["onTaskCreate is not passed", { onTaskCreate: undefined }],
  ])("does not draw when %s", async (_, props) => {
    const chart = await mountChart(props);
    await chart.press(10);
    await move(300);

    expect(chart.ghost()).toBeNull();

    await release(300);
    expect(chart.onTaskCreate).not.toHaveBeenCalled();
  });
});

describe("the click that trails a draw", () => {
  it("claims the click after a finished draw, once", async () => {
    const chart = await mountChart();
    await chart.selectA();
    await draw(chart, 10, 200);
    await click(chart.content);

    expect(chart.onTaskCreate).toHaveBeenCalledOnce();
    expect(chart.selections()).toEqual(["a"]);

    await click(chart.content);
    expect(chart.selections()).toEqual(["a", null]);
  });

  it("leaves a plain click on the blank band alone", async () => {
    const chart = await mountChart();
    await chart.selectA();
    await chart.press(10);
    await release(10);
    await click(chart.content);

    expect(chart.selections()).toEqual(["a", null]);
  });

  it("forgets a draw whose click landed elsewhere once the next press comes", async () => {
    const chart = await mountChart();
    await chart.selectA();
    await draw(chart, 10, 200);
    await chart.press(10, ROW_Y);
    await release(10);
    await click(chart.content);

    expect(chart.selections()).toEqual(["a", null]);
  });

  it("drops a draw whose chart unmounts before the release", async () => {
    const chart = await mountChart();
    await chart.press(10);
    await move(200);
    await chart.rerender(createElement("div"));
    await release(200);

    expect(chart.onTaskCreate).not.toHaveBeenCalled();
  });
});
