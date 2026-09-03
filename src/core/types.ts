// The task data model. `src/shared/task.ts` re-exports these and adds the render-side types.

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface TaskDependency {
  /** The predecessor's id - a task's `dependencies` list the tasks it waits on */
  targetId: string;
  type: DependencyType;
}

export interface Task {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  parentId: string | null;
  sequence: string;
  /** Progress 0-100 (%) - omitted means no progress display */
  progress?: number;
  /** Bar color (any CSS color) - progress fill and hover shade derive from it; omitted, the `--gantt-*` tokens decide */
  color?: string;
  /** Extra class name put on this task's bar and its task-list row */
  className?: string;
  /** Lane this task shares a row with - lane-mates draw side by side, overlaps stack onto extra rows */
  lane?: string;
  dependencies?: TaskDependency[];
  /** Blocks every gesture on this task - overrides the chart's `readOnly` prop */
  readOnly?: boolean;
  /** Allows/blocks moving this task - overrides both `readOnly` settings */
  allowMove?: boolean;
  /** Allows/blocks resizing this task - overrides both `readOnly` settings */
  allowResize?: boolean;
  /** Allows/blocks dragging this task's progress handle - overrides both `readOnly` settings */
  allowProgressChange?: boolean;
  /** Allows/blocks starting a dependency drag from this task - overrides both `readOnly` settings */
  allowLinkCreate?: boolean;
  /** Allows/blocks deleting a dependency this task owns - overrides both `readOnly` settings */
  allowLinkDelete?: boolean;
  /** Allows/blocks dragging this row to a new position or parent - opt-in, off unless this or the chart's `allowReorder` turns it on */
  allowReorder?: boolean;
  /** Earliest date this task may be dragged to (ISO string) - overrides the chart's `minDate` */
  minDate?: string;
  /** Latest date this task may be dragged to (ISO string) - overrides the chart's `maxDate` */
  maxDate?: string;
}

/** Normalizes progress into the 0-100 range; null when the value is missing or invalid */
export function normalizeProgress(progress: number | undefined): number | null {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.min(100, Math.max(0, progress));
}
