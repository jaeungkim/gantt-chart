import GanttBar from "components/GanttBar";
import GanttChartHeader from "components/GanttChartHeader";
import GanttDependencyArrows from "components/GanttDependencyArrows";
import ScaleSelector from "components/ScaleSelector";
import TodayMarker from "components/TodayMarker";
import { useEffect, useRef } from "react";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useResolvedTheme } from "hooks/useResolvedTheme";
import { GanttScaleKey, GanttTheme } from "types/gantt";
import { Task } from "types/task";
import { computeTimelineData } from "utils/timeline";

/** Gantt 컴포넌트 기본값 */
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
const DEFAULT_SCALE: GanttScaleKey = "month";

export interface GanttProps {
  /** 태스크 데이터 배열 */
  tasks?: Task[];
  /** 태스크 변경 시 호출되는 콜백 */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** 차트 높이 (px 또는 CSS 값) */
  height?: number | string;
  /** 차트 너비 (px 또는 CSS 값) */
  width?: number | string;
  /** 테마 설정 - 'light', 'dark', 또는 'system' */
  theme?: GanttTheme;
  /** 기본 스케일 설정 */
  defaultScale?: GanttScaleKey;
  /** 추가 CSS 클래스명 */
  className?: string;
}

/**
 * Gantt 차트 메인 컴포넌트
 * 가상화를 사용하여 대량의 태스크를 효율적으로 렌더링
 */
function Gantt({
  tasks = [],
  onTasksChange,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  theme,
  defaultScale = DEFAULT_SCALE,
  className,
}: GanttProps) {
  // 스토어 상태 및 액션
  const {
    rawTasks,
    transformedTasks,
    bottomRowCells,
    selectedScale,
    setRawTasks,
    setTransformedTasks,
    setBottomRowCells,
    setSelectedScale,
    getTotalWidth,
  } = useGanttSelectors();

  // 스크롤 컨테이너 ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // 가상화 훅
  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    transformedTasks,
    bottomRowCells,
    scrollRef,
  });

  // 테마 훅
  const { containerClassName, dataTheme } = useResolvedTheme(
    theme,
    className ? `gantt-container ${className}` : "gantt-container"
  );

  // 초기 스케일 설정
  useEffect(() => {
    if (defaultScale && defaultScale !== selectedScale) {
      setSelectedScale(defaultScale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 태스크 데이터 동기화
  useEffect(() => {
    if (tasks.length > 0) {
      setRawTasks(tasks);
    }
  }, [tasks, setRawTasks]);

  // 타임라인 구조 설정
  useEffect(() => {
    if (!rawTasks.length) return;

    const { bottomCells, transformedTasks: transformed } = computeTimelineData(
      rawTasks,
      selectedScale
    );

    setBottomRowCells(bottomCells);
    setTransformedTasks(transformed);
  }, [rawTasks, selectedScale, setBottomRowCells, setTransformedTasks]);

  // 스케일 변경 핸들러
  const handleScaleChange = (scale: GanttScaleKey) => {
    setSelectedScale(scale);
  };

  // 전체 너비 계산
  const totalWidth = getTotalWidth();

  // 스타일 계산
  const containerStyle = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
  };

  return (
    <section
      className={containerClassName}
      data-theme={dataTheme}
      style={containerStyle}
    >
      <div className="gantt-inner">
        <section className="gantt-section">
          <ScaleSelector
            selectedScale={selectedScale}
            onScaleChange={handleScaleChange}
          />

          <div ref={scrollRef} className="gantt-list">
            <GanttChartHeader
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
              width={totalWidth}
              scrollRef={scrollRef}
            />

            <div
              className="gantt-content"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: `${totalWidth}px`,
              }}
            >
              <TodayMarker
                bottomRowCells={bottomRowCells}
                height={rowVirtualizer.getTotalSize()}
              />
              <GanttDependencyArrows transformedTasks={transformedTasks} />

              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = transformedTasks[virtualRow.index];
                const barLeft = task.barLeft ?? 0;
                const barWidth = task.barWidth ?? 0;

                return (
                  <div
                    key={task.id}
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
