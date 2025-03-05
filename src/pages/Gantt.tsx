import { useEffect, useState } from 'react';
import { Task } from 'types/gantt';

interface GanttProps {
  tasks: Task[];
}

function Gantt({ tasks }: GanttProps) {
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);

  // TODO: just for demo purposes
  useEffect(() => {
    if (tasks.length === 0) {
      fetch('http://localhost:3001/tasks')
        .then((res) => res.json())
        .then((data) => setTaskList(data))
        .catch((error) => console.error('Failed to load tasks:', error));
    }
  }, [tasks]);

  console.log('taskList', taskList);
  return (
    <div className="bg-base-50 size-full">
      <p>gantt header</p>
      <main className="relative h-[calc(100%-3rem)] w-full p-2">
        <p>gantt toolbar</p>
        <div
          className="border-base-200 relative flex h-[calc(100%-2.625rem)] overflow-auto border border-solid"
          id="timeline-container"
        >
          <p>gant left side bar</p>

          <div
            className="h-fit flex-1"
            // style={{ width: timelineWidth }}
          >
            <div
              className="bg-base-200 sticky top-0 z-30 flex items-center"
              // style={headerStyle}
            >
              <p>gant timeline header</p>
            </div>
            <p> ganttboard</p>
          </div>
        </div>
        <p>gantt detail</p>
      </main>
    </div>
  );
}

export default Gantt;
