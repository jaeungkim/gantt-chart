import GanttChartHeader from "timeline/components/GanttChartHeader";
import GanttDependencyArrows from "dependencies/components/GanttDependencyArrows";
import GanttDragGuides from "bars/components/GanttDragGuides";
import GanttGridSplitter from "task-list/components/GanttGridSplitter";
import GanttTaskAddRow from "task-list/components/GanttTaskAddRow";
import { GanttTodayLine } from "timeline/components/GanttTodayLine";
import GanttTaskGrid from "task-list/components/GanttTaskGrid";
import GanttBarsLayer from "bars/components/GanttBarsLayer";
import GanttNonWorkingLayer from "timeline/components/GanttNonWorkingLayer";
import GanttRowsLayer from "rows/components/GanttRowsLayer";
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
import { useGanttCollapse } from "rows/hooks/useGanttCollapse";
import {
  defaultTaskDraft,
  useGanttDrawCreate,
} from "bars/hooks/useGanttDrawCreate";
import { useGanttInteraction } from "interaction/hooks/useGanttInteraction";
import { useGanttKeyboardNav } from "interaction/hooks/useGanttKeyboardNav";
import { useGanttRowModel } from "rows/hooks/useGanttRowModel";
import { useGanttSelectors } from "./useGanttSelectors";
import { useGanttSelection } from "interaction/hooks/useGanttSelection";
import GanttDetailPanel from "detail/components/GanttDetailPanel";
import { useGanttDetail } from "detail/hooks/useGanttDetail";
import { GanttHandle, useGanttScrollApi } from "timeline/hooks/useGanttScrollApi";
import { useGanttTaskListPane } from "task-list/hooks/useGanttTaskListPane";
import { useGanttTaskMove } from "task-list/hooks/useGanttTaskMove";
import { useGanttVirtualization } from "timeline/hooks/useGanttVirtualization";
import {
  useGanttInitialScroll,
  useGanttRangeExtension,
  useGanttRangeReport,
  useGanttScaleReport,
  useGanttTimelineSync,
  useGanttWheelZoom,
} from "timeline/hooks/useGanttViewport";
import { useResolvedTheme } from "shared/hooks/useResolvedTheme";
import { GanttStoreContext, useGanttStore } from "shared/context";
import { createGanttStore } from "shared/store";
import { BAR_HEIGHT, NODE_HEIGHT } from "shared/constants";
import { canCreateTasks, Task } from "shared/task";
import dayjs from "core/dates";
import { CALENDAR_DAYS, createWorkingCalendar } from "./core";
import type { Dayjs } from "dayjs";
import {
  calculateDateOffsetPx,
  computeNonWorkingRanges,
} from "timeline/utils/geometry";
import { GanttProps } from './props';

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

