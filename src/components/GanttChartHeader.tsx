import { Dayjs } from 'dayjs';
import React from 'react';
import { GanttTimelineGrid, GanttTimelineScale } from 'types/gantt';

interface DetailedCell {
  date: Dayjs;
  width: number;
}

/**
 * Subdivide each timeline grid cell into detailed cells.
 * - For weekly scale (timeUnit: 'day', gridInterval: 3): subdivide into 3 cells (each representing one day).
 * - For yearly scale (timeUnit: 'month', gridInterval: 2): subdivide into 2 cells (each representing one month).
 * - For monthly scale (timeUnit: 'month', gridInterval: 1): no subdivision (one cell per month).
 */
function createDetailedCells(
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): DetailedCell[] {
  const detailedCells: DetailedCell[] = [];
  if (selectedScale === 'weekly') {
    // Each grid cell covers 3 days.
    const subdivisions = 3;
    timelineGrids.forEach((grid) => {
      const cellWidth = grid.gridWidthInRem / subdivisions;
      for (let i = 0; i < subdivisions; i++) {
        detailedCells.push({
          date: grid.date.add(i, 'day'),
          width: cellWidth,
        });
      }
    });
  } else if (selectedScale === 'yearly') {
    // Each grid cell covers 2 months.
    const subdivisions = 2;
    timelineGrids.forEach((grid) => {
      const cellWidth = grid.gridWidthInRem / subdivisions;
      for (let i = 0; i < subdivisions; i++) {
        detailedCells.push({
          date: grid.date.add(i, 'month'),
          width: cellWidth,
        });
      }
    });
  } else {
    // Monthly scale: each grid cell is one month.
    timelineGrids.forEach((grid) => {
      detailedCells.push({
        date: grid.date,
        width: grid.gridWidthInRem,
      });
    });
  }
  return detailedCells;
}

interface GroupedCell {
  key: string;
  cells: DetailedCell[];
  width: number;
}

/**
 * Group detailed cells for the top row.
 * - For weekly scale, group by "MMM YYYY" (e.g. "May 2024").
 * - For monthly and yearly scales, group by "YYYY".
 */
function groupDetailedCells(
  cells: DetailedCell[],
  selectedScale: GanttTimelineScale,
): GroupedCell[] {
  const groups: GroupedCell[] = [];
  cells.forEach((cell) => {
    const key =
      selectedScale === 'weekly'
        ? cell.date.format('MMM YYYY')
        : cell.date.format('YYYY');
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.cells.push(cell);
      existing.width += cell.width;
    } else {
      groups.push({
        key,
        cells: [cell],
        width: cell.width,
      });
    }
  });
  return groups;
}

interface GanttChartHeaderProps {
  timelineGrids: GanttTimelineGrid[];
  selectedScale: GanttTimelineScale;
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({
  timelineGrids,
  selectedScale,
}) => {
  // Build detailed cells (bottom row) based on the selected scale.
  const detailedCells = createDetailedCells(timelineGrids, selectedScale);
  // Group detailed cells for the top row.
  const groupedCells = groupDetailedCells(detailedCells, selectedScale);

  return (
    <div className="bg-base-200 sticky top-0 z-30">
      {/* Top Row: Grouped cells */}
      <div className="flex">
        {groupedCells.map((group, idx) => (
          <div
            key={idx}
            style={{ width: `${group.width}rem` }}
            className="border border-gray-300 p-1 text-center text-sm font-bold"
          >
            {group.key}
          </div>
        ))}
      </div>
      {/* Bottom Row: Detailed cells */}
      <div className="flex">
        {detailedCells.map((cell, idx) => {
          let label = '';
          if (selectedScale === 'weekly') {
            // For weekly scale, show day number.
            label = cell.date.format('D');
          } else {
            // For monthly and yearly scales, show month abbreviation.
            label = cell.date.format('MMM');
          }
          return (
            <div
              key={idx}
              style={{ width: `${cell.width}rem` }}
              className="border border-gray-300 p-1 text-center text-xs"
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttChartHeader;
