import GanttBar from "components/GanttBar";
import GanttChartHeader from "components/GanttChartHeader";
import GanttDependencyArrows from "components/GanttDependencyArrows";
import GanttDragGuides from "components/GanttDragGuides";
import { GanttMarkers, GanttRangeBands } from "components/GanttMarkers";
import GanttTaskGrid from "components/GanttTaskGrid";
import ScaleSelector from "components/ScaleSelector";
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
import { Dayjs } from "dayjs";
import { useGanttExportApi } from "hooks/useGanttExportApi";
import { useGanttSelectors } from "hooks/useGanttSelectors";
import {
  GanttHandle,
  GanttZoomAnchor,
  useGanttScrollApi,
} from "hooks/useGanttScrollApi";
import { useGanttVirtualization } from "hooks/useGanttVirtualization";
import { useResolvedTheme } from "hooks/useResolvedTheme";
import { GanttStoreContext, useGanttStoreApi } from "stores/context";
import {
  createGanttStore,
  DEFAULT_SCALE_STORAGE_KEY,
  readPersistedScale,
} from "stores/store";
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_COLUMNS,
  NODE_HEIGHT,
} from "constants/gantt";
import {
  GanttBarRenderer,
  GanttBeforeChangeHandler,
  GanttBottomRowCell,
  GanttColumn,
  GanttDateRange,
  GanttFormatOverrides,
  GanttHeaderCellRenderer,
  GanttMarker,
  GanttRangeBand,
  GanttRangeExtension,
  GanttReorderChange,
  GanttScaleKey,
  GanttTheme,
  GanttTooltipRenderer,
} from "types/gantt";
import { GanttInteractionConfig, Task, TaskTransformed } from "types/task";
import dayjs from "utils/dayjs";
import {
  calculateDateOffsetPx,
  computeBandRects,
  computeMarkerOffsets,
  computeNonWorkingRanges,
  computeTimelineData,
  dateAtOffsetPx,
  originShiftPx,
  timelineRange,
} from "utils/timeline";
import { getVisibleTasks } from "utils/tree";
import {
  accumulateZoom,
  extendRangeForScroll,
  INITIAL_ZOOM_ACCUMULATOR,
  NO_RANGE_EXTENSION,
  stepScale,
} from "utils/viewport";

