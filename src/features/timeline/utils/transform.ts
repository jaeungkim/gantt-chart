import { GANTT_SCALE_CONFIG } from "shared/constants";
import { Dayjs } from "dayjs";
import { GanttBottomRowCell, GanttScaleKey } from "shared/types";
import { Task, TaskTransformed } from "shared/task";
import dayjs from "core/dates";
import { TaskTree } from "core/tree";
import { buildTaskOrder, sortTasksBySequence } from "core/reorder";

export function calculateDateOffsets(
  startDate: Dayjs,
  endDate: Dayjs,
  timelineTicks: GanttBottomRowCell[],
  scaleKey: GanttScaleKey
): { barMarginLeftAmount: number; barWidthSize: number } {
  if (!timelineTicks.length) {
    return { barMarginLeftAmount: 0, barWidthSize: 0 };
  }

  const { tickUnit, unitPerTick } = GANTT_SCALE_CONFIG[scaleKey];

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

function calculateTaskDepth(
  parentOf: ReadonlyMap<string, string | null>,
  id: string
): number {
  const seen = new Set<string>();
  for (
    let cursor = parentOf.get(id);
    cursor && !seen.has(cursor);
    cursor = parentOf.get(cursor)
  ) {
    seen.add(cursor);
  }
  return seen.size;
}

export function transformTasks(
  tasks: Task[],
  timelineTicks: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  tree?: TaskTree
): TaskTransformed[] {
  const sortedTasks = sortTasksBySequence(tasks);
  const { parentOf } = tree ?? buildTaskOrder(sortedTasks, false);

  return sortedTasks.map((task, index) => {
    const depth = calculateTaskDepth(parentOf, task.id);
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
