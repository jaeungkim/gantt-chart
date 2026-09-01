import GanttBar from "components/GanttBar";
import GanttChartHeader from "components/GanttChartHeader";
import GanttDependencyArrows from "components/GanttDependencyArrows";
import GanttDragGuides from "components/GanttDragGuides";
import ScaleSelector from "components/ScaleSelector";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dayjs } from "dayjs";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import { GanttHandle, useGanttScrollApi } from "hooks/useGanttScrollApi";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useResolvedTheme } from "hooks/useResolvedTheme";
import { GanttStoreContext } from "stores/context";
import {
  createGanttStore,
  DEFAULT_SCALE_STORAGE_KEY,
  readPersistedScale,
} from "stores/store";
import { NODE_HEIGHT } from "constants/gantt";
import { GanttBottomRowCell, GanttScaleKey, GanttTheme } from "types/gantt";
import { Task } from "types/task";
import dayjs from "utils/dayjs";
import {
  calculateDateOffsetPx,
  computeNonWorkingRanges,
  computeTimelineData,
  originShiftPx,
} from "utils/timeline";

/** Gantt component defaults */
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
const DEFAULT_SCALE: GanttScaleKey = "month";
/** Default tasks - kept at module scope so a new array is not created on every render */
const EMPTY_TASKS: Task[] = [];

export interface GanttProps {
  /**
   * Task data array
   *
   * Only reflected in the chart when the contents actually change. When the
   * parent passes the same data as a new array (an inline literal, a
   * non-memoized map, and so on) the update is ignored, so an edit you just
   * made by dragging is not reverted. Passing an empty array clears the chart.
   */
  tasks?: Task[];
  /** Callback invoked when tasks change */
  onTasksChange?: (updatedTasks: Task[]) => void;
  /** Chart height (px or a CSS value) */
  height?: number | string;
  /** Chart width (px or a CSS value) */
  width?: number | string;
  /** Theme setting - 'light', 'dark', or 'system' */
  theme?: GanttTheme;
  /**
   * Initial scale
   *
   * A seed value that only applies when the session has no user selection
   * stored (sessionStorage). Once the user changes the scale, that choice is
   * saved and wins on remount, and prop changes after mount are ignored
   * (the usual `default*` prop convention).
   */
  defaultScale?: GanttScaleKey;
  /** Additional CSS class name */
  className?: string;
  /** Whether to shade weekends/holidays (default true) */
  showNonWorkingDays?: boolean;
  /** Holiday list (ISO date strings, e.g. '2026-01-01') */
  holidays?: string[];
  /** Custom non-working-day predicate - replaces the default weekend/holiday check when given */
  isNonWorkingDay?: (date: Dayjs) => boolean;
  /**
   * sessionStorage key the scale selection is stored under (default `"gantt-scale"`)
   *
   * With more than one chart on a page, give them different keys so each
   * remembers its own scale. Sharing one key means the last change made
   * applies to both.
   */
  storageKey?: string;
  /**
   * Position to scroll to once, after the first render
   *
   * `"today"` moves to today, a date string to that date. Later data updates
   * do not touch the scroll position.
   */
  initialScrollTo?: "today" | string;
}

/**
 * Gantt chart component
 *
 * Creates a store per instance and hands it down through context.
 * (With a module singleton, two charts on one page would share state and
 * overwrite each other)
 */
const Gantt = forwardRef<GanttHandle, GanttProps>(function Gantt(props, ref) {
  const storageKey = props.storageKey ?? DEFAULT_SCALE_STORAGE_KEY;
  const [store] = useState(() => createGanttStore(storageKey));

  return (
    <GanttStoreContext.Provider value={store}>
      <GanttChart {...props} forwardedRef={ref} />
    </GanttStoreContext.Provider>
  );
});

