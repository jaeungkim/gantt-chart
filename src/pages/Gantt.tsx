import GanttBar from "components/GanttBar";
import GanttChartHeader from "components/GanttChartHeader";
import GanttDependencyArrows from "components/GanttDependencyArrows";
import GanttDragGuides from "components/GanttDragGuides";
import ScaleSelector from "components/ScaleSelector";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Dayjs } from "dayjs";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useResolvedTheme } from "hooks/useResolvedTheme";
import { GanttStoreContext } from "stores/context";
import {
  createGanttStore,
  DEFAULT_SCALE_STORAGE_KEY,
  readPersistedScale,
} from "stores/store";
import { GanttBottomRowCell, GanttScaleKey, GanttTheme } from "types/gantt";
import { Task } from "types/task";
import dayjs from "utils/dayjs";
import {
  calculateDateOffsetPx,
  computeNonWorkingRanges,
  computeTimelineData,
  originShiftPx,
} from "utils/timeline";

/** Gantt 컴포넌트 기본값 */
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
const DEFAULT_SCALE: GanttScaleKey = "month";
/** 기본 tasks - 매 렌더 새 배열이 생기지 않도록 모듈 스코프에 고정 */
const EMPTY_TASKS: Task[] = [];

export interface GanttProps {
  /**
   * 태스크 데이터 배열
   *
   * 내용이 실제로 바뀔 때만 차트에 반영된다. 부모가 같은 데이터를 새 배열로
   * 다시 넘기는 경우(인라인 리터럴, 비메모 map 등)에는 무시되므로 드래그로
   * 방금 편집한 결과가 되돌아가지 않는다. 빈 배열을 넘기면 차트가 비워진다.
   */
  tasks?: Task[];
  /** 태스크 변경 시 호출되는 콜백 */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** 차트 높이 (px 또는 CSS 값) */
  height?: number | string;
  /** 차트 너비 (px 또는 CSS 값) */
  width?: number | string;
  /** 테마 설정 - 'light', 'dark', 또는 'system' */
  theme?: GanttTheme;
  /**
   * 초기 스케일 설정
   *
   * 세션에 저장된 사용자 선택(sessionStorage)이 없을 때만 적용되는 시드 값이다.
   * 사용자가 스케일을 바꾸면 그 선택이 저장되어 리마운트 시 우선하며,
   * 마운트 이후의 prop 변경은 무시된다 (`default*` prop 관례).
   */
  defaultScale?: GanttScaleKey;
  /** 추가 CSS 클래스명 */
  className?: string;
  /** 주말/휴일 음영 표시 여부 (기본 true) */
  showNonWorkingDays?: boolean;
  /** 휴일 목록 (ISO 날짜 문자열, 예: '2026-01-01') */
  holidays?: string[];
  /** 비근무일 판별 커스텀 함수 - 지정 시 기본 주말/휴일 판별을 대체 */
  isNonWorkingDay?: (date: Dayjs) => boolean;
  /**
   * 스케일 선택을 저장할 sessionStorage 키 (기본 `"gantt-scale"`)
   *
   * 한 페이지에 차트를 두 개 이상 두면 서로 다른 키를 주어야 각자의 스케일을
   * 따로 기억한다. 같은 키를 공유하면 마지막에 바꾼 값이 양쪽에 적용된다.
   */
  storageKey?: string;
}

/**
 * Gantt 차트 컴포넌트
 *
 * 인스턴스마다 독립된 스토어를 만들어 컨텍스트로 내려준다.
 * (모듈 싱글턴이면 한 페이지의 두 차트가 상태를 공유해 서로를 덮어쓴다)
 */
function Gantt(props: GanttProps) {
  const storageKey = props.storageKey ?? DEFAULT_SCALE_STORAGE_KEY;
  const [store] = useState(() => createGanttStore(storageKey));

  return (
    <GanttStoreContext.Provider value={store}>
      <GanttChart {...props} />
    </GanttStoreContext.Provider>
  );
}

/**
 * 실제 차트 렌더링
 * 가상화를 사용하여 대량의 태스크를 효율적으로 렌더링
 */
