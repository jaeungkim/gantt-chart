import type { VirtualItem } from "shared/virtual/window";
import GanttBar from "bars/components/GanttBar";
import { GanttDependencyChange } from "dependencies/hooks/useGanttLinkDrag";
import { GanttBarOptions } from "shared/types";
import type { WorkingCalendar } from "../../core";
import { GanttInteractionConfig } from "shared/task";
import { GanttFocus } from "interaction/utils/a11y";
import { GanttRow } from "rows/utils/rows";

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
  /** Working-day calendar - drag results snap forward off non-working days */
  calendar?: WorkingCalendar;
  autoScrollOnDrag: boolean;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
}

// One bar per lane.
export default function GanttBarsLayer({
  rows,
  virtualItems,
  gridColumnCount,
  focus,
  isBarVisible,
  options,
  interaction,
  calendar,
  autoScrollOnDrag,
  onDependencyCreate,
}: GanttBarsLayerProps) {
  return virtualItems.flatMap((virtualRow) => {
    const row = rows[virtualRow.index];
    if (!row) return [];

    return row.tasks.map((task, laneIndex) => {
      if (!isBarVisible(task.barLeft, task.barWidth)) return null;

      const col = gridColumnCount + laneIndex;

      return (
        // styles.css lifts this wrapper's z-index while its bar has a tooltip or is being
        // dragged; any opaque stacking context here would trap the subtree (test-guarded).
        <div
          key={task.id}
          className="gantt-bar-wrap"
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
          <GanttBar
            currentTask={task}
            options={options}
            interaction={interaction}
            calendar={calendar}
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
