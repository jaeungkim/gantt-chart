// The task data model. `src/shared/task.ts` re-exports these and adds the render-side types.

/** Which bar ends a dependency joins, the predecessor's first: F is finish, S is start. See https://gantt.jaeungkim.com/docs/ref/task */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

/** One entry of a task's `dependencies`: a predecessor the task waits on, and how the two link. See https://gantt.jaeungkim.com/docs/ref/task */
export interface TaskDependency {
  /** The predecessor's id; an id that is not in `tasks` draws no arrow. */
  targetId: string;
  /** Which bar ends the arrow joins; a value outside the four draws no arrow. */
  type: DependencyType;
}

/** One task in the `tasks` prop; the first six fields are required. See https://gantt.jaeungkim.com/docs/ref/task */
export interface Task {
  /** Unique id that `parentId`, `dependencies` and the callbacks refer to; uniqueness is not checked. */
  id: string;
  /** Label shown in the task list, on the bar and in its tooltip. */
  name: string;
  /** Start, as any string `dayjs.utc()` parses; a date-only value is midnight UTC. */
  startDate: string;
  /** End, in the same format; it is an instant, so a date-only end leaves that day out. */
  endDate: string;
  /** Parent's id, null for a root; the chart reads it only with `hierarchy` on, and an unknown parent or a cycle makes the task a root. */
  parentId: string | null;
  /** Row order as a dotted path ("2.1" is the first child of "2"); segments compare as numbers, so 1.10 follows 1.2. */
  sequence: string;
  /** Progress 0-100 (%), clamped to that range; omitted means no progress display, except on a summary row, which rolls it up from its children. */
  progress?: number;
  /** Bar color (any CSS color); the hover shade, progress fill and label color derive from it. Omitted, the `--gantt-*` tokens decide. */
  color?: string;
  /** Extra class name put on this task's bar and its task-list row. */
  className?: string;
  /** Lane this task shares a row with; lane-mates draw side by side, and overlaps stack onto extra rows. */
  lane?: string;
  /** The tasks this one waits on, each drawn as an arrow into this bar. */
  dependencies?: TaskDependency[];
  /** Blocks every gesture on this task and its detail-panel edits, and overrides the chart's props; the task's own `allowX` flags still win. */
  readOnly?: boolean;
  /** Allows or blocks dragging this bar along the timeline. Overrides `readOnly` and the chart's props. */
  allowMove?: boolean;
  /** Allows or blocks resizing this bar and editing its dates in the detail panel. Overrides `readOnly` and the chart's props, but a summary row never resizes. */
  allowResize?: boolean;
  /** Allows or blocks editing this task's progress in the detail panel. Overrides `readOnly` and the chart's props, but a summary row's progress is never editable. */
  allowProgressChange?: boolean;
  /** Allows or blocks drawing a dependency from or onto this bar. Overrides `readOnly` and the chart's props. */
  allowLinkCreate?: boolean;
  /** Allows or blocks selecting and deleting the arrows of this task's own `dependencies`. Overrides `readOnly` and the chart's props. */
  allowLinkDelete?: boolean;
  /** Allows or blocks dragging this row to a new position or parent. Opt-in: off unless this or the chart's `allowReorder` turns it on. */
  allowReorder?: boolean;
  /** Earliest date (ISO string) this bar may be dragged or edited to. Overrides the chart's `minDate`. */
  minDate?: string;
  /** Latest date (ISO string) this bar may be dragged or edited to. Overrides the chart's `maxDate`. */
  maxDate?: string;
}

/** Normalizes progress into the 0-100 range; null when the value is missing or invalid */
export function normalizeProgress(progress: number | undefined): number | null {
  if (typeof progress !== 'number' || Number.isNaN(progress)) return null;
  return Math.min(100, Math.max(0, progress));
}
