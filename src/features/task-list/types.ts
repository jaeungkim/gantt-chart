import { GanttMoveRejection, GanttTaskMove } from "core/reorder";

export interface GanttTaskMoveApi {
  // Whether a move would be refused, and why - runs on every frame of a row drag
  validate: (move: GanttTaskMove) => GanttMoveRejection | null;
  // Applies a move
  apply: (move: GanttTaskMove) => void;
}
