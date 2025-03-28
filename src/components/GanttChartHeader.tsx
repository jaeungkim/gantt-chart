import React from 'react';
import { useGanttStore } from 'stores/store';
import { GanttBottomRowCell, GanttTopHeaderGroup } from 'types/gantt';

interface GanttChartHeaderProps {
  topHeaderGroups: GanttTopHeaderGroup[];
  bottomRowCells: GanttBottomRowCell[];
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({
  topHeaderGroups,
  bottomRowCells,
}) => {
  const { transformedTasks, draggingTaskMeta } = useGanttStore();
  const draggingTask = transformedTasks.find(
    (t) => t.id === draggingTaskMeta?.taskId,
  );

  return (
    <div className="bg-base-200 sticky top-0 z-30">
      {/* Top Grouped Header Row */}
      <div className="flex">
        {topHeaderGroups.map((group, idx) => (
          <div
            key={idx}
            style={{ width: `${group.widthPx}px` }}
            className="border border-gray-300 p-1 text-center text-sm font-bold"
          >
            {group.label}
          </div>
        ))}
      </div>

      {/* Bottom Tick Row */}
      <div className="flex">
        {bottomRowCells.map((cell, idx) => (
          <div
            key={idx}
            style={{ width: `${cell.widthPx}px` }}
            className="relative p-1 text-center text-xs"
          >
            {cell.startDate.format('D')}
            {/* Optionally show drag range */}
            {/* {draggingTask && (
              <>
                {cell.startDate.isSame(dayjs(draggingTask.startDate), 'day') && (
                  <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-blue-500">
                    Start
                  </div>
                )}
                {cell.startDate.isSame(dayjs(draggingTask.endDate), 'day') && (
                  <div className="absolute left-1/2 -translate-x-1/2 text-[10px] text-green-500">
                    End
                  </div>
                )}
              </>
            )} */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GanttChartHeader;
