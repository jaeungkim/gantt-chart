import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useGanttColumnVirtualization } from "hooks/useGanttVirtualization";
import React, { useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { mergeHeaderGroups } from "utils/headerUtils";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  /** Scroll container used to virtualize the bottom time cells (pinning the top group labels is done with CSS sticky) */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Gantt chart header component
 * Renders the top group labels and the bottom time cells
 */
function GanttChartHeader({
  bottomRowCells,
  selectedScale,
  width,
  scrollRef,
}: GanttChartHeaderProps) {
  const config = GANTT_SCALE_CONFIG[selectedScale];

  // The bottom cells are column-virtualized - a long range at day scale runs to thousands of cells
  // (the top groups are a handful of merged labels, so they are rendered as-is)
  const { columnVirtualizer } = useGanttColumnVirtualization({
    bottomRowCells,
    scrollRef,
  });
  const virtualCells = columnVirtualizer.getVirtualItems();
  const leadingPx = virtualCells[0]?.start ?? 0;

  // Build and merge the header groups (memoized)
  const topGroups = useMemo(
    () =>
      mergeHeaderGroups(createTopHeaderGroups(bottomRowCells, selectedScale)),
    [bottomRowCells, selectedScale]
  );

  return (
    <header className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* Top header groups */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {topGroups.map((group, idx) => (
              <div
                key={`${group.label}-${idx}`}
                className="gantt-top-group"
                style={{ width: `${group.widthPx}px` }}
              >
                <p className="gantt-top-group-label">{group.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom time cells (visible area only) */}
        <div className="gantt-bottom-row">
          {/* Width of the skipped leading cells - pushed out with a spacer to leave the flex flow intact */}
          <div style={{ width: `${leadingPx}px` }} aria-hidden="true" />
          {virtualCells.map((virtualCell) => {
            const cell = bottomRowCells[virtualCell.index];
            if (!cell) return null;

            const tickLabel = config.formatTickLabel?.(cell.startDate) || "";

            return (
              <div
                key={`bottom-${virtualCell.index}`}
                className="gantt-bottom-cell"
                style={{ width: `${virtualCell.size}px` }}
              >
                {tickLabel}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default GanttChartHeader;
