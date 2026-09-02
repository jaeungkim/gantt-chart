import { VirtualItem } from "@tanstack/react-virtual";
import GanttBar from "components/GanttBar";
import { ReactNode } from "react";
import { GanttDependencyChange } from "hooks/useGanttLinkDrag";
import { GanttBarOptions, GanttScheduling } from "types/gantt";
import {
  GanttInteractionConfig,
  isMilestoneTask,
  TaskTransformed,
} from "types/task";
import { GanttFocus } from "utils/a11y";
import { GanttRow } from "utils/grouping";

interface GanttBarsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  /** Cells before the bars on a row - the bar's column is this plus its lane */
  gridColumnCount: number;
  focus: GanttFocus;
  /** Horizontal culling, shared with the header so the two cannot disagree */
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
  options: GanttBarOptions;
  interaction: GanttInteractionConfig;
  scheduling: GanttScheduling;
  autoScrollOnDrag: boolean;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  renderBaseline?: (task: TaskTransformed) => ReactNode;
}

/** Default baseline bar - the row positions it, so a renderer never has to */
function defaultBaseline(task: TaskTransformed) {
  const milestone = isMilestoneTask(task);
  return (
    <div
      className={`gantt-baseline${milestone ? " milestone" : ""}`}
      style={{
        left: `${task.baselineLeft}px`,
        width: milestone ? undefined : `${task.baselineWidth}px`,
      }}
      aria-hidden="true"
    />
  );
}

/**
 * The bars, and the baseline snapshots behind them
 *
 * A row carries more than one bar only when tasks share a lane. The baseline is drawn
 * by the row rather than by the bar, so a drag slides the live bar across it instead
 * of taking it along.
 */
export default function GanttBarsLayer({
  rows,
  virtualItems,
  gridColumnCount,
  focus,
  isBarVisible,
  options,
  interaction,
  scheduling,
  autoScrollOnDrag,
  onDependencyCreate,
  renderBaseline,
}: GanttBarsLayerProps) {
  return virtualItems.flatMap((virtualRow) => {
    const row = rows[virtualRow.index];
    if (!row) return [];

    return row.tasks.map((task, laneIndex) => {
      if (!isBarVisible(task.barLeft ?? 0, task.barWidth ?? 0)) return null;

      const col = gridColumnCount + laneIndex;

      return (
        <div
          key={task.id}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: `${virtualRow.size - 1}px`,
            transform: `translateY(${virtualRow.start}px)`,
            display: "flex",
            alignItems: "center",
          }}
        >
          {task.baselineLeft !== undefined &&
            (renderBaseline?.(task) ?? defaultBaseline(task))}

          <GanttBar
            currentTask={task}
            options={options}
            interaction={interaction}
            scheduling={scheduling}
            autoScrollOnDrag={autoScrollOnDrag}
            onDependencyCreate={onDependencyCreate}
            tabIndex={
              focus.row === virtualRow.index && focus.col === col ? 0 : -1
            }
            cellCoord={`${virtualRow.index}:${col}`}
          />
        </div>
      );
    });
  });
}
