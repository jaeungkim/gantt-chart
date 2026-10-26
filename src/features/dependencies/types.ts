import { DependencyType } from "shared/task";

/** A link the user drew or chose to delete, passed to `onDependencyCreate` or `onDependencyDelete` before it is applied. See https://gantt.jaeungkim.com/docs/dependencies */
export interface GanttDependencyChange {
  /** The task the link starts from, which the successor's `dependencies` entry stores as `targetId`. */
  predecessorId: string;
  /** The task whose `dependencies` gains the entry, or on delete loses every entry naming `predecessorId`. */
  successorId: string;
  /** The predecessor's edge, then the successor's: `S` for start, `F` for finish, so finish-to-start is `FS`. */
  type: DependencyType;
}
