import { useVirtualizer } from "@tanstack/react-virtual";
import GanttBar from "components/GanttBar.tsx";
import GanttChartHeader from "components/GanttChartHeader.tsx";
import GanttDependencyArrows from "components/GanttDependencyArrows.tsx";
import { GANTT_SCALE_CONFIG, NODE_HEIGHT } from "constants/gantt";
import { useEffect, useRef } from "react";
import { useGanttStore } from "stores/store";
import { GanttScaleKey } from "types/gantt";
import { Task } from "types/task";
import { setupTimelineStructure } from "utils/timeline";
import sourceTasks from "../../db.ts";

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
  ganttHeight: number | string;
  columnWidth: number | string;
}

function Gantt({ tasks, onTasksChange, ganttHeight, columnWidth }: GanttProps) {
  const rawTasks = useGanttStore((state) => state.rawTasks);
  const setRawTasks = useGanttStore((state) => state.setRawTasks);
  const transformedTasks = useGanttStore((state) => state.transformedTasks);
  const setTransformedTasks = useGanttStore(
    (state) => state.setTransformedTasks
  );
  const selectedScale = useGanttStore((state) => state.selectedScale);
  const setSelectedScale = useGanttStore((state) => state.setSelectedScale);
  const bottomRowCells = useGanttStore((state) => state.bottomRowCells);
  const setBottomRowCells = useGanttStore((state) => state.setBottomRowCells);
  const topHeaderGroups = useGanttStore((state) => state.topHeaderGroups);
  const setTopHeaderGroups = useGanttStore((state) => state.setTopHeaderGroups);
  const getTotalWidth = useGanttStore((state) => state.getTotalWidth);

  useEffect(() => {
    if (tasks.length === 0) {
      setRawTasks(sourceTasks as Task[]);
    } else {
      setRawTasks(tasks);
    }
  }, [tasks, setRawTasks]);

  // Setup timeline structure when rawTasks or scale changes
  useEffect(() => {
    if (!rawTasks.length) return;

    setupTimelineStructure(
      rawTasks,
      selectedScale,
      setBottomRowCells,
      setTopHeaderGroups,
      setTransformedTasks
    );
  }, [
    rawTasks,
    selectedScale,
    setBottomRowCells,
    setTopHeaderGroups,
    setTransformedTasks,
  ]);

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);

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
    estimateSize: (index) => bottomRowCells[index]?.widthPx ?? 32,
    overscan: 5,
  });

  // Get visible items and calculate dimensions
  const virtualItems = columnVirtualizer.getVirtualItems();
  const visibleStartPx = virtualItems[0]?.start ?? 0;
  const lastVirtualItem = virtualItems[virtualItems.length - 1];
  const visibleEndPx = lastVirtualItem
    ? lastVirtualItem.start + lastVirtualItem.size
    : 0;
  const totalWidth = getTotalWidth();
  const visibleRowIndexes = rowVirtualizer
    .getVirtualItems()
    .map((item) => item.index);

  // Optimized visibility check function
  function isBarVisible(barLeft: number, barWidth: number) {
    const barRight = barLeft + barWidth;
    return barRight >= visibleStartPx && barLeft <= visibleEndPx;
  }

  // Measure column virtualizer when cells change
  useEffect(() => {
    if (!bottomRowCells.length) return;

    const id = requestAnimationFrame(() => {
      columnVirtualizer.measure();
    });

    return () => cancelAnimationFrame(id);
  }, [bottomRowCells, columnVirtualizer]);

  const handleScaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedScale(e.target.value as GanttScaleKey);
  };

  return (
    <section
      className="gantt-container"
      style={{
        height:
          typeof ganttHeight === "number" ? `${ganttHeight}px` : ganttHeight,
        width:
          typeof columnWidth === "number" ? `${columnWidth}px` : columnWidth,
      }}
    >
      <div className="gantt-inner">
        <section className="gantt-section">
          {/* Scale selector */}
          <div className="gantt-scale-selector">
            <select
              className="gantt-scale-select"
              value={selectedScale}
              onChange={handleScaleChange}
            >
              {Object.keys(GANTT_SCALE_CONFIG).map((scale) => (
                <option key={scale} value={scale}>
                  {scale}
                </option>
              ))}
            </select>
          </div>

          <div ref={parentRef} className="gantt-list">
            <GanttChartHeader
              topHeaderGroups={topHeaderGroups}
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
              width={totalWidth}
              scrollRef={parentRef}
            />

            <div
              className="gantt-content"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: `${totalWidth}px`,
              }}
            >
              <GanttDependencyArrows
                transformedTasks={transformedTasks}
                visibleRowIndexes={visibleRowIndexes}
              />

              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = transformedTasks[virtualRow.index];
                const barLeft = task.barLeft ?? 0;
                const barWidth = task.barWidth ?? 0;

                return (
                  <div
                    key={virtualRow.index}
                    className="gantt-task-row"
                    style={{
                      height: `${virtualRow.size - 1}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {isBarVisible(barLeft, barWidth) && (
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
