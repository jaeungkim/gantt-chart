import { GANTT_SCALE_CONFIG } from "shared/constants";
import { Dayjs } from "dayjs";
import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import { TaskTree } from "core/tree";
import { sortTasksBySequence } from "core/reorder";

// Bar geometry: where a task's span starts and how wide it is, in px along the tick strip.
export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) {
    return { barMarginLeftAmount: 0, barWidthSize: 0 };
  }

  const config = GANTT_SCALE_CONFIG[scaleKey];
  const { tickUnit, unitPerTick } = config;

  let leftMargin = 0;
  let barWidth = 0;
  let hasStarted = false;

  const startTime = startDate.valueOf();
  const endTime = endDate.valueOf();

  for (const tick of timelineTicks) {
    const tickStart = tick.startDate;
    const tickEnd = tickStart.add(unitPerTick, tickUnit);
    const tickWidth = tick.widthPx;

    const tickStartTime = tickStart.valueOf();
    const tickEndTime = tickEnd.valueOf();

    if (tickEndTime <= startTime) {
      leftMargin += tickWidth;
      continue;
    }

    if (tickStartTime >= endTime) {
      break;
    }

    const overlapStart = startTime > tickStartTime ? startDate : tickStart;
    const overlapEnd = endTime < tickEndTime ? endDate : tickEnd;

    const tickDuration = tickEndTime - tickStartTime;
    const overlapDuration = overlapEnd.valueOf() - overlapStart.valueOf();
    const overlapRatio = overlapDuration / tickDuration;

    if (!hasStarted && overlapStart.valueOf() > tickStartTime) {
      const beforeStartRatio =
        (overlapStart.valueOf() - tickStartTime) / tickDuration;
      leftMargin += beforeStartRatio * tickWidth;
    }

    barWidth += overlapRatio * tickWidth;
    hasStarted = true;
  }

  return {
    barMarginLeftAmount: leftMargin,
    barWidthSize: Math.max(barWidth, 1),
  };
}

function calculateTaskDepth(sequence: string): number {
  return sequence.split(".").length - 1;
}

// With `tree` (hierarchy on) depth comes from the parent chain, not the sequence, and rows
// with children are marked as summaries.
export function transformTasks(
  tasks: Task[],
  timelineTicks: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  tree?: TaskTree
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);

  return sortedTasks.map((task, index) => {
    const depth = tree
      ? tree.depthOf.get(task.id) ?? 0
      : calculateTaskDepth(task.sequence);
    const isSummary = (tree?.childIds.get(task.id)?.length ?? 0) > 0;
    const order = index + 1;

    const { barMarginLeftAmount, barWidthSize } = calculateDateOffsets(
      dayjs(task.startDate),
      dayjs(task.endDate),
      timelineTicks,
      selectedScale
    );

    return {
      ...task,
      barLeft: barMarginLeftAmount,
      barWidth: barWidthSize,
      depth,
      isSummary,
      order,
      originalOrder: order,
    };
  });
}
