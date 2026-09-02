import GanttChartHeader from "components/GanttChartHeader";
import GanttDependencyArrows from "components/GanttDependencyArrows";
import GanttDragGuides from "components/GanttDragGuides";
import GanttGridSplitter from "components/GanttGridSplitter";
import { GanttMarkers, GanttRangeBands } from "components/GanttMarkers";
import GanttTaskGrid from "components/GanttTaskGrid";
import GanttBarsLayer from "components/Gantt/GanttBarsLayer";
import GanttNonWorkingLayer from "components/Gantt/GanttNonWorkingLayer";
import GanttRowsLayer from "components/Gantt/GanttRowsLayer";
import GanttToolbar from "components/Gantt/GanttToolbar";
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
import { useGanttCollapse } from "hooks/useGanttCollapse";
import { useGanttDrawCreate } from "hooks/useGanttDrawCreate";
import { useGanttExportApi } from "hooks/useGanttExportApi";
import { useGanttHistoryApi } from "hooks/useGanttHistoryApi";
import { useGanttInteraction } from "hooks/useGanttInteraction";
import { useGanttKeyboardNav } from "hooks/useGanttKeyboardNav";
import { useGanttRowModel } from "hooks/useGanttRowModel";
import { useGanttScheduling } from "hooks/useGanttScheduling";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import { useGanttSelection } from "hooks/useGanttSelection";
import { GanttHandle, useGanttScrollApi } from "hooks/useGanttScrollApi";
import { useGanttTaskListPane } from "hooks/useGanttTaskListPane";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import {
  useGanttInitialScroll,
  useGanttRangeExtension,
  useGanttRangeReport,
  useGanttTimelineSync,
  useGanttWheelZoom,
} from "hooks/useGanttViewport";
import { useResolvedTheme } from "hooks/useResolvedTheme";
import { GanttStoreContext } from "stores/context";
import {
  createGanttStore,
  DEFAULT_SCALE_STORAGE_KEY,
  readPersistedScale,
} from "stores/store";
import { DEFAULT_HISTORY_LIMIT } from "utils/history";
import { NODE_HEIGHT } from "constants/gantt";
import { GanttMarker, GanttRangeBand, GanttScaleKey } from "types/gantt";
import { canCreateTasks, Task } from "types/task";
import dayjs from "core/dates";
import {
  computeBandRects,
  computeMarkerOffsets,
  computeNonWorkingRanges,
} from "utils/timeline";
import { GanttProps } from "./GanttProps";

