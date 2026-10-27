import { useMemo } from "react";
import {
  GanttBottomRowCell,
  GanttLocaleOptions,
  GanttScaleKey,
} from "shared/types";
import type { GanttVirtualization } from "features/timeline/types";
import { resolveFormatters } from "shared/utils/i18n";
import { createTopHeaderGroups } from "features/timeline/utils/geometry";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  virtual: GanttVirtualization;
  localeOptions?: GanttLocaleOptions;
}

function GanttChartHeader({
  bottomRowCells,
  selectedScale,
  width,
  virtual,
  localeOptions,
}: GanttChartHeaderProps) {
  const formatters = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );

  const { virtualCells, leadingCellPx } = virtual;

  const topGroups = useMemo(
    () => createTopHeaderGroups(bottomRowCells, selectedScale, localeOptions),
    [bottomRowCells, selectedScale, localeOptions]
  );

  return (
    <header className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
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

        <div className="gantt-bottom-row">
          <div style={{ width: `${leadingCellPx}px` }} />
          {virtualCells.map((virtualCell) => {
            const cell = bottomRowCells[virtualCell.index];
            if (!cell) return null;

            return (
              <div
                key={`bottom-${virtualCell.index}`}
                className="gantt-bottom-cell"
                style={{ width: `${virtualCell.size}px` }}
              >
                {formatters.tick(cell.startDate)}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default GanttChartHeader;
