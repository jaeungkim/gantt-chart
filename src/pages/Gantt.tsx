import { useEffect, useState } from 'react';
import {
  GanttTimelineGrid,
  GanttTimelineScale,
  Task,
  TaskTransformed,
} from 'types/gantt';
import dayjs from 'utils/dayjs';
import { setupTimelineGrids } from 'utils/timeline';
import { transformTasks } from 'utils/transformData'; // assuming you have this!

interface GanttProps {
  tasks: Task[];
}

function Gantt({ tasks }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const [timelineGrids, setTimelineGrids] = useState<GanttTimelineGrid[]>([]);
  const [transformedTasks, setTransformedTasks] = useState<TaskTransformed[]>(
    [],
  );
  const [minDate, setMinDate] = useState(dayjs());
  const [maxDate, setMaxDate] = useState(dayjs());

  const selectedScale: GanttTimelineScale = 'monthly'; // or from props

  // 1. Fetch tasks if not provided (demo mode)
  useEffect(() => {
    if (tasks.length === 0) {
      fetch('http://localhost:3001/tasks')
        .then((res) => res.json())
        .then((data: Task[]) => setTaskList(data))
        .catch((error) => console.error('Failed to load tasks:', error));
    }
  }, [tasks]);

  // 2. Setup timeline grids when taskList or selectedScale changes
  useEffect(() => {
    if (!taskList.length) return;

    // Convert array of tasks to a record/object map for setupTimelineGrids
    const taskRecord: Record<string, { startDate: string; endDate: string }> =
      Object.fromEntries(
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

  // 3. Transform tasks when timelineGrids are ready
  useEffect(() => {
    if (!timelineGrids.length || !taskList.length) return;

    const transformed = transformTasks(taskList, timelineGrids, selectedScale);
    setTransformedTasks(transformed);
    console.log(transformed);
  }, [timelineGrids, taskList, selectedScale]);

  return (
    <div className="bg-base-50 size-full">
      <p>Gantt Header</p>

      <main className="relative h-[calc(100%-3rem)] w-full p-2">
        <p>Gantt Toolbar</p>

        <div
          className="border-base-200 relative flex h-[calc(100%-2.625rem)] overflow-auto border border-solid"
          id="timeline-container"
        >
          <p>Gantt Left Sidebar</p>

          <div className="h-fit flex-1">
            <div className="bg-base-200 sticky top-0 z-30 flex items-center">
              <p>Gantt Timeline Header</p>
            </div>

            <div>
              {/* Example of rendering tasks */}
              {transformedTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    marginLeft: `${task.barLeftMargin}rem`,
                    width: `${task.barWidth}rem`,
                    marginTop: `${task.depth * 1.5}rem`,
                  }}
                  className="relative rounded bg-blue-500 p-1 text-white"
                >
                  {task.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        <p>Gantt Detail</p>
      </main>
    </div>
  );
}

export default Gantt;