function GanttChart({
  tasks = EMPTY_TASKS,
  onTasksChange,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  theme,
  defaultScale = DEFAULT_SCALE,
  className,
  showNonWorkingDays = true,
  holidays,
  isNonWorkingDay,
  storageKey = DEFAULT_SCALE_STORAGE_KEY,
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
    clearAllDragOffsets,
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

  // 초기 스케일 설정 - 세션에 저장된 사용자 선택이 있으면 그 값이 defaultScale보다 우선
  // (마운트 시 1회만. defaultScale은 시드일 뿐이라 이후 변경은 무시한다)
  useEffect(() => {
    setSelectedScale(readPersistedScale(storageKey) ?? defaultScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 프롭으로 받아 마지막으로 반영한 태스크 데이터의 스냅샷
  const syncedTasksRef = useRef<string | null>(null);

  // 태스크 데이터 동기화
  // 배열 identity가 아니라 내용이 바뀌었을 때만 스토어를 덮어쓴다.
  // 부모가 같은 데이터를 새 배열로 다시 넘기는 리렌더는 무시되므로 드래그 편집이
  // 되돌아가지 않고, 데이터가 실제로 달라지면(빈 배열 포함) 프롭이 이긴다.
  // (비교는 직렬화 1회 - tasks 배열 identity가 바뀔 때만 돈다. 태스크 수가
  //  아주 많아 이 비용이 문제가 되면 부모에서 tasks를 memo 하면 된다)
  useEffect(() => {
    const snapshot = JSON.stringify(tasks);
    if (snapshot === syncedTasksRef.current) return;

    syncedTasksRef.current = snapshot;
    setRawTasks(tasks);
  }, [tasks, setRawTasks]);

  // 직전 타임라인의 셀 - 원점 이동량을 계산해 스크롤을 보정하는 데 쓴다
  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);

  // 타임라인 구조 설정 (태스크가 비면 빈 타임라인으로 정리)
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks: transformed } = computeTimelineData(
      rawTasks,
      selectedScale
    );

    // 타임라인 시작일이 바뀌면 모든 바가 통째로 밀린다.
    // (가장 이른 태스크를 드래그하면 min(startDate)가 바뀌어 원점이 이동한다)
    // 여기서는 보정량만 기록한다 - 콘텐츠가 넓어지기 전에 scrollLeft를 올리면
    // 브라우저가 그 시점의 최대값으로 잘라버리기 때문에 실제 적용은 아래에서.
    const prevCells = prevCellsRef.current;
    if (prevCells.length && bottomCells.length) {
      pendingScrollShiftRef.current += originShiftPx(
        prevCells,
        bottomCells,
        selectedScale
      );
    }
    prevCellsRef.current = bottomCells;

    setBottomRowCells(bottomCells);
    setTransformedTasks(transformed);
    // 새 위치가 준비된 시점에 드래그 오프셋 정리 - 드롭 시 한 프레임 깜빡임 방지
    clearAllDragOffsets();
  }, [
    rawTasks,
    selectedScale,
    setBottomRowCells,
    setTransformedTasks,
    clearAllDragOffsets,
  ]);

  // 새 타임라인 너비가 DOM에 반영된 뒤에 스크롤 보정을 적용한다
  useLayoutEffect(() => {
    const shift = pendingScrollShiftRef.current;
    if (!shift) return;

    pendingScrollShiftRef.current = 0;
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.scrollLeft += shift;
  }, [bottomRowCells]);

  // 스케일 변경 핸들러
  const handleScaleChange = (scale: GanttScaleKey) => {
    setSelectedScale(scale);
  };

  // 오늘 마커 오프셋 (타임라인 범위 밖이면 null)
  const todayOffsetPx = useMemo(
    () => calculateDateOffsetPx(dayjs(), bottomRowCells, selectedScale),
    [bottomRowCells, selectedScale]
  );
  // 비근무일 음영 범위 계산
  const nonWorkingRanges = useMemo(() => {
    if (!showNonWorkingDays) return [];

    const holidaySet = new Set(holidays);
    const isOffDay =
      isNonWorkingDay ??
      ((date: Dayjs) => {
        const dayOfWeek = date.day();
        return (
          dayOfWeek === 0 ||
          dayOfWeek === 6 ||
          holidaySet.has(date.format("YYYY-MM-DD"))
        );
      });

    return computeNonWorkingRanges(bottomRowCells, selectedScale, isOffDay);
  }, [
    showNonWorkingDays,
    holidays,
    isNonWorkingDay,
    bottomRowCells,
    selectedScale,
  ]);

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
      {/* 툴바 */}
      <div className="gantt-toolbar">
        <ScaleSelector
          selectedScale={selectedScale}
          onScaleChange={handleScaleChange}
        />
      </div>

      {/* 메인 차트 영역 */}
      <div className="gantt-main">
        <div ref={scrollRef} className="gantt-scroll-container">
          {/* 드래그 가이드 (헤더 포함 전체 관통) */}
          <GanttDragGuides width={totalWidth} />

          {/* 헤더 */}
          <div className="gantt-header-wrapper" style={{ width: `${totalWidth}px` }}>
            <GanttChartHeader
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
              width={totalWidth}
              scrollRef={scrollRef}
            />
          </div>

          {/* 콘텐츠 영역 */}
          <div
            className="gantt-content"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: `${totalWidth}px`,
            }}
          >
            {/* 비근무일 음영 */}
            {nonWorkingRanges.length > 0 && (
              <div className="gantt-non-working-layer" aria-hidden="true">
                {nonWorkingRanges.map((range) => (
                  <div
                    key={range.left}
                    className="gantt-non-working-range"
                    style={{
                      left: `${range.left}px`,
                      width: `${range.width}px`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* 태스크 행 (배경) */}
            <div className="gantt-rows">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = transformedTasks[virtualRow.index];
                return (
                  <div
                    key={`row-${task.id}`}
                    className="gantt-task-row"
                    style={{
                      // border-box라 1px 보더가 높이 안에 포함된다 - 행 간격과 정확히 일치
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              })}
            </div>

            {/* 오늘 마커 */}
            {todayOffsetPx !== null && (
              <div
                className="gantt-today-marker"
                style={{ left: `${todayOffsetPx}px` }}
                aria-hidden="true"
              />
            )}

            {/* 의존성 화살표 */}
            <GanttDependencyArrows transformedTasks={transformedTasks} />

            {/* 태스크 바 */}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const task = transformedTasks[virtualRow.index];
              const barLeft = task.barLeft ?? 0;
              const barWidth = task.barWidth ?? 0;

              if (!isBarVisible(barLeft, barWidth)) return null;

              return (
                <div
                  key={task.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: `${virtualRow.size - 1}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <GanttBar
                    currentTask={task}
                    onTasksChange={onTasksChange}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Gantt;
