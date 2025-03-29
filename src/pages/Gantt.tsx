import GanttChartHeader from 'components/GanttChartHeader';
import { GANTT_SCALE_CONFIG, NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useRef, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task } from 'types/task';
import { setupTimelineStructure } from 'utils/timeline';
import { tasks as sourceTasks } from '../../db.json';
import GanttBar from './GanttBar';

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
}

function Gantt({ tasks, onTasksChange }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    rawTasks,
    transformedTasks,
    selectedScale,
    setSelectedScale,
    bottomRowCells,
    topHeaderGroups,
    setRawTasks,
    setBottomRowCells,
    setTopHeaderGroups,
    setMinDate,
    setMaxDate,
  } = useGanttStore();

  useEffect(() => {
    if (tasks.length === 0) {
      setTaskList(sourceTasks as Task[]);
    } else {
      setTaskList(tasks);
    }
  }, [tasks]);

  useEffect(() => {
    if (!taskList.length) return;

    const taskRecord = Object.fromEntries(
      taskList.map((task) => [
        task.id,
        { startDate: task.startDate, endDate: task.endDate },
      ]),
    );

    setupTimelineStructure(
      taskRecord,
      selectedScale,
      setMinDate,
      setMaxDate,
      setBottomRowCells,
      setTopHeaderGroups,
    );
  }, [taskList, selectedScale]);

  useEffect(() => {
    if (!bottomRowCells.length || !taskList.length) return;
    if (rawTasks.length === 0) {
      setRawTasks(taskList);
    }
  }, [bottomRowCells, taskList]);

  return (
    <div className="bg-base-50 h-full w-full overflow-hidden">
      <section className="relative flex h-full w-full flex-col">
        {/* Dropdown */}
        <div className="fixed top-2 right-4 z-40">
          <select
            className="bg-base-100 rounded-md px-2 py-1 text-sm font-medium"
            value={selectedScale}
            onChange={(e) => {
              const newScale = e.target.value;
              setSelectedScale(newScale as GanttScaleKey);
            }}
          >
            {Object.keys(GANTT_SCALE_CONFIG).map((scale) => (
              <option key={scale} value={scale}>
                {GANTT_SCALE_CONFIG[scale as GanttScaleKey].labelUnit}
              </option>
            ))}
          </select>
        </div>

        {/* Shared scroll container */}
        <div ref={scrollRef} className="grow overflow-x-auto">
          <div className="flex min-w-max flex-col">
            {/* Header */}
            <GanttChartHeader
              topHeaderGroups={topHeaderGroups}
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
              scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
            />

            {/* Bars */}
            <div className="relative flex">
              <div className="flex grow flex-col">
                {transformedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="border-base-300 bg-base-100 flex w-full items-center border-b border-solid"
                    style={{ height: `${NODE_HEIGHT}px` }}
                  >
                    <GanttBar
                      allTasks={transformedTasks}
                      currentTask={task}
                      onTasksChange={onTasksChange}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Gantt;