/** Gantt component defaults */
const DEFAULT_HEIGHT = 600;
const DEFAULT_WIDTH = "100%";
const DEFAULT_SCALE: GanttScaleKey = "month";
/** Default tasks - kept at module scope so a new array is not created on every render */
const EMPTY_TASKS: Task[] = [];
/** Default collapsed list - pinned at module scope for the same reason as tasks */
const EMPTY_IDS: string[] = [];
/** Default marker and band lists - same reason again */
const EMPTY_MARKERS: GanttMarker[] = [];
const EMPTY_BANDS: GanttRangeBand[] = [];

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
  /** Blocks moving, resizing and progress dragging on every task */
  readOnly?: boolean;
  /** Allows/blocks moving bars (default true) - beats `readOnly` */
  allowMove?: boolean;
  /** Allows/blocks resizing bars (default true) - beats `readOnly` */
  allowResize?: boolean;
  /** Allows/blocks dragging the progress handle (default true) - beats `readOnly` */
  allowProgressChange?: boolean;
  /** Earliest date any bar may be dragged to (ISO string) - a task's own `minDate` wins */
  minDate?: string;
  /** Latest date any bar may be dragged to (ISO string) - a task's own `maxDate` wins */
  maxDate?: string;
  /** Pins the timeline to start here (ISO string) instead of fitting to the tasks */
  visibleStart?: string;
  /** Pins the timeline to end here (ISO string) instead of fitting to the tasks */
  visibleEnd?: string;
  /**
   * BCP 47 locale tag for every date label, e.g. `"ko-KR"`
   *
   * Month and day names, header labels and drag tooltips are rendered with
   * `Intl.DateTimeFormat` (no locale packages to install). Left out, the chart keeps
   * its built-in English labels. An unusable tag falls back to those and warns once.
   */
  locale?: string;
  /**
   * Per-scale label overrides - `{ quarter: { header: (d) => ... } }`
   *
   * Each scale takes `tick` (bottom row), `header` (top row) and `tooltip` (drag
   * tooltip and guides); whatever is left out keeps the locale's label. Overrides win
   * over `locale`. The `Dayjs` handed in is in UTC mode.
   */
  formats?: GanttFormatOverrides;
  /**
   * First day of the week, 0 = Sunday .. 6 = Saturday
   *
   * Set it to group the week scale's top header by week starting on that day, instead
   * of by month. Left out, week grouping is off and the header is unchanged.
   */
  firstDayOfWeek?: number;
  /**
   * Whether to show the task list pane on the left
   *
   * Omitted, the pane appears only when `columns` is given - with neither, the chart
   * renders exactly the timeline it does today.
   */
  showTaskList?: boolean;
  /**
   * Column definitions for the task list (default: Name / Start / End)
   *
   * Every header label and cell body comes from here. The first column is the tree
   * column, so indentation and the expander toggle attach to it.
   */
  columns?: GanttColumn[];
  /**
   * Whether to use the parentId hierarchy (default false)
   *
   * With it on, depth comes from the parentId chain rather than from sequence, and a row
   * with children becomes a summary row: its start/end are recomputed from the children
   * (min..max), dragging its bar moves the whole subtree, and a missing progress is rolled
   * up from the children weighted by duration. Row order itself still comes from
   * `sequence`, hierarchy or not.
   */
  hierarchy?: boolean;
  /** Ids of collapsed parents (controlled - given, this value is what the chart shows) */
  collapsedIds?: string[];
  /** Initial collapsed list (uncontrolled seed; later changes are ignored) */
  defaultCollapsedIds?: string[];
  /** Called whenever the collapsed state changes - in controlled and uncontrolled mode alike */
  onCollapsedChange?: (collapsedIds: string[]) => void;
  /** Fires when a bar or a task-list row is clicked (not after a drag) */
  onTaskClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /** Fires on a double click. The two clicks that make it up still fire `onTaskClick` */
  onTaskDoubleClick?: (task: TaskTransformed, event: React.MouseEvent) => void;
  /**
   * Fires when the selection changes - null when the empty timeline is clicked
   *
   * Passing it turns selection on: the selected bar and its task-list row are highlighted.
   */
  onTaskSelect?: (task: TaskTransformed | null) => void;
  /**
   * Whether clicking selects a row
   *
   * Omitted, selection is on only when `onTaskSelect` is given - pass `true` for the
   * highlight without a callback, `false` to turn it off entirely.
   */
  selectable?: boolean;
  /**
   * Runs before a move, resize or progress change is written, and can cancel it
   *
   * Returning `false`, a promise resolving to `false`, or a rejected promise rolls the bar
   * back to where the gesture started. Anything else commits and `onTasksChange` follows.
   * While the promise is pending the bar stays where it was dropped, so a server round trip
   * never blocks the UI - and if the user starts another gesture on that bar in the
   * meantime, the late answer is dropped rather than fighting the newer one.
   */
  onBeforeTaskChange?: GanttBeforeChangeHandler;
  /** Replaces the default bar node entirely - gets the task, its layout, and the handlers to spread */
  renderBar?: GanttBarRenderer;
  /** Replaces the default tooltip node entirely - used for hover and for drag alike */
  renderTooltip?: GanttTooltipRenderer;
  /** Replaces a timeline header cell entirely - both header rows go through it */
  renderHeaderCell?: GanttHeaderCellRenderer;
  /** Hover and drag tooltips (default true) - `false` suppresses both */
  showTooltip?: boolean;
  /**
   * Labelled vertical lines at given dates - deadlines, releases, freezes
   *
   * The built-in today line is one of these, so a marker is styled exactly the way it is:
   * a `color`, a `className`, or the `--gantt-marker` variable.
   */
  markers?: GanttMarker[];
  /** Shaded bands covering a date range - sprints, phases, blackout windows */
  rangeBands?: GanttRangeBand[];
  /**
   * Whether Ctrl/Cmd + wheel steps through the scale ladder (default false)
   *
   * The date under the cursor stays put across the change. Plain wheel keeps scrolling
   * vertically and Shift+wheel horizontally either way.
   */
  zoomOnWheel?: boolean;
  /**
   * Whether scrolling or dragging past an end grows the rendered range (default false)
   *
   * Off, the timeline covers the tasks plus a fixed buffer and stops there. On, it extends
   * by about a viewport at a time as either end is approached, and what is on screen stays
   * where it is.
   */
  infiniteScroll?: boolean;
  /** Called whenever the rendered timeline range changes - the hook for lazy-loading tasks */
  onRangeChange?: (range: GanttDateRange) => void;
  /** Whether a bar drag reaching a viewport edge scrolls the timeline (default true) */
  autoScrollOnDrag?: boolean;
  /**
   * Whether a task list row can be dragged to reorder and re-parent (default false)
   *
   * Vertical drag moves the row among its siblings; horizontal offset indents or outdents it
   * the way an outliner does, and dropping onto the middle of a row makes that row the parent.
   * A drop that would put a row inside its own subtree is marked invalid during the drag and
   * does nothing on release.
   *
   * Follows the same guards as a bar move: a row is draggable only where
   * `resolveTaskInteraction` says the task can move, so `readOnly` (or `allowMove: false`, on
   * the chart or on the task) blocks it.
   */
  allowRowReorder?: boolean;
  /**
   * Called when a row drag is released on a legal target, before anything is committed
   *
   * Returning `false` cancels the drop - the chart stays as it was and `onTasksChange` does
   * not fire. Otherwise the chart updates and `onTasksChange` fires once with the same array.
   */
  onReorder?: (change: GanttReorderChange) => void | boolean;
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
  const storeApi = useGanttStoreApi();
  // Store state and actions
  const {
    rawTasks,
    transformedTasks,
    bottomRowCells,
    selectedScale,
    selectedTaskId,
    setRawTasks,
    setTransformedTasks,
    setBottomRowCells,
    setSelectedScale,
    setLocaleOptions,
    clearAllDragOffsets,
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

  // Scroll container ref
  const scrollRef = useRef<HTMLDivElement>(null);

  // ===== Task list pane =====
  // Without an explicit showTaskList, the pane appears only when columns are given
  const gridColumns = columns ?? DEFAULT_COLUMNS;
  const gridEnabled = showTaskList ?? columns !== undefined;
  const [gridCollapsed, setGridCollapsed] = useState(false);
  const [gridWidth, setGridWidth] = useState(() =>
    gridColumns.reduce(
      (sum, column) => sum + (column.width ?? DEFAULT_COLUMN_WIDTH),
      0
    )
  );
  const gridVisible = gridEnabled && !gridCollapsed;
  // How much of the timeline the sticky pane covers - scroll math treats the viewport as
  // that much narrower
  const gridInset = gridVisible ? gridWidth : 0;

  // ===== Rendered range extension =====
  // Counted in ticks, so it is only meaningful for the scale it was measured at - tagging
  // it with that scale drops it on a scale change without an extra render
  const [extension, setExtension] = useState<{
    scale: GanttScaleKey;
    value: GanttRangeExtension;
  }>({ scale: selectedScale, value: NO_RANGE_EXTENSION });
  const activeExtension =
    extension.scale === selectedScale ? extension.value : NO_RANGE_EXTENSION;

  // Total timeline width
  const totalWidth = getTotalWidth();

  // Values the wheel and scroll listeners need at event time. Written in an effect rather
  // than during render, and declared before every effect that reads them so they are
  // already up to date by then.
  const scaleRef = useRef(selectedScale);
  const cellsRef = useRef(bottomRowCells);
  const gridInsetRef = useRef(gridInset);
  const extensionRef = useRef(activeExtension);
  const totalWidthRef = useRef(totalWidth);
  const onRangeChangeRef = useRef(onRangeChange);
  useLayoutEffect(() => {
    scaleRef.current = selectedScale;
    cellsRef.current = bottomRowCells;
    gridInsetRef.current = gridInset;
    extensionRef.current = activeExtension;
    totalWidthRef.current = totalWidth;
    onRangeChangeRef.current = onRangeChange;
  });

  // ===== Collapsed state (controlled and uncontrolled) =====
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState<string[]>(
    () => defaultCollapsedIds ?? EMPTY_IDS
  );
  const collapsed = collapsedIds ?? uncontrolledCollapsed;
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const handleToggleCollapse = useCallback(
    (taskId: string) => {
      const next = collapsed.includes(taskId)
        ? collapsed.filter((id) => id !== taskId)
        : [...collapsed, taskId];

      // In controlled mode the screen stays put until the prop changes - the host decides
      if (collapsedIds === undefined) setUncontrolledCollapsed(next);
      onCollapsedChange?.(next);
    },
    [collapsed, collapsedIds, onCollapsedChange]
  );

  // ===== Selection =====
  // Like showTaskList/columns: without an explicit flag, the callback turns the feature on
  const selectionEnabled = selectable ?? onTaskSelect !== undefined;

  // One place for both panes, so a bar and its row can never disagree about what is selected
  const selectTask = useCallback(
    (task: TaskTransformed | null) => {
      if (!selectionEnabled) return;

      const nextId = task?.id ?? null;
      if (storeApi.getState().selectedTaskId === nextId) return;

      storeApi.getState().setSelectedTaskId(nextId);
      onTaskSelect?.(task);
    },
    [selectionEnabled, onTaskSelect, storeApi]
  );

  const handleTaskClick = useCallback(
    (task: TaskTransformed, event: React.MouseEvent) => {
      onTaskClick?.(task, event);
      selectTask(task);
    },
    [onTaskClick, selectTask]
  );

  const handleTaskDoubleClick = useCallback(
    (task: TaskTransformed, event: React.MouseEvent) => {
      onTaskDoubleClick?.(task, event);
    },
    [onTaskDoubleClick]
  );

  // Everything the bars need from props, in one object so the row map stays readable
  const barOptions = useMemo(
    () => ({
      onTasksChange,
      onBeforeTaskChange,
      onTaskClick: handleTaskClick,
      onTaskDoubleClick: handleTaskDoubleClick,
      renderBar,
      renderTooltip,
      showTooltip,
    }),
    [
      onTasksChange,
      onBeforeTaskChange,
      handleTaskClick,
      handleTaskDoubleClick,
      renderBar,
      renderTooltip,
      showTooltip,
    ]
  );

  // Rows left after hiding collapsed subtrees - the grid and the timeline read the same
  // array, so their rows cannot drift apart
  const visibleTasks = useMemo(() => {
    if (!hierarchy || !collapsedSet.size) return transformedTasks;

    const visible = getVisibleTasks(transformedTasks, collapsedSet);
    if (visible.length === transformedTasks.length) return transformedTasks;

    // Arrows use order as the row index - renumber it without the hidden rows
    return visible.map((task, index) => ({ ...task, order: index + 1 }));
  }, [hierarchy, collapsedSet, transformedTasks]);

  // Virtualization hook
  const { rowVirtualizer, isBarVisible } = useGanttVirtualization({
    transformedTasks: visibleTasks,
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

  // Interaction settings, passed down to every bar as one object
  const interaction = useMemo<GanttInteractionConfig>(
    () => ({
      readOnly,
      allowMove,
      allowResize,
      allowProgressChange,
      minDate,
      maxDate,
    }),
    [readOnly, allowMove, allowResize, allowProgressChange, minDate, maxDate]
  );

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

  // Cells of the previous timeline - used to compute how far the origin moved and compensate the scroll
  const prevCellsRef = useRef<GanttBottomRowCell[]>([]);
  const pendingScrollShiftRef = useRef(0);

  // Build the timeline structure (clears to an empty timeline when there are no tasks)
  useLayoutEffect(() => {
    const { bottomCells, transformedTasks: transformed } = computeTimelineData(
      rawTasks,
      selectedScale,
      visibleRange,
      hierarchy,
      activeExtension
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
    visibleRange,
    hierarchy,
    activeExtension,
    setBottomRowCells,
    setTransformedTasks,
    clearAllDragOffsets,
  ]);

  // Date to put back under the cursor once the new scale's cells exist
  const pendingAnchorRef = useRef<GanttZoomAnchor | null>(null);

  // Apply the scroll compensation after the new timeline width has landed in the DOM
  // (deliberately keyed on the cells alone - the scale changes one commit earlier, and
  //  measuring against cells that do not belong to it would land in the wrong place)
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const anchor = pendingAnchorRef.current;

    // A zoom anchor supersedes the origin compensation: both exist to keep the view still
    // while the timeline is rebuilt, and the anchor is the more specific answer
    if (anchor) {
      pendingAnchorRef.current = null;
      pendingScrollShiftRef.current = 0;

      const px = calculateDateOffsetPx(
        anchor.date,
        bottomRowCells,
        scaleRef.current
      );
      if (scrollEl && px !== null) {
        scrollEl.scrollLeft = Math.max(0, px - anchor.viewportX);
        return;
      }
    }

    const shift = pendingScrollShiftRef.current;
    if (!shift) return;

    pendingScrollShiftRef.current = 0;
    if (scrollEl) scrollEl.scrollLeft += shift;
  }, [bottomRowCells]);

  /**
   * Switches scale, keeping `anchor.date` at `anchor.viewportX` px from the timeline's
   * visible left edge
   */
  const zoomTo = useCallback(
    (scale: GanttScaleKey, anchor: GanttZoomAnchor) => {
      if (scale === scaleRef.current) {
        // Same scale - no rebuild is coming, so place the anchor now
        const scrollEl = scrollRef.current;
        const px = calculateDateOffsetPx(anchor.date, cellsRef.current, scale);
        if (scrollEl && px !== null) {
          scrollEl.scrollLeft = Math.max(0, px - anchor.viewportX);
        }
        return;
      }

      pendingAnchorRef.current = anchor;
      setSelectedScale(scale);
    },
    [setSelectedScale]
  );

  // Scale change handler
  const handleScaleChange = (scale: GanttScaleKey) => {
    setSelectedScale(scale);
  };

  // ===== Ctrl/Cmd + wheel zoom =====
  useEffect(() => {
    if (!zoomOnWheel) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const accumulator = { ...INITIAL_ZOOM_ACCUMULATOR };

    const handleWheel = (event: WheelEvent) => {
      // Plain wheel still scrolls vertically and Shift+wheel horizontally
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();

      const { state, step } = accumulateZoom(
        accumulator,
        event.deltaY,
        event.timeStamp
      );
      Object.assign(accumulator, state);
      if (!step) return;

      const nextScale = stepScale(scaleRef.current, step);
      if (nextScale === scaleRef.current) return;

      // Where the cursor is inside the timeline area. A cursor over the pinned task list
      // clamps to the timeline's own left edge, so zooming there is still anchored to
      // something the user can see.
      const rect = scrollEl.getBoundingClientRect();
      const inset = gridInsetRef.current;
      const viewportX =
        Math.min(
          Math.max(event.clientX - rect.left, inset),
          scrollEl.clientWidth
        ) - inset;

      const date = dateAtOffsetPx(
        scrollEl.scrollLeft + viewportX,
        cellsRef.current,
        scaleRef.current
      );
      if (!date) return;

      zoomTo(nextScale, { date, viewportX });
    };

    // Registered by hand and non-passive - preventDefault has to stop the browser's own
    // ctrl+wheel page zoom, which a passive listener cannot do
    scrollEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => scrollEl.removeEventListener("wheel", handleWheel);
  }, [zoomOnWheel, zoomTo]);

  // ===== Range extension =====
  // Re-subscribed whenever the cells change, which also re-checks the edges right after a
  // rebuild - that is what lets a drag keep pushing past the end
  useEffect(() => {
    if (!infiniteScroll) return;

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const checkEdges = () => {
      const cells = cellsRef.current;
      const totalPx = totalWidthRef.current;
      if (!cells.length || totalPx <= 0) return;

      const next = extendRangeForScroll({
        current: extensionRef.current,
        scrollLeft: scrollEl.scrollLeft,
        viewportPx: scrollEl.clientWidth - gridInsetRef.current,
        totalPx,
        pxPerTick: totalPx / cells.length,
        // A pinned end is where the host put it - growing it there would be undone on
        // every recompute and the check would spin
        canExtend: { before: !visibleStart, after: !visibleEnd },
      });
      if (!next) return;

      extensionRef.current = next;
      setExtension({ scale: scaleRef.current, value: next });
    };

    checkEdges();
    scrollEl.addEventListener("scroll", checkEdges, { passive: true });
    return () => scrollEl.removeEventListener("scroll", checkEdges);
  }, [infiniteScroll, bottomRowCells, visibleStart, visibleEnd]);

  // ===== Range reporting =====
  const reportedRangeRef = useRef("");
  useEffect(() => {
    const report = onRangeChangeRef.current;
    if (!report) return;

    const range = timelineRange(bottomRowCells, scaleRef.current);
    if (!range) return;

    // Fires on a real range change only - a re-render with the same dates is not one
    const key = `${range.start.valueOf()}:${range.end.valueOf()}`;
    if (key === reportedRangeRef.current) return;

    reportedRangeRef.current = key;
    report(range);
  }, [bottomRowCells]);

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

  // Imperative API - scrolling plus PNG export
  const scrollApi = useGanttScrollApi({
    scrollRef,
    bottomRowCells,
    transformedTasks: visibleTasks,
    selectedScale,
    rowHeight: NODE_HEIGHT,
    viewportInsetPx: gridInset,
    zoomTo,
  });
  const exportApi = useGanttExportApi({
    scrollRef,
    bottomRowCells,
    selectedScale,
    taskCount: transformedTasks.length,
    totalWidth,
  });
  useImperativeHandle(
    forwardedRef,
    () => ({ ...scrollApi, ...exportApi }),
    [scrollApi, exportApi]
  );

  // initialScrollTo is applied once, when the timeline first becomes ready
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (didInitialScrollRef.current || !initialScrollTo) return;
    if (!bottomRowCells.length) return;

    didInitialScrollRef.current = true;
    const target = initialScrollTo === "today" ? dayjs() : initialScrollTo;
    scrollApi.scrollToDate(target, { smooth: false });
  }, [initialScrollTo, bottomRowCells, scrollApi]);

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
        {gridEnabled && (
          <button
            type="button"
            className="gantt-grid-toggle"
            onClick={() => setGridCollapsed((prev) => !prev)}
            aria-expanded={!gridCollapsed}
            aria-label={
              gridCollapsed ? "Expand task list" : "Collapse task list"
            }
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
              <path d="M6 2.5 L6 13.5" />
            </svg>
          </button>
        )}
        <ScaleSelector
          selectedScale={selectedScale}
          onScaleChange={handleScaleChange}
        />
      </div>

      {/* Main chart area */}
      <div className="gantt-main">
        <div ref={scrollRef} className="gantt-scroll-container">
          {/* The grid and the timeline sit side by side in one scroll container, so
              vertical scrolling and row virtualization are shared by construction */}
          <div className="gantt-body">
            {gridVisible && (
              <GanttTaskGrid
                tasks={visibleTasks}
                columns={gridColumns}
                virtualItems={rowVirtualizer.getVirtualItems()}
                totalHeight={rowVirtualizer.getTotalSize()}
                width={gridWidth}
                onWidthChange={setGridWidth}
                hierarchy={hierarchy}
                collapsedIds={collapsedSet}
                onToggleCollapse={handleToggleCollapse}
                allowRowReorder={allowRowReorder}
                interaction={interaction}
                onReorder={onReorder}
                onTasksChange={onTasksChange}
                selectedTaskId={selectedTaskId}
                onRowClick={handleTaskClick}
                onRowDoubleClick={handleTaskDoubleClick}
              />
            )}

            <div className="gantt-timeline" style={{ width: `${totalWidth}px` }}>
              {/* Drag guides (run through everything, header included) */}
              <GanttDragGuides width={totalWidth} />

              {/* Header */}
              <div className="gantt-header-wrapper" style={{ width: `${totalWidth}px` }}>
                <GanttChartHeader
                  bottomRowCells={bottomRowCells}
                  selectedScale={selectedScale}
                  width={totalWidth}
                  scrollRef={scrollRef}
                  renderHeaderCell={renderHeaderCell}
                />
              </div>

              {/* Content area */}
              <div
                className="gantt-content"
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: `${totalWidth}px`,
                }}
                // Empty timeline clears the selection; a click on a bar has a different target
                onClick={(event) => {
                  if (event.target === event.currentTarget) selectTask(null);
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

                {/* Range bands (background) */}
                <GanttRangeBands bands={positionedBands} />

                {/* Task rows (background) */}
                <div className="gantt-rows">
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const task = visibleTasks[virtualRow.index];
                    if (!task) return null;

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

                {/* Date markers (today included) */}
                <GanttMarkers markers={positionedMarkers} />

                {/* Dependency arrows */}
                <GanttDependencyArrows transformedTasks={visibleTasks} />

                {/* Task bars */}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const task = visibleTasks[virtualRow.index];
                  if (!task) return null;

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
                        options={barOptions}
                        interaction={interaction}
                        autoScrollOnDrag={autoScrollOnDrag}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Gantt;
