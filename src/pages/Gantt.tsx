import GanttChartHeader from 'components/GanttChartHeader';
import { NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useRef, useState } from 'react';
import { useGanttStore } from 'stores/store';
import { Task } from 'types/task';
import { setupTimelineStructure } from 'utils/timeline';
import { tasks as sourceTasks } from '../../db.json';
import GanttBar from './GanttBar';

interface GanttProps {
  tasks: Task[];
  onTasksChange?: (updatedTasks: Task[]) => void;
  ganttHeight: number;
  columnWidth: number;
}

function Gantt({ tasks, onTasksChange, ganttHeight, columnWidth }: GanttProps) {
  const [ganttHeightState, setGanttHeight] = useState(ganttHeight || 500);
  const [columnWidthState, setColumnWidth] = useState(columnWidth || 1000);
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
    <section
      style={{
        position: 'relative',
        overflow: 'auto',
        height: `${ganttHeightState}px`,
        width: '100%', // let parent control width
        backgroundColor: '#FFF',
      }}
    >
      <div
        // className="size-full overflow-hidden"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: '#FFF',
        }}
      >
        <section
          // className="relative flex h-full w-full flex-col"
          style={{
            position: 'relative',
            display: 'flex',
            height: '100%',
            width: '100%',
            flexDirection: 'column',
          }}
        >
          {/* <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              padding: '4px 8px',
              backgroundColor: '#FFF',
              borderBottom: '1px solid #E6E7E9',
            }}
          >
            <select
              style={{
                backgroundColor: '#FFF',
                padding: '4px 8px',
                fontSize: '0.875rem',
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
                  {GANTT_SCALE_CONFIG[scale as GanttScaleKey].labelUnit}
                </option>
              ))}
            </select>
          </div> */}
          {/* Shared scroll container */}
          <div
            ref={scrollRef}
            // className="grow overflow-x-auto"
            style={{
              flexGrow: 1,
              overflowX: 'auto',
            }}
          >
            <div
              // className="flex min-w-max flex-col"
              style={{
                display: 'flex',
                minWidth: 'max-content',
                flexDirection: 'column',
                // backgroundColor: '#FFF',
              }}
            >
              {/* Header */}
              <GanttChartHeader
                topHeaderGroups={topHeaderGroups}
                bottomRowCells={bottomRowCells}
                selectedScale={selectedScale}
                scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
              />

              {/* Bars */}
              <div
                // className="relative flex"
                style={{
                  position: 'relative',
                  display: 'flex',
                }}
              >
                <div
                  // className="flex grow flex-col"
                  style={{
                    display: 'flex',
                    flexGrow: 1,
                    flexDirection: 'column',
                  }}
                >
                  {transformedTasks.map((task) => (
                    <div
                      key={task.id}
                      // className="flex w-full items-center border-b border-solid"
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        borderBottom: '1px solid #E6E7E9',
                        height: `${NODE_HEIGHT}px`,
                        backgroundColor: '#FFF',
                      }}
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
    </section>
  );
}

export default Gantt;
