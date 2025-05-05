import { useVirtualizer } from '@tanstack/react-virtual';
import GanttBar from 'components/GanttBar.tsx';
import GanttChartHeader from 'components/GanttChartHeader.tsx';
import { GANTT_SCALE_CONFIG, NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useRef } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task } from 'types/task';
import { setupTimelineStructure } from 'utils/timeline';
import sourceTasks from '../../db.ts';

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
  ganttHeight: number | string;
  columnWidth: number | string;
}

function Gantt({ tasks, onTasksChange, ganttHeight, columnWidth }: GanttProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rawTasks = useGanttStore((state) => state.rawTasks);
  const setRawTasks = useGanttStore((state) => state.setRawTasks);
  const transformedTasks = useGanttStore((state) => state.transformedTasks);
  const setTransformedTasks = useGanttStore(
    (state) => state.setTransformedTasks,
  );
  const selectedScale = useGanttStore((state) => state.selectedScale);
  const setSelectedScale = useGanttStore((state) => state.setSelectedScale);
  const bottomRowCells = useGanttStore((state) => state.bottomRowCells);
  const setBottomRowCells = useGanttStore((state) => state.setBottomRowCells);
  const topHeaderGroups = useGanttStore((state) => state.topHeaderGroups);
  const setTopHeaderGroups = useGanttStore((state) => state.setTopHeaderGroups);

  useEffect(() => {
    if (tasks.length === 0) {
      setRawTasks(sourceTasks as Task[]);
    } else {
      setRawTasks(tasks);
    }
  }, [tasks]);

  useEffect(() => {
    if (!rawTasks.length) return;

    setupTimelineStructure(
      rawTasks,
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
      setTransformedTasks,
    );
  }, [rawTasks, selectedScale]);

  // Virtualization
  const parentRef = useRef(null);

  const rowVirtualizer = useVirtualizer({
    count: transformedTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => NODE_HEIGHT,
    overscan: 5,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: bottomRowCells.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () =>
      GANTT_SCALE_CONFIG[selectedScale].basePxPerDragStep *
      GANTT_SCALE_CONFIG[selectedScale].dragStepAmount,
    overscan: 5,
  });

  const virtualItems = columnVirtualizer.getVirtualItems();
  const visibleStartPx = virtualItems[0]?.start ?? 0;
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const visibleEndPx = lastVirtualItem
    ? lastVirtualItem.start + lastVirtualItem.size
    : 0;

  function isBarVisible(
    barLeft: number,
    barWidth: number,
    visibleStartPx: number,
    visibleEndPx: number,
  ) {
    const barRight = barLeft + barWidth;
    return barRight >= visibleStartPx && barLeft <= visibleEndPx;
  }

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'auto',
        height:
          typeof ganttHeight === 'number' ? `${ganttHeight}px` : ganttHeight,
        width:
          typeof columnWidth === 'number' ? `${columnWidth}px` : columnWidth,
        backgroundColor: '#FFF',
        fontFamily: 'Noto Sans, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#FFF',
        }}
      >
        <section
          style={{
            position: 'relative',
            display: 'flex',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '3px',
              right: '16px',
              zIndex: 50,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <select
              style={{
                padding: '4px 8px',
                fontSize: '14px',
                borderRadius: '6px',
                border: '1px solid #E6E7E9',
              }}
              value={selectedScale}
              onChange={(e) => {
                const newScale = e.target.value;
                setSelectedScale(newScale as GanttScaleKey);
              }}
            >
              {Object.keys(GANTT_SCALE_CONFIG).map((scale) => (
                <option key={scale} value={scale}>
                  {scale}
                </option>
              ))}
            </select>
          </div>

          <div
            ref={parentRef}
            className="List"
            style={{
              height: `100%`,
              width: `100%`,
              overflow: 'auto',
            }}
          >
            <GanttChartHeader
              topHeaderGroups={topHeaderGroups}
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
            />

            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: `${columnVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = transformedTasks[virtualRow.index];
                const barLeft = task.barLeft ?? 0;
                const barWidth = task.barWidth ?? 0;

                const shouldRender = isBarVisible(
                  barLeft,
                  barWidth,
                  visibleStartPx,
                  visibleEndPx,
                );

                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: `${virtualRow.size - 1}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      borderBottom: '1px solid #E6E7E9',
                    }}
                  >
                    {shouldRender && (
                      <GanttBar
                        currentTask={task}
                        onTasksChange={onTasksChange}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

export default Gantt;
