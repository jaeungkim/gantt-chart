import GanttChartHeader from 'components/GanttChartHeader';
import { NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttTimelineScale } from 'types/gantt';
import { Task } from 'types/task';
import { setupTimelineGrids } from 'utils/timeline';
import GanttBar from './GanttBar';

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
}

function Gantt({ tasks, onTasksChange }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const selectedScale: GanttTimelineScale = 'monthly';

  const {
    rawTasks,
    transformedTasks,
    timelineGrids,
    setRawTasks,
    setTimelineGrids,
    setMinDate,
    setMaxDate,
  } = useGanttStore();

  // 1. If no tasks, fetch from local server for dev/demo
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

    setupTimelineGrids(
      taskRecord,
      selectedScale,
      setMinDate,
      setMaxDate,
      setTimelineGrids,
    );
  }, [taskList, selectedScale]);

  useEffect(() => {
    if (!timelineGrids.length || !taskList.length) return;

    // Initialize rawTasks and transform if not already
    if (rawTasks.length === 0) {
      setRawTasks(taskList);
    }
  }, [timelineGrids, taskList]);

  return (
    <div className="bg-base-50 h-full w-fit">
      <section className="relative flex flex-col p-2">
        <GanttChartHeader
          timelineGrids={timelineGrids}
          selectedScale={selectedScale}
        />
        <div className="relative grow">
          {transformedTasks.map((task) => (
            <div
              key={task.id}
              className="border-base-300 bg-base-100 flex w-full items-center border-b border-solid"
              style={{ height: `${NODE_HEIGHT}rem` }}
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