function GanttChart({
  tasks = EMPTY_TASKS,
  onTasksChange,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  theme,
  className,
  showNonWorkingDays = true,
  holidays,
  isNonWorkingDay,
  initialScrollTo,
  readOnly,
  allowMove,
  allowResize,
  allowProgressChange,
  minDate,
  maxDate,
  visibleStart,
  visibleEnd,
  locale,
  formats,
  firstDayOfWeek,
  showTaskList,
  hierarchy = false,
  collapsedIds,
  defaultCollapsedIds,
  onCollapsedChange,
  groupBy,
  ungroupedLabel,
  workingCalendar = false,
  renderBaseline,
  allowLinkCreate,
  allowLinkDelete,
  allowTaskCreate,
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
  detailTrigger = "selection",
  detailTaskId,
  onDetailChange,
  renderTooltip,
  renderHeaderCell,
  showTooltip,
  zoomOnWheel = false,
  infiniteScroll = false,
  onRangeChange,
  onScaleChange,
  autoScrollOnDrag = true,
  forwardedRef,
}: GanttProps & { forwardedRef: React.ForwardedRef<GanttHandle> }) {
  const {
    rawTasks,
    transformedTasks,
    bottomRowCells,
    selectedScale,
    selectedTaskId,
    syncTasksFromProps,
    setSelectedScale,
    setLocaleOptions,
    getTotalWidth,
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

  // Layout effect so the labels are in place before the first paint
  useLayoutEffect(() => {
    setLocaleOptions(localeOptions);
  }, [localeOptions, setLocaleOptions]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const interaction = useGanttInteraction({
    readOnly,
    allowMove,
    allowResize,
    allowProgressChange,
    allowLinkCreate,
    allowLinkDelete,
    allowTaskCreate,
    allowReorder,
    minDate,
    maxDate,
  });

  const taskList = useGanttTaskListPane({ showTaskList });
  // Cells before the bars on a row - the single name cell, or none while the pane is hidden
  const gridColumnCount = taskList.visible ? 1 : 0;

  const totalWidth = getTotalWidth();

  const extension = useGanttRangeExtension({
    enabled: infiniteScroll,
    scrollRef,
    selectedScale,
    bottomRowCells,
    totalWidth,
    viewportInsetPx: taskList.inset,
    pinnedStart: !!visibleStart,
    pinnedEnd: !!visibleEnd,
  });

  const collapse = useGanttCollapse({
    collapsedIds,
    defaultCollapsedIds,
    onCollapsedChange,
  });

  const move = useGanttTaskMove({
    hierarchy,
    interaction,
    groupBy,
    collapsedIds: collapse.collapsedIds,
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
  const isOffDay = useMemo(() => {
    if (isNonWorkingDay) return isNonWorkingDay;

    const holidaySet = new Set(holidays);
    return (date: Dayjs) => {
      const day = date.day();
      return (
        day === 0 || day === 6 || holidaySet.has(date.format("YYYY-MM-DD"))
      );
    };
  }, [holidays, isNonWorkingDay]);

  // Off, it counts every day, which is plain calendar arithmetic
  const calendar = useMemo(
    () =>
      workingCalendar
        ? createWorkingCalendar({ isNonWorkingDay: isOffDay })
        : CALENDAR_DAYS,
    [workingCalendar, isOffDay]
  );

  // A renderer turns the panel on; `showDetail` is the explicit override
  const detailEnabled = showDetail ?? renderDetail !== undefined;

  const selection = useGanttSelection({
    // The panel turns selection on unless the host has said otherwise
    selectable: selectable ?? (detailEnabled ? true : undefined),
    onTaskSelect,
    onTaskClick,
  });

  // Wraps the selection click handler, so a click still selects and reaches the host first
  const detail = useGanttDetail({
    enabled: detailEnabled,
    trigger: detailTrigger,
    tasks: transformedTasks,
    detailTaskId,
    onDetailChange,
    onTaskClick: selection.onTaskClick,
    onTaskDoubleClick,
  });

  const barOptions = useMemo(
    () => ({
      onTasksChange,
      onTaskClick: detail.onTaskClick,
      onTaskDoubleClick: detail.onTaskDoubleClick,
      renderTooltip,
      showTooltip,
    }),
    [
      onTasksChange,
      detail.onTaskClick,
      detail.onTaskDoubleClick,
      renderTooltip,
      showTooltip,
    ]
  );

  const { rows, tasks: rowTasks } = useGanttRowModel({
    rawTasks,
    tasks: transformedTasks,
    hierarchy,
    collapsedIds: collapse.collapsedIds,
    groupBy,
    ungroupedLabel,
  });

  // The link drag resolves its drop target by arithmetic, so it needs every row, culled ones included
  const setRowTasks = useGanttStore((store) => store.setRowTasks);
  useLayoutEffect(() => {
    setRowTasks(rowTasks);
  }, [rowTasks, setRowTasks]);

  const canCreateTask = onTaskCreate !== undefined && canCreateTasks(interaction);
  const { onDrawPointerDown, ghost } = useGanttDrawCreate({
    enabled: canCreateTask,
    rowCount: rows.length,
    onTaskCreate,
  });

  // Click version of the drawn range, off exactly where the drawn one is off
  const proposeTask = useCallback(() => {
    if (!canCreateTask) return;
    const draft = defaultTaskDraft(dayjs(), bottomRowCells, selectedScale);
    if (draft) onTaskCreate?.(draft);
  }, [canCreateTask, bottomRowCells, selectedScale, onTaskCreate]);

  const virtual = useGanttVirtualization({
    rowCount: rows.length,
    bottomRowCells,
    scrollRef,
  });

  const { containerClassName, dataTheme } = useResolvedTheme(
    theme,
    className ? `gantt-container ${className}` : "gantt-container"
  );

  const syncedTasksRef = useRef<string | null>(null);

  // Overwrite the store only when the contents changed, not when the array identity did,
  // so a parent re-render passing the same data under a new identity does not revert drag edits
  useEffect(() => {
    const snapshot = JSON.stringify(tasks);
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
  });

  useGanttWheelZoom({
    enabled: zoomOnWheel,
    scrollRef,
    selectedScale,
    bottomRowCells,
    viewportInsetPx: taskList.inset,
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
    return computeNonWorkingRanges(bottomRowCells, selectedScale, isOffDay);
  }, [showNonWorkingDays, isOffDay, bottomRowCells, selectedScale]);

  const scrollApi = useGanttScrollApi({
    scrollRef,
    bottomRowCells,
    transformedTasks: rowTasks,
    selectedScale,
    rowHeight: NODE_HEIGHT,
    viewportInsetPx: taskList.inset,
    zoomTo,
    setSelectedScale,
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

  const keyboard = useGanttKeyboardNav({
    // Enter opens the panel; under "none" the host drives it, so the key stays an announcement
    onActivate:
      detailEnabled && detailTrigger !== "none" ? detail.open : undefined,
    rows,
    rawTasks,
    gridColumnCount,
    hierarchy,
    collapsedIds: collapse.collapsedIds,
    selectedScale,
    localeOptions,
    interaction,
    onToggleCollapse: collapse.toggle,
    onTasksChange,
    move,
    scrollToRow: virtual.scrollToRow,
    scrollApi,
    bodyRef,
  });

  useGanttInitialScroll(initialScrollTo, bottomRowCells, scrollApi);

  // Empty timeline clears the selection; a click on a bar has a different target
  const handleContentClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target !== event.currentTarget) return;
      selection.select(null);
      detail.close();
    },
    [selection, detail]
  );


  const containerStyle = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
    // How far the pinned task list reaches in; left-pinned timeline content offsets by this
    "--gantt-pane-inset": `${taskList.inset}px`,
    // Row height as a token, so CSS keeps the row pitch without a second copy of the number
    "--gantt-row-height": `${NODE_HEIGHT}px`,
  } as React.CSSProperties;
  const timelineStyle = { width: `${totalWidth}px` };

  return (
    <section
      className={containerClassName}
      data-theme={dataTheme}
      style={containerStyle}
    >
      {/* Live region - date changes made from the keyboard are announced here */}
      <div className="gantt-sr-only" role="status" aria-live="polite">
        {keyboard.announcement}
      </div>

      {/* The panel is a flex sibling, so the timeline narrows instead of being covered and scroll
          measurements stay correct; the wrapper stays unpositioned so the splitter anchors to .gantt-main. */}
      <div className="gantt-layout">
        <div className="gantt-main">
          <div ref={scrollRef} className="gantt-scroll-container">
            {/* One scroll container, so vertical scrolling and virtualization are shared; one
                treegrid, with each row owning its bars through aria-owns. */}
            <div
              ref={bodyRef}
              className="gantt-body"
              role="treegrid"
              aria-label="Gantt chart"
              aria-rowcount={rows.length + (taskList.visible ? 1 : 0)}
              onKeyDown={keyboard.onKeyDown}
              onFocusCapture={keyboard.onFocusCapture}
            >
              {taskList.visible && (
                <GanttTaskGrid
                  rows={rows}
                  virtualItems={virtual.virtualRows}
                  totalHeight={virtual.totalHeight}
                  width={taskList.width}
                  hierarchy={hierarchy}
                  collapsedIds={collapse.collapsedIds}
                  onToggleCollapse={collapse.toggle}
                  focus={keyboard.focus}
                  selectedTaskId={selectedTaskId}
                  onRowClick={detail.onTaskClick}
                  onRowDoubleClick={detail.onTaskDoubleClick}
                  reorderEnabled={reorderEnabled}
                  interaction={interaction}
                  move={move}
                />
              )}

              <div
                className="gantt-timeline"
                style={timelineStyle}
                role="presentation"
              >
                <div className="gantt-header-wrapper" style={timelineStyle}>
                  <GanttChartHeader
                    bottomRowCells={bottomRowCells}
                    selectedScale={selectedScale}
                    width={totalWidth}
                    virtual={virtual}
                    renderHeaderCell={renderHeaderCell}
                  />

                  {/* Belongs to the date axis: inherits the wrapper's sticky and width, invisible to renderHeaderCell */}
                  <GanttDragGuides />
                </div>

                <div
                  className={`gantt-content${canCreateTask ? " drawable" : ""}`}
                  style={{
                    height: `${virtual.totalHeight}px`,
                    width: `${totalWidth}px`,
                  }}
                  role="presentation"
                  onPointerDown={onDrawPointerDown}
                  onClick={handleContentClick}
                >
                  <GanttNonWorkingLayer ranges={nonWorkingRanges} />

                  <GanttRowsLayer
                    rows={rows}
                    virtualItems={virtual.virtualRows}
                    ownedByTaskList={taskList.visible}
                    hierarchy={hierarchy}
                    collapsedIds={collapse.collapsedIds}
                    focus={keyboard.focus}
                  />

                  <GanttTodayLine leftPx={todayPx} />

                  {ghost && (
                    <div
                      className="gantt-draw-ghost"
                      style={{
                        left: `${ghost.leftPx}px`,
                        width: `${ghost.widthPx}px`,
                        // Same geometry as the bar this becomes, centred in the row
                        height: `${BAR_HEIGHT}px`,
                        marginTop: `${(NODE_HEIGHT - BAR_HEIGHT) / 2}px`,
                        transform: `translateY(${ghost.topPx}px)`,
                      }}
                      aria-hidden="true"
                    />
                  )}

                  <GanttDependencyArrows
                    transformedTasks={rowTasks}
                    rowCount={rows.length}
                    virtual={virtual}
                    interaction={interaction}
                    onTasksChange={onTasksChange}
                    onDependencyDelete={onDependencyDelete}
                  />

                  <GanttBarsLayer
                    rows={rows}
                    virtualItems={virtual.virtualRows}
                    gridColumnCount={gridColumnCount}
                    focus={keyboard.focus}
                    isBarVisible={virtual.isBarVisible}
                    options={barOptions}
                    interaction={interaction}
                    calendar={calendar}
                    autoScrollOnDrag={autoScrollOnDrag}
                    onDependencyCreate={onDependencyCreate}
                    renderBaseline={renderBaseline}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Outside the scroll container to stay pinned to the pane edge, outside the treegrid to keep one tab stop */}
          {taskList.visible && (
            <GanttGridSplitter
              width={taskList.width}
              onWidthChange={taskList.setWidth}
            />
          )}

          {/* Out here for the splitter's reasons; also the only keyboard way in, since drawing is pointer-only */}
          {taskList.visible && canCreateTask && (
            <GanttTaskAddRow width={taskList.width} onAdd={proposeTask} />
          )}
        </div>

        {detail.task && (
          <GanttDetailPanel
            task={detail.task}
            scale={selectedScale}
            localeOptions={localeOptions}
            onClose={detail.close}
            render={renderDetail}
          />
        )}
      </div>
    </section>
  );
}

export default Gantt;
