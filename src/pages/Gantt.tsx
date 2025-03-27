import GanttChartHeader from 'components/GanttChartHeader';
import { NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { GanttTimelineScale } from 'types/gantt';
import { Task } from 'types/task';
import { setupTimelineGrids } from 'utils/timeline';
import GanttBar from './GanttBar';

interface GanttProps {
  tasks: Task[]; // raw tasks from the outside world
  onTasksChange?: (updatedTasks: Task[]) => void; // callback for final changes
}

function Gantt({ tasks, onTasksChange }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const selectedScale: GanttTimelineScale = 'monthly';

  const {
    rawTasks, // current raw tasks in Zustand store
    tasks: transformedTasks, // derived tasks used for rendering
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

  // 2. Create timeline grid after we have tasks
  useEffect(() => {
    if (!taskList.length) return;

    // We'll pass only the date range for setting up timeline
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

  // 3. Initialize rawTasks once timelineGrids are ready
  useEffect(() => {
    if (!timelineGrids.length || !taskList.length) return;

    // Only set rawTasks if store is empty
    if (rawTasks.length === 0) {
      setRawTasks(taskList);

      // Optionally emit these tasks initially
      if (onTasksChange) {
        onTasksChange(taskList);
      }
    }
  }, [timelineGrids, taskList]);

  // 4. Whenever rawTasks changes, we can log or emit
  //   But be careful, it might happen every drag *frame*
  //   If you only want final changes, rely on the drag-end hooks
  useEffect(() => {
    if (onTasksChange) {
      onTasksChange(rawTasks);
    }
    console.log('[🔁 Gantt] rawTasks changed:', rawTasks);
  }, [onTasksChange]);

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