/**
 * Renders the actual chart
 * Uses virtualization to render large numbers of tasks efficiently
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
  initialScrollTo,
  forwardedRef,
}: GanttProps & { forwardedRef: React.ForwardedRef<GanttHandle> }) {
  // Store state and actions
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

  // Scroll container ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // Virtualization hook
  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    transformedTasks,
    bottomRowCells,
    scrollRef,
  });

  // Theme hook
  const { containerClassName, dataTheme } = useResolvedTheme(
    theme,
    className ? `gantt-container ${className}` : "gantt-container"
  );

  // Initial scale - a user selection saved in the session wins over defaultScale
  // (once, on mount. defaultScale is only a seed, so later changes are ignored)
  useEffect(() => {
    setSelectedScale(readPersistedScale(storageKey) ?? defaultScale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot of the task data last applied from props
  const syncedTasksRef = useRef<string | null>(null);

  // Sync the task data
  // Overwrite the store only when the contents changed, not when the array identity did.
  // A re-render where the parent passes the same data as a new array is ignored, so drag
  // edits are not reverted; when the data really differs (an empty array included) the
  // prop wins.
  // (The comparison is one serialization - it only runs when the tasks array identity
  //  changes. If there are so many tasks that this cost matters, memoize tasks in the parent)
  useEffect(() => {
    const snapshot = JSON.stringify(tasks);
    if (snapshot === syncedTasksRef.current) return;

    syncedTasksRef.current = snapshot;
    setRawTasks(tasks);
  }, [tasks, setRawTasks]);

  // Cells of the previous timeline - used to compute how far the origin moved and compensate the scroll
  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);

  // Build the timeline structure (clears to an empty timeline when there are no tasks)
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks: transformed } = computeTimelineData(
      rawTasks,
      selectedScale
    );

    // When the timeline start date changes, every bar shifts as a whole.
    // (Dragging the earliest task changes min(startDate), which moves the origin)
    // Only the compensation amount is recorded here - raising scrollLeft before the
    // content gets wider makes the browser clamp it to the maximum at that moment,
    // so the actual adjustment happens below.
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
    // Clear the drag offsets now that the new positions are ready - avoids a one-frame flicker on drop
    clearAllDragOffsets();
  }, [
    rawTasks,
    selectedScale,
    setBottomRowCells,
    setTransformedTasks,
    clearAllDragOffsets,
  ]);

  // Apply the scroll compensation after the new timeline width has landed in the DOM
  useLayoutEffect(() => {
    const shift = pendingScrollShiftRef.current;
    if (!shift) return;

    pendingScrollShiftRef.current = 0;
    const scrollEl = scrollRef.current;
    if (scrollEl) scrollEl.scrollLeft += shift;
  }, [bottomRowCells]);

  // Scale change handler
  const handleScaleChange = (scale: GanttScaleKey) => {
    setSelectedScale(scale);
  };

  // Today marker offset (null when today is outside the timeline range)
  const todayOffsetPx = useMemo(
    () => calculateDateOffsetPx(dayjs(), bottomRowCells, selectedScale),
    [bottomRowCells, selectedScale]
  );
  // Compute the non-working-day shading ranges
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

  // Imperative scroll API
  const scrollApi = useGanttScrollApi({
    scrollRef,
    bottomRowCells,
    transformedTasks,
    selectedScale,
    rowHeight: NODE_HEIGHT,
  });
  useImperativeHandle(forwardedRef, () => scrollApi, [scrollApi]);

  // initialScrollTo is applied once, when the timeline first becomes ready
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialScrollRef.current || !initialScrollTo) return;
    if (!bottomRowCells.length) return;

    didInitialScrollRef.current = true;
    const target = initialScrollTo === "today" ? dayjs() : initialScrollTo;
    scrollApi.scrollToDate(target, { smooth: false });
  }, [initialScrollTo, bottomRowCells, scrollApi]);

  // Total width
  const totalWidth = getTotalWidth();

  // Computed styles
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
      {/* Toolbar */}
      <div className="gantt-toolbar">
        <ScaleSelector
          selectedScale={selectedScale}
          onScaleChange={handleScaleChange}
        />
      </div>

      {/* Main chart area */}
      <div className="gantt-main">
        <div ref={scrollRef} className="gantt-scroll-container">
          {/* Drag guides (run through everything, header included) */}
          <GanttDragGuides width={totalWidth} />

          {/* Header */}
          <div className="gantt-header-wrapper" style={{ width: `${totalWidth}px` }}>
            <GanttChartHeader
              bottomRowCells={bottomRowCells}
              selectedScale={selectedScale}
              width={totalWidth}
              scrollRef={scrollRef}
            />
          </div>

          {/* Content area */}
          <div
            className="gantt-content"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: `${totalWidth}px`,
            }}
          >
            {/* Non-working-day shading */}
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

            {/* Task rows (background) */}
            <div className="gantt-rows">
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const task = transformedTasks[virtualRow.index];
                return (
                  <div
                    key={`row-${task.id}`}
                    className="gantt-task-row"
                    style={{
                      // border-box, so the 1px border is inside the height - matches the row spacing exactly
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  />
                );
              })}
            </div>

            {/* Today marker */}
            {todayOffsetPx !== null && (
              <div
                className="gantt-today-marker"
                style={{ left: `${todayOffsetPx}px` }}
                aria-hidden="true"
              />
            )}

            {/* Dependency arrows */}
            <GanttDependencyArrows transformedTasks={transformedTasks} />

            {/* Task bars */}
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
