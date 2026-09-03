import { Fragment, useMemo } from "react";
import { useGanttStore } from "shared/context";
import {
  GanttBottomRowCell,
  GanttHeaderCellRenderer,
  GanttScaleKey,
} from "shared/types";
import type { GanttVirtualization } from "timeline/hooks/useGanttVirtualization";
import { mergeHeaderGroups } from "timeline/utils/header";
import { resolveFormatters } from "shared/utils/i18n";
import { createTopHeaderGroups } from "timeline/utils/geometry";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  // Chart's window; the bottom cells come from it (top groups are CSS-sticky)
  virtual: GanttVirtualization;
  // Replaces a header cell wholesale; both rows go through it
  renderHeaderCell?: GanttHeaderCellRenderer;
}

function GanttChartHeader({
  bottomRowCells,
  selectedScale,
  width,
  virtual,
  renderHeaderCell,
}: GanttChartHeaderProps) {
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const formatters = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  // Window comes from the chart, so header cells and the bars beneath cull together
  const { virtualCells, leadingCellPx } = virtual;

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

        <div className="gantt-bottom-row">
          {/* Spacer for the skipped leading cells - keeps the flex flow intact */}
          <div style={{ width: `${leadingCellPx}px` }} aria-hidden="true" />
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
