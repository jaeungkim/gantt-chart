import { Dayjs } from "dayjs";
import { useMemo } from "react";
import { GanttScheduling } from "types/gantt";
import { Task, TaskTransformed } from "types/task";
import {
  CALENDAR_DAYS,
  computeCriticalPath,
  createWorkingCalendar,
  type CriticalPathResult,
  type SchedulingPolicy,
} from "../core";

interface UseGanttSchedulingParams {
  rawTasks: Task[];
  transformedTasks: TaskTransformed[];
  /** ISO date strings shaded and skipped as holidays */
  holidays?: string[];
  /** Replaces the default weekend/holiday check when given */
  isNonWorkingDay?: (date: Dayjs) => boolean;
  /** Route date arithmetic through the working calendar instead of counting every day */
  workingCalendar: boolean;
  policy: SchedulingPolicy;
  hierarchy: boolean;
  onCycle?: (taskIds: string[]) => void;
  criticalPath: boolean;
}

export interface GanttSchedulingModel {
  /** The single "is this day off" answer the shading and the calendar both read */
  isNonWorkingDay: (date: Dayjs) => boolean;
  /** Everything a drag needs to know about propagating a move to successors */
  scheduling: GanttScheduling;
  /** null while the `criticalPath` prop is off - nothing is computed then */
  criticalPath: CriticalPathResult | null;
  /** The transformed rows with the CPM metrics merged in */
  tasks: TaskTransformed[];
}

/**
 * The chart's date arithmetic: which days count, how a move propagates, what is critical
 *
 * One definition of "non-working" serves the whole chart, so the days the timeline
 * shades and the days the scheduler skips cannot drift apart.
 */
export function useGanttScheduling({
  rawTasks,
  transformedTasks,
  holidays,
  isNonWorkingDay,
  workingCalendar,
  policy,
  hierarchy,
  onCycle,
  criticalPath,
}: UseGanttSchedulingParams): GanttSchedulingModel {
  const isOffDay = useMemo(() => {
    if (isNonWorkingDay) return isNonWorkingDay;

    const holidaySet = new Set(holidays);
    return (date: Dayjs) => {
      const dayOfWeek = date.day();
      return (
        dayOfWeek === 0 ||
        dayOfWeek === 6 ||
        holidaySet.has(date.format("YYYY-MM-DD"))
      );
    };
  }, [holidays, isNonWorkingDay]);

  // Off, it counts every day, which is plain calendar arithmetic - so nothing about
  // the default behaviour changes
  const calendar = useMemo(
    () =>
      workingCalendar
        ? createWorkingCalendar({ isNonWorkingDay: isOffDay })
        : CALENDAR_DAYS,
    [workingCalendar, isOffDay]
  );

  const scheduling = useMemo<GanttScheduling>(
    () => ({ policy, calendar, hierarchy, onCycle }),
    [policy, calendar, hierarchy, onCycle]
  );

  const criticalPathResult = useMemo(
    () => (criticalPath ? computeCriticalPath(rawTasks, { calendar }) : null),
    [criticalPath, rawTasks, calendar]
  );

  // CPM outputs ride along on the transformed rows, so a `columns` renderer can show slack
  const tasks = useMemo(() => {
    const metrics = criticalPathResult?.metrics;
    if (!metrics?.size) return transformedTasks;
    return transformedTasks.map((task) => {
      const values = metrics.get(task.id);
      return values ? { ...task, ...values } : task;
    });
  }, [transformedTasks, criticalPathResult]);

  return {
    isNonWorkingDay: isOffDay,
    scheduling,
    criticalPath: criticalPathResult,
    tasks,
  };
}
