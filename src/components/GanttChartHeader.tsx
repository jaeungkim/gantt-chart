import { Dayjs } from 'dayjs';
import React from 'react';
import { useGanttStore } from 'stores/store';
import { GanttTimelineGrid, GanttTimelineScale } from 'types/gantt';
import dayjs from 'utils/dayjs';

interface DetailedCell {
  date: Dayjs;
  width: number;
}

function createDetailedCells(
  timelineGrids: GanttTimelineGrid[],
  selectedScale: GanttTimelineScale,
): DetailedCell[] {
  const detailedCells: DetailedCell[] = [];
  if (selectedScale === 'weekly') {
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
  const detailedCells = createDetailedCells(timelineGrids, selectedScale);
  const groupedCells = groupDetailedCells(detailedCells, selectedScale);

  const { transformedTasks, draggingTaskMeta } = useGanttStore();
  const draggingTask = transformedTasks.find(
    (t) => t.id === draggingTaskMeta?.taskId,
  );

  return (
    <div className="bg-base-200 sticky top-0 z-30">
      {/* Top Grouped Row */}
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

      {/* Bottom Detailed Cells Row */}
      <div className="flex">
        {detailedCells.map((cell, idx) => {
          const label =
            selectedScale === 'weekly'
              ? cell.date.format('D')
              : cell.date.format('MMM');

          return (
            <div
              key={idx}
              style={{ width: `${cell.width}rem` }}
              className="relative border border-gray-300 p-1 text-center text-xs"
            >
              {label}
              {dayjs(draggingTask?.startDate).format('DD')}
              {dayjs(draggingTask?.endDate).format('DD')}
              {/* {showStartDate && (
                <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-blue-300 px-2 py-1 text-[10px] shadow">
                  {dayjs(draggingTask.startDate).format('YYYY-MM-DD')}
                </div>
              )}
              {showEndDate && (
                <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-green-300 px-2 py-1 text-[10px] shadow">
                  {dayjs(draggingTask.endDate).format('YYYY-MM-DD')}
                </div>
              )} */}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttChartHeader;
