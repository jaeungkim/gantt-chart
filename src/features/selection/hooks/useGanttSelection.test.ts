// @vitest-environment happy-dom
import { createElement, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "core/types";
import Gantt from "Gantt";
import { click, render } from "shared/testing/dom";

const TASKS: Task[] = [
  { id: "a", name: "A", startDate: "2025-01-01", endDate: "2025-01-05", parentId: null, sequence: "1" },
  { id: "b", name: "B", startDate: "2025-01-03", endDate: "2025-01-09", parentId: null, sequence: "2" },
];

type GanttProps = ComponentProps<typeof Gantt>;

async function mountChart(props: Partial<GanttProps>) {
  const { host, rerender } = await render(createElement(Gantt, { tasks: TASKS, ...props }));
  const bar = (id: string) => host.querySelector(`.gantt-task-bar[data-task-id="${id}"]`)!;
  return {
    rerender: (next: Partial<GanttProps>) => rerender(createElement(Gantt, { tasks: TASKS, ...next })),
    clickBar: (id: string) => click(bar(id)),
    selectedIds: () =>
      [...host.querySelectorAll(".gantt-task-bar.selected")].map((el) => el.getAttribute("data-task-id")),
  };
}

const reported = (onTaskSelect: ReturnType<typeof vi.fn>) =>
  onTaskSelect.mock.calls.map(([task]) => task?.id ?? null);

describe("clicking a bar", () => {
  it("selects the bar and reports it through onTaskSelect", async () => {
    const onTaskSelect = vi.fn();
    const chart = await mountChart({ onTaskSelect });
    await chart.clickBar("a");

    expect(reported(onTaskSelect)).toEqual(["a"]);
    expect(chart.selectedIds()).toEqual(["a"]);
  });

  it("does not report a click on the bar that is already selected", async () => {
    const onTaskSelect = vi.fn();
    const chart = await mountChart({ onTaskSelect });
    await chart.clickBar("a");
    await chart.clickBar("a");

    expect(reported(onTaskSelect)).toEqual(["a"]);
  });

  it("moves the selection to the next bar clicked", async () => {
    const onTaskSelect = vi.fn();
    const chart = await mountChart({ onTaskSelect });
    await chart.clickBar("a");
    await chart.clickBar("b");

    expect(reported(onTaskSelect)).toEqual(["a", "b"]);
    expect(chart.selectedIds()).toEqual(["b"]);
  });

  it("selects nothing when selectable is false, even with onTaskSelect passed", async () => {
    const onTaskSelect = vi.fn();
    const chart = await mountChart({ selectable: false, onTaskSelect });
    await chart.clickBar("a");

    expect(onTaskSelect).not.toHaveBeenCalled();
    expect(chart.selectedIds()).toEqual([]);
  });

  it("selects nothing when neither selectable, onTaskSelect nor the detail panel is set", async () => {
    const chart = await mountChart({});
    await chart.clickBar("a");

    expect(chart.selectedIds()).toEqual([]);
  });

  it.each([
    ["selectable alone", { selectable: true }],
    ["the detail panel", { showDetail: true }],
  ])("highlights the clicked bar when %s turns selection on", async (_, props) => {
    const chart = await mountChart(props);
    await chart.clickBar("a");

    expect(chart.selectedIds()).toEqual(["a"]);
  });
});

describe("turning selection off", () => {
  const onTaskSelect = vi.fn();

  it.each([
    ["selectable turns false", { selectable: true, onTaskSelect }, { selectable: false, onTaskSelect }],
    ["the detail panel that turned it on turns off", { showDetail: true, onTaskSelect }, { showDetail: false }],
  ])("clears the highlight without calling onTaskSelect when %s", async (_, on, off) => {
    const chart = await mountChart(on);
    await chart.clickBar("a");
    expect(chart.selectedIds()).toEqual(["a"]);
    onTaskSelect.mockClear();

    await chart.rerender(off);

    expect(chart.selectedIds()).toEqual([]);
    expect(onTaskSelect).not.toHaveBeenCalled();
  });
});
