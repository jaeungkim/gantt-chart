import GanttChartHeader from 'components/GanttChartHeader';
import { NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttScaleKey } from 'types/gantt';
import { Task } from 'types/task';
import { setupTimelineStructure } from 'utils/timeline';
import GanttBar from './GanttBar';

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
}

function Gantt({ tasks, onTasksChange }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const selectedScale: GanttScaleKey = 'month';

  const {
    rawTasks,
    transformedTasks,
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
      fetch('http://localhost:3001/tasks')
        .then((res) => res.json())
        .then((data: Task[]) => setTaskList(data))
        .catch((error) => console.error('Failed to load tasks:', error));
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
    <div className="bg-base-50 h-full w-fit">
      <section className="relative flex flex-col p-2">
        <GanttChartHeader
          topHeaderGroups={topHeaderGroups}
          bottomRowCells={bottomRowCells}
        />
        <div className="relative grow">
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
      </section>
    </div>
  );
}

export default Gantt;
