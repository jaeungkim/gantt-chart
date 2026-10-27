import { GanttMoveRejection, GanttTaskMove } from "core/reorder";

export interface GanttTaskMoveApi {
  validate: (move: GanttTaskMove) => GanttMoveRejection | null;
  apply: (move: GanttTaskMove) => void;
}
