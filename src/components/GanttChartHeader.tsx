import { useGanttColumnVirtualization } from "hooks/useGanttVirtualization";
import React, { Fragment, useMemo } from "react";
import { useGanttStore } from "stores/context";
import {
  GanttBottomRowCell,
  GanttHeaderCellRenderer,
  GanttScaleKey,
} from "types/gantt";
import { mergeHeaderGroups } from "utils/headerUtils";
import { resolveFormatters } from "utils/i18n";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  /** Scroll container used to virtualize the bottom time cells (pinning the top group labels is done with CSS sticky) */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Replaces a header cell wholesale - both rows go through it */
  renderHeaderCell?: GanttHeaderCellRenderer;
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
  renderHeaderCell,
}: GanttChartHeaderProps) {
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const formatters = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

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
      mergeHeaderGroups(
        createTopHeaderGroups(bottomRowCells, selectedScale, localeOptions)
      ),
    [bottomRowCells, selectedScale, localeOptions]
  );

  return (
    <header className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* Top header groups */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {topGroups.map((group, idx) => {
              const cellProps = {
                className: "gantt-top-group",
                style: { width: `${group.widthPx}px` },
              };

              return renderHeaderCell ? (
                <Fragment key={`${group.label}-${idx}`}>
                  {renderHeaderCell({
                    row: "top",
                    date: group.startDate,
                    label: group.label,
                    width: group.widthPx,
                    scale: selectedScale,
                    cellProps,
                  })}
                </Fragment>
              ) : (
                <div key={`${group.label}-${idx}`} {...cellProps}>
                  <p className="gantt-top-group-label">{group.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom time cells (visible area only) */}
        <div className="gantt-bottom-row">
          {/* Width of the skipped leading cells - pushed out with a spacer to leave the flex flow intact */}
          <div style={{ width: `${leadingPx}px` }} aria-hidden="true" />
          {virtualCells.map((virtualCell) => {
            const cell = bottomRowCells[virtualCell.index];
            if (!cell) return null;

            const tickLabel = formatters.tick(cell.startDate);
            const cellProps = {
              className: "gantt-bottom-cell",
              style: { width: `${virtualCell.size}px` },
            };

            return renderHeaderCell ? (
              <Fragment key={`bottom-${virtualCell.index}`}>
                {renderHeaderCell({
                  row: "bottom",
                  date: cell.startDate,
                  label: tickLabel,
                  width: virtualCell.size,
                  scale: selectedScale,
                  cellProps,
                })}
              </Fragment>
            ) : (
              <div key={`bottom-${virtualCell.index}`} {...cellProps}>
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