/** Gantt component defaults */
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
const DEFAULT_SCALE: GanttScaleKey = "month";
/** Default tasks - kept at module scope so a new array is not created on every render */
const EMPTY_TASKS: Task[] = [];
/** Default marker and band lists - same reason */
const EMPTY_MARKERS: GanttMarker[] = [];
const EMPTY_BANDS: GanttRangeBand[] = [];

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
 *
 * Everything with a life of its own - the row model, the viewport, keyboard
 * navigation, scheduling - lives in a hook of its own, so what is left here is the
 * wiring between them and the markup.
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
  columns,
  hierarchy = false,
  collapsedIds,
  defaultCollapsedIds,
  onCollapsedChange,
  groupBy,
  ungroupedLabel,
  schedulingPolicy = "off",
  onSchedulingCycle,
  workingCalendar = false,
  criticalPath = false,
  renderBaseline,
  historyLimit = DEFAULT_HISTORY_LIMIT,
  allowLinkCreate,
  allowLinkDelete,
  allowTaskCreate,
  onDependencyCreate,
  onDependencyDelete,
  onTaskCreate,
  onTaskClick,
  onTaskDoubleClick,
  onTaskSelect,
  selectable,
  onBeforeTaskChange,
  renderBar,
  renderTooltip,
  renderHeaderCell,
  showTooltip,
  markers = EMPTY_MARKERS,
  rangeBands = EMPTY_BANDS,
  zoomOnWheel = false,
  infiniteScroll = false,
  onRangeChange,
  autoScrollOnDrag = true,
  allowRowReorder = false,
  onReorder,
  forwardedRef,
}: GanttProps & { forwardedRef: React.ForwardedRef<GanttHandle> }) {
  const {
    rawTasks,
    transformedTasks,
    bottomRowCells,
    selectedScale,
    selectedTaskId,
    syncTasksFromProps,
    setHistoryLimit,
    setSelectedScale,
    setLocaleOptions,
    getTotalWidth,
  } = useGanttSelectors();

  // Label configuration - undefined while nothing is set, so the built-in labels are
  // used without building a single Intl formatter
  const localeOptions = useMemo(
    () =>
      locale === undefined &&
      formats === undefined &&
      firstDayOfWeek === undefined
        ? undefined
        : { locale, formats, firstDayOfWeek },
    [locale, formats, firstDayOfWeek]
  );

  // Layout effect, not a plain effect - the labels are in place before the first paint
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
    minDate,
    maxDate,
  });

  const taskList = useGanttTaskListPane({ columns, showTaskList });
  // Cells before the bars on a row - 0 while the pane is hidden
  const gridColumnCount = taskList.visible ? taskList.columns.length : 0;

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

  const { isNonWorkingDay: isOffDay, ...schedule } = useGanttScheduling({
    rawTasks,
    transformedTasks,
    holidays,
    isNonWorkingDay,
    workingCalendar,
    policy: schedulingPolicy,
    hierarchy,
    onCycle: onSchedulingCycle,
    criticalPath,
  });

  const selection = useGanttSelection({
    selectable,
    onTaskSelect,
    onTaskClick,
    onTaskDoubleClick,
  });

  // Everything the bars need from props, in one object so the layer stays readable
  const barOptions = useMemo(
    () => ({
      onTasksChange,
      onBeforeTaskChange,
      onTaskClick: selection.onTaskClick,
      onTaskDoubleClick: selection.onTaskDoubleClick,
      renderBar,
      renderTooltip,
      showTooltip,
    }),
    [
      onTasksChange,
      onBeforeTaskChange,
      selection.onTaskClick,
      selection.onTaskDoubleClick,
      renderBar,
      renderTooltip,
      showTooltip,
    ]
  );

  const {
    rows,
    tasks: rowTasks,
    rowIds,
  } = useGanttRowModel({
    rawTasks,
    tasks: schedule.tasks,
    hierarchy,
    collapsedIds: collapse.collapsedIds,
    groupBy,
    ungroupedLabel,
  });

  const canDrawTasks = onTaskCreate !== undefined && canCreateTasks(interaction);
  const { onDrawPointerDown, ghost } = useGanttDrawCreate({
    enabled: canDrawTasks,
    rowIds,
    onTaskCreate,
  });

  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    rowCount: rows.length,
    bottomRowCells,
    scrollRef,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

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
    // A second comparison happens inside, against what the chart currently holds: in
    // controlled mode the host hands back what onTasksChange just gave it under a new
    // identity, and that echo must not count as the host replacing the data
    syncTasksFromProps(tasks);
  }, [tasks, syncTasksFromProps]);

  useEffect(() => {
    setHistoryLimit(historyLimit);
  }, [historyLimit, setHistoryLimit]);

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

  // Today goes through the same marker layer as the host's own markers - one line of
  // rendering, and a host marker can be styled exactly the way the today line is
  const positionedMarkers = useMemo(
    () =>
      computeMarkerOffsets(
        [
          { id: "today", date: dayjs(), className: "gantt-today-marker" },
          ...markers,
        ],
        bottomRowCells,
        selectedScale,
        transformedTasks
      ),
    [markers, bottomRowCells, selectedScale, transformedTasks]
  );

  const positionedBands = useMemo(
    () => computeBandRects(rangeBands, bottomRowCells, selectedScale),
    [rangeBands, bottomRowCells, selectedScale]
  );

  const nonWorkingRanges = useMemo(() => {
    if (!showNonWorkingDays) return [];
    return computeNonWorkingRanges(bottomRowCells, selectedScale, isOffDay);
  }, [showNonWorkingDays, isOffDay, bottomRowCells, selectedScale]);

  // Imperative API - scrolling, PNG export, undo/redo
  const { historyApi, onKeyDown } = useGanttHistoryApi(onTasksChange);
  const scrollApi = useGanttScrollApi({
    scrollRef,
    bottomRowCells,
    transformedTasks: rowTasks,
    selectedScale,
    rowHeight: NODE_HEIGHT,
    viewportInsetPx: taskList.inset,
    zoomTo,
  });
  const exportApi = useGanttExportApi({
    scrollRef,
    bottomRowCells,
    selectedScale,
    taskCount: rows.length,
    totalWidth,
  });
  useImperativeHandle(
    forwardedRef,
    () => ({
      ...scrollApi,
      ...exportApi,
      undo: historyApi.undo,
      redo: historyApi.redo,
      // Getters, not a spread - the handle object outlives any number of gestures,
      // and a copied boolean would be the value from whenever it was last rebuilt
      get canUndo() {
        return historyApi.canUndo;
      },
      get canRedo() {
        return historyApi.canRedo;
      },
    }),
    [scrollApi, exportApi, historyApi]
  );

  const keyboard = useGanttKeyboardNav({
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
    rowVirtualizer,
    scrollApi,
    bodyRef,
  });

  useGanttInitialScroll(initialScrollTo, bottomRowCells, scrollApi);

  // Empty timeline clears the selection; a click on a bar has a different target
  const handleContentClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) selection.select(null);
    },
    [selection]
  );

  const containerStyle = {
    height: typeof height === "number" ? `${height}px` : height,
    width: typeof width === "number" ? `${width}px` : width,
  };
  const timelineStyle = { width: `${totalWidth}px` };

  return (
    <section
      className={containerClassName}
      data-theme={dataTheme}
      style={containerStyle}
      // Focusable so clicking anywhere in the chart puts the undo shortcut in scope,
      // and out of the tab order so it does not add a stop to the page.
      // The handler only ever sees keys pressed inside this chart.
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <GanttToolbar
        taskListEnabled={taskList.enabled}
        taskListCollapsed={taskList.collapsed}
        onToggleTaskList={taskList.toggleCollapsed}
        selectedScale={selectedScale}
        onScaleChange={setSelectedScale}
      />

      {/* Live region - date changes made from the keyboard are announced here */}
      <div className="gantt-sr-only" role="status" aria-live="polite">
        {keyboard.announcement}
      </div>

      <div className="gantt-main">
        <div ref={scrollRef} className="gantt-scroll-container">
          {/* The grid and the timeline sit side by side in one scroll container, so
              vertical scrolling and row virtualization are shared by construction.
              They are also one treegrid: the task list holds the rows and each row
              owns its bars in the timeline through aria-owns. */}
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
                columns={taskList.columns}
                virtualItems={virtualRows}
                totalHeight={rowVirtualizer.getTotalSize()}
                width={taskList.width}
                hierarchy={hierarchy}
                collapsedIds={collapse.collapsedIds}
                onToggleCollapse={collapse.toggle}
                focus={keyboard.focus}
                allowRowReorder={allowRowReorder}
                interaction={interaction}
                onReorder={onReorder}
                onTasksChange={onTasksChange}
                selectedTaskId={selectedTaskId}
                onRowClick={selection.onTaskClick}
                onRowDoubleClick={selection.onTaskDoubleClick}
              />
            )}

            <div
              className="gantt-timeline"
              style={timelineStyle}
              role="presentation"
            >
              {/* Drag guides (run through everything, header included) */}
              <GanttDragGuides width={totalWidth} />

              <div className="gantt-header-wrapper" style={timelineStyle}>
                <GanttChartHeader
                  bottomRowCells={bottomRowCells}
                  selectedScale={selectedScale}
                  width={totalWidth}
                  scrollRef={scrollRef}
                  renderHeaderCell={renderHeaderCell}
                />
              </div>

              <div
                className={`gantt-content${canDrawTasks ? " drawable" : ""}`}
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: `${totalWidth}px`,
                }}
                role="presentation"
                onPointerDown={onDrawPointerDown}
                onClick={handleContentClick}
              >
                <GanttNonWorkingLayer ranges={nonWorkingRanges} />

                <GanttRangeBands bands={positionedBands} />

                <GanttRowsLayer
                  rows={rows}
                  virtualItems={virtualRows}
                  ownedByTaskList={taskList.visible}
                  hierarchy={hierarchy}
                  collapsedIds={collapse.collapsedIds}
                  focus={keyboard.focus}
                />

                {/* Date markers (today included) */}
                <GanttMarkers markers={positionedMarkers} />

                {/* Ghost bar of the task being drawn */}
                {ghost && (
                  <div
                    className="gantt-draw-ghost"
                    style={{
                      left: `${ghost.leftPx}px`,
                      width: `${ghost.widthPx}px`,
                      transform: `translateY(${ghost.topPx}px)`,
                    }}
                    aria-hidden="true"
                  />
                )}

                <GanttDependencyArrows
                  transformedTasks={rowTasks}
                  rowCount={rows.length}
                  criticalLinkIds={schedule.criticalPath?.criticalLinkIds}
                  interaction={interaction}
                  onTasksChange={onTasksChange}
                  onDependencyDelete={onDependencyDelete}
                />

                <GanttBarsLayer
                  rows={rows}
                  virtualItems={virtualRows}
                  gridColumnCount={gridColumnCount}
                  focus={keyboard.focus}
                  isBarVisible={isBarVisible}
                  options={barOptions}
                  interaction={interaction}
                  scheduling={schedule.scheduling}
                  autoScrollOnDrag={autoScrollOnDrag}
                  onDependencyCreate={onDependencyCreate}
                  renderBaseline={renderBaseline}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Outside the scroll container so it stays pinned to the pane edge, and
            outside the treegrid so the chart keeps exactly one tab stop */}
        {taskList.visible && (
          <GanttGridSplitter
            width={taskList.width}
            onWidthChange={taskList.setWidth}
          />
        )}
      </div>
    </section>
  );
}

export default Gantt;
