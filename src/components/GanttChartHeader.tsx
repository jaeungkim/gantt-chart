import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import React from 'react';
import { useGanttStore } from 'stores/store';
import { GanttBottomRowCell, GanttTopHeaderGroup } from 'types/gantt';

interface GanttChartHeaderProps {
  topHeaderGroups: GanttTopHeaderGroup[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: string;
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({
  bottomRowCells,
  topHeaderGroups, // unused in this new logic
}) => {
  const { selectedScale, transformedTasks, draggingTaskMeta } = useGanttStore();
  const draggingTask = transformedTasks.find(
    (t) => t.id === draggingTaskMeta?.taskId,
  );

  const config = GANTT_SCALE_CONFIG[selectedScale];
  const labelUnit = config.labelUnit;

  // Dynamically group top headers based on scale
  const groupedHeaderCells: { label: string; width: number }[] = [];
  let currentKey = '';
  let currentLabel = '';
  let currentWidth = 0;

  bottomRowCells.forEach((cell, i) => {
    const key = cell.startDate.startOf(labelUnit).format('YYYY-MM-DD');
    const label = config.formatHeaderLabel
      ? config.formatHeaderLabel(cell.startDate)
      : '';
    const width = cell.widthPx;

    if (key === currentKey) {
      currentWidth += width;
    } else {
      if (currentKey) {
        groupedHeaderCells.push({ label: currentLabel, width: currentWidth });
      }
      currentKey = key;
      currentLabel = label;
      currentWidth = width;
    }

    if (i === bottomRowCells.length - 1) {
      groupedHeaderCells.push({ label: currentLabel, width: currentWidth });
    }
  });

  return (
    <div className="bg-base-200 sticky top-0 z-30">
      {/* Top Header Group Row */}
      <div className="flex">
        {groupedHeaderCells.map((group, idx) => (
          <div
            key={idx}
            style={{ width: `${group.width}px` }}
            className="border border-gray-300 p-1 text-center text-sm font-bold"
          >
            {group.label}
          </div>
        ))}
      </div>

      {/* Bottom Row */}
      <div className="flex">
        {bottomRowCells.map((cell, idx) => {
          const tickLabel = config.formatTickLabel?.(cell.startDate) || ''; // <- use this
          return (
            <div
              key={idx}
              style={{ width: `${cell.widthPx}px` }}
              className="relative p-1 text-center text-xs"
            >
              {tickLabel}

              {/* Optional: Show Dragging Start/End Indicators */}
              {/* {draggingTaskMeta && draggingTask && (
              <>
                {draggingTaskMeta.type !== 'right' &&
                  cell.startDate.isSame(draggingTask.startDate, 'day') && (
                    <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-blue-300 px-2 py-1 text-[10px] shadow">
                      {draggingTask.startDate.slice(0, 10)}
                    </div>
                  )}

                {draggingTaskMeta.type !== 'left' &&
                  cell.startDate.isSame(draggingTask.endDate, 'day') && (
                    <div className="absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded bg-green-300 px-2 py-1 text-[10px] shadow">
                      {draggingTask.endDate.slice(0, 10)}
                    </div>
                  )}
              </>
            )} */}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttChartHeader;
