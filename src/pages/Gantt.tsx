import GanttChartHeader from 'components/GanttChartHeader';
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

  const selectedScale: GanttTimelineScale = 'yearly';

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
  }, [timelineGrids, taskList, selectedScale]);

  console.log('transformedTasks:', transformedTasks, 'timelineGrids:', timelineGrids);
  return (
    <div className="bg-base-50 size-full">
      <main className="relative h-[calc(100%-3rem)] w-fit p-2">
        <GanttChartHeader
          timelineGrids={timelineGrids}
          selectedScale={selectedScale}
        />
        {transformedTasks.map((task) => (
          <div
            key={task.id}
            style={{
              height: '1.5em',
              marginLeft: `${task.barLeftMargin}rem`,
              width: `${task.barWidth}rem`,
            }}
            className="bg-base-400 relative rounded-sm text-white"
          />
        ))}
      </main>
    </div>
  );
}

export default Gantt;
