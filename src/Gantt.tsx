import GanttChartHeader from "features/timeline/components/GanttChartHeader";
import GanttDependencyArrows from "features/dependencies/components/GanttDependencyArrows";
import GanttDragGuides from "features/bars/components/GanttDragGuides";
import GanttGridSplitter from "features/task-list/components/GanttGridSplitter";
import GanttTaskAddRow from "features/task-list/components/GanttTaskAddRow";
import {
  GanttTodayDot,
  GanttTodayLine,
} from "features/timeline/components/GanttTodayLine";
import GanttTaskGrid from "features/task-list/components/GanttTaskGrid";
import GanttBarsLayer from "features/bars/components/GanttBarsLayer";
import GanttHolidayLabels from "features/timeline/components/GanttHolidayLabels";
import GanttNonWorkingLayer from "features/timeline/components/GanttNonWorkingLayer";
import GanttRowsLayer from "features/rows/components/GanttRowsLayer";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGanttCollapse } from "features/rows/hooks/useGanttCollapse";
import {
  defaultTaskDraft,
  useGanttDrawCreate,
} from "features/bars/hooks/useGanttDrawCreate";
import { useGanttRowModel } from "features/rows/hooks/useGanttRowModel";
import { useGanttSelectors } from "./useGanttSelectors";
import { useGanttSelection } from "features/selection/hooks/useGanttSelection";
import GanttDetailPanel from "features/detail/components/GanttDetailPanel";
import { useGanttDetail } from "features/detail/hooks/useGanttDetail";
import { useGanttDetailSlide } from "features/detail/hooks/useGanttDetailSlide";
import { useGanttScrollApi } from "features/timeline/hooks/useGanttScrollApi";
import { useGanttTaskMove } from "features/task-list/hooks/useGanttTaskMove";
import { useGanttVirtualization } from "features/timeline/hooks/useGanttVirtualization";
import { useGanttInitialScroll } from "features/timeline/hooks/useGanttInitialScroll";
import { useGanttRangeExtension } from "features/timeline/hooks/useGanttRangeExtension";
import { useGanttRangeReport } from "features/timeline/hooks/useGanttRangeReport";
import { useGanttScaleReport } from "features/timeline/hooks/useGanttScaleReport";
import { useGanttTimelineSync } from "features/timeline/hooks/useGanttTimelineSync";
import { useGanttWheelZoom } from "features/timeline/hooks/useGanttWheelZoom";
import { useResolvedTheme } from "shared/hooks/useResolvedTheme";
import { GanttStoreContext, useGanttStore } from "shared/context";
import { createGanttStore, snapshotTasks } from "shared/store";
import { DEFAULT_GRID_WIDTH, resolveGeometry } from "shared/constants";
import {
  canCreateTasks,
  GanttInteractionConfig,
  Task,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import { CALENDAR_DAYS, createWorkingCalendar } from "core/calendar";
import type { Dayjs } from "dayjs";
import {
  calculateDateOffsetPx,
  computeNonWorkingRanges,
  OFF_DAY_KEY,
  type NonWorkingDay,
} from "features/timeline/utils/geometry";
import { resolveFormatters } from "shared/utils/i18n";
import { indexHolidays } from "shared/utils/holidays";
import { GanttHandle, GanttProps } from './props';

const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
// Module scope so a new array is not created on every render
const EMPTY_TASKS: Task[] = [];

/** Gantt chart component. Creates a store per instance, so two charts on one page cannot share state. */
const Gantt = forwardRef<GanttHandle, GanttProps>(function Gantt(props, ref) {
  const [store] = useState(() => createGanttStore(props.defaultScale));

  return (
    <GanttStoreContext.Provider value={store}>
      <GanttChart {...props} forwardedRef={ref} />
    </GanttStoreContext.Provider>
  );
});

function GanttChart(
  props: GanttProps & { forwardedRef: React.ForwardedRef<GanttHandle> }
) {
  const {
    tasks = EMPTY_TASKS,
    onTasksChange,
    height = DEFAULT_HEIGHT,
    width = DEFAULT_WIDTH,
    rowHeight,
    barHeight,
    theme,
    className,
    style,
    showNonWorkingDays = true,
    workingWeekdays,
    holidays,
    initialScrollTo,
    visibleStart,
    visibleEnd,
    locale,
    formats,
    firstDayOfWeek,
    showTaskList = false,
    showRowNumbers = false,
    hierarchy = false,
    collapsedIds,
    defaultCollapsedIds,
    onCollapsedChange,
    workingCalendar = false,
    allowReorder,
    onTaskMove,
    onDependencyCreate,
    onDependencyDelete,
    onTaskCreate,
    onTaskClick,
    onTaskDoubleClick,
    onTaskSelect,
    selectable,
    renderDetail,
    showDetail,
    detailTaskId,
    onDetailChange,
    showTooltip,
    zoomOnWheel = false,
    infiniteScroll = false,
    onRangeChange,
    onScaleChange,
    autoScrollOnDrag = true,
    forwardedRef,
  } = props;

  const {
    rawTasks,
    transformedTasks,
    bottomRowCells,
    selectedScale,
    syncTasksFromProps,
  } = useGanttSelectors();

  // undefined while nothing is set, so built-in labels are used without an Intl formatter
  const localeOptions = useMemo(
    () =>
      locale === undefined &&
      formats === undefined &&
      firstDayOfWeek === undefined
        ? undefined
        : { locale, formats, firstDayOfWeek },
    [locale, formats, firstDayOfWeek]
  );

  // One scroll container, so vertical scrolling and virtualization are shared
  const scrollRef = useRef<HTMLDivElement>(null);

  const interaction: GanttInteractionConfig = props;

  const geometry = useMemo(
    () => resolveGeometry(rowHeight, barHeight),
    [rowHeight, barHeight]
  );

  const [taskListWidth, setTaskListWidth] = useState(DEFAULT_GRID_WIDTH);
  // Timeline px the pane covers; scroll and zoom math subtracts it so `scrollToDate` clears it
  const paneInset = showTaskList ? taskListWidth : 0;

  const collapse = useGanttCollapse({
    collapsedIds,
    defaultCollapsedIds,
    onCollapsedChange,
  });

  const { rows, tasks: rowTasks } = useGanttRowModel({
    rawTasks,
    tasks: transformedTasks,
    hierarchy,
    collapsedIds: collapse.collapsedIds,
  });

  // The link drag resolves its drop target by arithmetic, so it needs every row, culled ones included
  const setRowTasks = useGanttStore((store) => store.setRowTasks);
  useLayoutEffect(() => {
    setRowTasks(rowTasks);
  }, [rowTasks, setRowTasks]);

  const virtual = useGanttVirtualization({
    rowCount: rows.length,
    bottomRowCells,
    scrollRef,
    geometry,
  });

  const extension = useGanttRangeExtension({
    enabled: infiniteScroll,
    scrollRef,
    selectedScale,
    bottomRowCells,
    totalWidth: virtual.totalWidth,
    viewportInsetPx: paneInset,
    pinnedStart: !!visibleStart,
    pinnedEnd: !!visibleEnd,
  });

  const move = useGanttTaskMove({
    hierarchy,
    interaction,
    onTasksChange,
    onTaskMove,
    onExpand: collapse.expand,
  });

  // The grip holds a slot on every row, so a per-task grip does not jog that row's text
  const reorderEnabled = useMemo(
    () =>
      allowReorder === true ||
      rawTasks.some((task) => task.allowReorder === true),
    [allowReorder, rawTasks]
  );

  // One "non-working" definition chart-wide, so shaded days and drag-skipped days cannot drift
  const holidayIndex = useMemo(() => indexHolidays(holidays), [holidays]);
  const workweek = useMemo(
    () =>
      createWorkingCalendar({
        workingWeekdays,
        holidays: holidayIndex.dates,
      }),
    [workingWeekdays, holidayIndex]
  );
  // A holiday landing on a weekend still answers as itself - it is the one with a name to write
  const nonWorkingDayAt = useCallback(
    (date: Dayjs): NonWorkingDay | null => {
      if (workweek.isWorkingDay(date)) return null;
      return (
        holidayIndex.byDate.get(date.format("YYYY-MM-DD")) ?? { key: OFF_DAY_KEY }
      );
    },
    [workweek, holidayIndex]
  );

  // Off, it counts every day, which is plain calendar arithmetic
  const calendar = workingCalendar ? workweek : CALENDAR_DAYS;

  // A renderer turns the panel on; `showDetail` is the explicit override
  const detailEnabled = showDetail ?? renderDetail !== undefined;

  const select = useGanttSelection({
    // The panel turns selection on unless the host has said otherwise
    selectable: selectable ?? (detailEnabled ? true : undefined),
    onTaskSelect,
  });

  const detail = useGanttDetail({
    enabled: detailEnabled,
    tasks: transformedTasks,
    detailTaskId,
    onDetailChange,
  });

  const openDetail = detail.open;
  // Opening the panel, a click still selects and reaches the host first
  const activateTask = useCallback(
    (task: TaskTransformed, event: React.MouseEvent) => {
      onTaskClick?.(task, event);
      select(task);
      openDetail(task.id);
    },
    [onTaskClick, select, openDetail]
  );

  // Retains the last task so the body stays rendered while the panel slides shut
  const slide = useGanttDetailSlide(detail.task);

  const barOptions = useMemo(
    () => ({
      onTasksChange,
      onTaskActivate: activateTask,
      onTaskDoubleClick,
      showTooltip,
      tooltip: resolveFormatters(selectedScale, localeOptions).tooltip,
    }),
    [
      onTasksChange,
      activateTask,
      onTaskDoubleClick,
      showTooltip,
      selectedScale,
      localeOptions,
    ]
  );

  const canCreateTask = onTaskCreate !== undefined && canCreateTasks(interaction);
  const { onDrawPointerDown, consumeDrawClick, ghost } = useGanttDrawCreate({
    enabled: canCreateTask,
    rowCount: rows.length,
    onTaskCreate,
    geometry,
  });

  // Click version of the drawn range, off exactly where the drawn one is off
  const proposeTask = useCallback(() => {
    if (!canCreateTask) return;
    const draft = defaultTaskDraft(dayjs(), bottomRowCells, selectedScale);
    if (draft) onTaskCreate?.(draft);
  }, [canCreateTask, bottomRowCells, selectedScale, onTaskCreate]);

  const resolvedTheme = useResolvedTheme(theme);

  const syncedTasksRef = useRef<string | symbol | null>(null);

  // Overwrite the store only when the contents changed, not when the array identity did,
  // so a parent re-render passing the same data under a new identity does not revert drag edits
  useEffect(() => {
    const snapshot = snapshotTasks(tasks);
    if (snapshot === syncedTasksRef.current) return;

    syncedTasksRef.current = snapshot;
    // Compares again inside, so a controlled host echoing back onTasksChange is not a replacement
    syncTasksFromProps(tasks);
  }, [tasks, syncTasksFromProps]);

  // Fixed timeline window - undefined on both ends means auto-fit to the tasks
  const visibleRange = useMemo(
    () =>
      visibleStart || visibleEnd
        ? {
            start: visibleStart ? dayjs(visibleStart) : undefined,
            end: visibleEnd ? dayjs(visibleEnd) : undefined,
          }
        : undefined,
    [visibleStart, visibleEnd]
  );

  const zoomTo = useGanttTimelineSync({
    rawTasks,
    selectedScale,
    visibleRange,
    hierarchy,
    extension,
    scrollRef,
    bottomRowCells,
    syncWindow: virtual.syncWindow,
  });

  useGanttWheelZoom({
    enabled: zoomOnWheel,
    scrollRef,
    selectedScale,
    bottomRowCells,
    viewportInsetPx: paneInset,
    zoomTo,
  });

  useGanttRangeReport(bottomRowCells, selectedScale, onRangeChange);
  useGanttScaleReport(selectedScale, onScaleChange);

  const todayPx = useMemo(
    () => calculateDateOffsetPx(dayjs(), bottomRowCells, selectedScale),
    [bottomRowCells, selectedScale]
  );

  const nonWorkingRanges = useMemo(() => {
    if (!showNonWorkingDays) return [];
    return computeNonWorkingRanges(
      bottomRowCells,
      selectedScale,
      nonWorkingDayAt
    );
  }, [showNonWorkingDays, nonWorkingDayAt, bottomRowCells, selectedScale]);

  const scrollApi = useGanttScrollApi({
    scrollRef,
    bottomRowCells,
    transformedTasks: rowTasks,
    selectedScale,
    viewportInsetPx: paneInset,
    zoomTo,
    geometry,
  });
  useImperativeHandle(
    forwardedRef,
    () => ({
      ...scrollApi,
      openDetail: detail.open,
      closeDetail: detail.close,
      addTask: proposeTask,
    }),
    [scrollApi, detail.open, detail.close, proposeTask]
  );

  useGanttInitialScroll(initialScrollTo, bottomRowCells, scrollApi);

  // Empty timeline clears the selection; a click on a bar has a different target
  const handleContentClick = (event: React.MouseEvent) => {
    if (consumeDrawClick() || event.target !== event.currentTarget) return;
    select(null);
    detail.close();
  };


  const containerStyle = {
    ...style,
    height: style?.height ?? (typeof height === "number" ? `${height}px` : height),
    width: style?.width ?? (typeof width === "number" ? `${width}px` : width),
    // How far the pinned task list reaches in; left-pinned timeline content offsets by this
    "--gantt-pane-inset": `${paneInset}px`,
    // Row height as a token, so CSS keeps the row pitch without a second copy of the number
    "--gantt-row-height": `${geometry.rowHeight}px`,
  } as React.CSSProperties;
  const timelineStyle = { width: `${virtual.totalWidth}px` };

  return (
    <section
      className={className ? `gantt-container ${className}` : "gantt-container"}
      data-theme={resolvedTheme}
      style={containerStyle}
    >
      <div className="gantt-layout">
        <div className="gantt-main">
          <div ref={scrollRef} className="gantt-scroll-container">
            <div className="gantt-body">
              {showTaskList && (
                <GanttTaskGrid
                  rows={rows}
                  virtualItems={virtual.virtualRows}
                  totalHeight={virtual.totalHeight}
                  width={taskListWidth}
                  showRowNumbers={showRowNumbers}
                  hierarchy={hierarchy}
                  collapsedIds={collapse.collapsedIds}
                  onToggleCollapse={collapse.toggle}
                  onRowClick={activateTask}
                  onRowDoubleClick={onTaskDoubleClick}
                  reorderEnabled={reorderEnabled}
                  interaction={interaction}
                  move={move}
                />
              )}

              <div className="gantt-timeline" style={timelineStyle}>
                <div className="gantt-header-wrapper" style={timelineStyle}>
                  <GanttChartHeader
                    bottomRowCells={bottomRowCells}
                    selectedScale={selectedScale}
                    width={virtual.totalWidth}
                    virtual={virtual}
                    localeOptions={localeOptions}
                  />

                  <GanttHolidayLabels ranges={nonWorkingRanges} />
                  <GanttDragGuides localeOptions={localeOptions} />
                  <GanttTodayDot leftPx={todayPx} />
                </div>

                <div
                  className={`gantt-content${canCreateTask ? " drawable" : ""}`}
                  style={{
                    // one blank row under the last, so a draw can start once rows fill the viewport
                    height: `${virtual.totalHeight + (canCreateTask ? geometry.rowHeight : 0)}px`,
                    width: `${virtual.totalWidth}px`,
                  }}
                  onPointerDown={onDrawPointerDown}
                  onClick={handleContentClick}
                >
                  <GanttNonWorkingLayer ranges={nonWorkingRanges} />

                  <GanttRowsLayer
                    rows={rows}
                    virtualItems={virtual.virtualRows}
                  />

                  <GanttTodayLine leftPx={todayPx} />

                  {ghost && (
                    <div
                      className="gantt-draw-ghost"
                      style={{
                        left: `${ghost.leftPx}px`,
                        width: `${ghost.widthPx}px`,
                        // Same geometry as the bar this becomes, centred in the row
                        height: `${geometry.barHeight}px`,
                        marginTop: `${(geometry.rowHeight - geometry.barHeight) / 2}px`,
                        transform: `translateY(${ghost.topPx}px)`,
                      }}
                    />
                  )}

                  <GanttDependencyArrows
                    transformedTasks={rowTasks}
                    virtual={virtual}
                    interaction={interaction}
                    onTasksChange={onTasksChange}
                    onDependencyDelete={onDependencyDelete}
                    geometry={geometry}
                  />

                  <GanttBarsLayer
                    rows={rows}
                    virtualItems={virtual.virtualRows}
                    isBarVisible={virtual.isBarVisible}
                    options={barOptions}
                    interaction={interaction}
                    calendar={calendar}
                    autoScrollOnDrag={autoScrollOnDrag}
                    onDependencyCreate={onDependencyCreate}
                    geometry={geometry}
                  />
                </div>
              </div>
            </div>
          </div>

          {showTaskList && (
            // Outside the scroll container to stay pinned to the pane edge
            <GanttGridSplitter
              width={taskListWidth}
              onWidthChange={setTaskListWidth}
            />
          )}

          {showTaskList && canCreateTask && (
            // Out here for the splitter's reasons
            <GanttTaskAddRow width={taskListWidth} onAdd={proposeTask} />
          )}
        </div>

        {slide.task && (
          // The panel is a flex sibling, so the timeline narrows instead of being covered and
          // scroll measurements stay correct
          <GanttDetailPanel
            task={slide.task}
            tasks={transformedTasks}
            scale={selectedScale}
            tooltip={barOptions.tooltip}
            interaction={interaction}
            onClose={detail.close}
            onTasksChange={onTasksChange}
            render={renderDetail}
            open={slide.open}
          />
        )}
      </div>
    </section>
  );
}

export default Gantt;
