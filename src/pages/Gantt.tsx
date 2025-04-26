import GanttBar from 'components/GanttBar.tsx';
import GanttChartHeader from 'components/GanttChartHeader';
import { GANTT_SCALE_CONFIG, NODE_HEIGHT } from 'constants/gantt';
import { useEffect, useRef, useState } from 'react';
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
  const [taskList, setTaskList] = useState<Task[]>(tasks || []);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rawTasks = useGanttStore((state) => state.rawTasks);
  const setRawTasks = useGanttStore((state) => state.setRawTasks);
  const transformedTasks = useGanttStore((state) => state.transformedTasks);
  const selectedScale = useGanttStore((state) => state.selectedScale);
  const setSelectedScale = useGanttStore((state) => state.setSelectedScale);
  const bottomRowCells = useGanttStore((state) => state.bottomRowCells);
  const setBottomRowCells = useGanttStore((state) => state.setBottomRowCells);
  const topHeaderGroups = useGanttStore((state) => state.topHeaderGroups);
  const setTopHeaderGroups = useGanttStore((state) => state.setTopHeaderGroups);

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
      setBottomRowCells,
      setTopHeaderGroups,
    );
  }, [rawTasks, taskList, selectedScale]);

  useEffect(() => {
    if (!bottomRowCells.length || !taskList.length) return;
    if (rawTasks.length === 0) {
      console.log('2', taskList);
      setRawTasks(taskList);
    }
  }, [bottomRowCells, taskList]);

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
                  {GANTT_SCALE_CONFIG[scale as GanttScaleKey].labelUnit}
                </option>
              ))}
            </select>
          </div>

          <div
            ref={scrollRef}
            style={{
              flexGrow: 1,
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                minWidth: 'max-content',
                flexDirection: 'column',
              }}
            >
              <GanttChartHeader
                topHeaderGroups={topHeaderGroups}
                bottomRowCells={bottomRowCells}
                selectedScale={selectedScale}
                scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
              />

              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexGrow: 1,
                    flexDirection: 'column',
                  }}
                >
                  {transformedTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        borderBottom: '1px solid #E6E7E9',
                        height: `${NODE_HEIGHT - 1}px`,
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
