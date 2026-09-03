import {
  BAR_HEIGHT,
  EDGE_THRESHOLD,
  HOVER_CARD_DELAY_MS,
  MIN_BAR_WIDTH,
  MIN_LABEL_INSIDE_WIDTH,
  MIN_RESIZABLE_WIDTH,
  PROGRESS_HANDLE_INSET,
  SUMMARY_BAR_HEIGHT,
} from "shared/constants";
import { useGanttBarDrag, DragMode } from "bars/hooks/useGanttBarDrag";
import {
  GanttDependencyChange,
  useGanttLinkDrag,
} from "dependencies/hooks/useGanttLinkDrag";
import { useGanttProgressDrag } from "bars/hooks/useGanttProgressDrag";
import {
  CSSProperties,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import {
  GanttBarOptions,
  GanttTooltipReason,
} from "shared/types";
import {
  GanttInteractionConfig,
  resolveTaskColors,
  resolveTaskInteraction,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import type { WorkingCalendar } from "../../core";
import { formatTaskAriaLabel } from "interaction/utils/a11y";
import { LinkAnchor } from "dependencies/utils/link";
import { resolveFormatters } from "shared/utils/i18n";

interface GanttBarProps {
  currentTask: TaskTransformed;
  options: GanttBarOptions;
  interaction?: GanttInteractionConfig;
  /** Roving tabindex of the treegrid - exactly one cell carries 0, so Tab enters the grid once */
  tabIndex: number;
  /** `row:column` coordinate the chart's focus manager looks the cell up by */
  cellCoord?: string;
  /** Working-day calendar - drag results snap forward off non-working days */
  calendar?: WorkingCalendar;
  /** Scroll the timeline when the drag reaches a viewport edge; Gantt.tsx owns the default */
  autoScrollOnDrag: boolean;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
}

function formatDuration(durationMs: number): string {
  const hours = Math.max(0, Math.round(durationMs / 3_600_000));
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

export default function GanttBar({
  currentTask,
  options,
  interaction,
  tabIndex,
  cellCoord,
  calendar,
  autoScrollOnDrag,
  onDependencyCreate,
}: GanttBarProps) {
  const {
    onTasksChange,
    onTaskClick,
    onTaskDoubleClick,
    renderTooltip,
    showTooltip = true,
  } = options;

  const barRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, dragMode, consumeDragClick } = useGanttBarDrag(
    currentTask,
    { onTasksChange, autoScroll: autoScrollOnDrag },
    interaction,
    calendar
  );
  const { canMove, canResize, canChangeProgress, canCreateLink } =
    resolveTaskInteraction(currentTask, interaction);
  // Only the pointer position - the cursor is derived below, so a late permission change
  // cannot leave a stale affordance behind
  const [onResizeEdge, setOnResizeEdge] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Arrows light on contact; the card covers the rows below, so it waits HOVER_CARD_DELAY_MS
  const storeApi = useGanttStoreApi();
  const setHoveredTaskId = useGanttStore((store) => store.setHoveredTaskId);
  const hoverCardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverCard = useCallback(() => {
    if (hoverCardTimer.current === null) return;
    clearTimeout(hoverCardTimer.current);
    hoverCardTimer.current = null;
  }, []);

  // A bar virtualized out mid-hover never gets its own mouseleave, so clear the store here
  useEffect(() => {
    const taskId = currentTask.id;
    return () => {
      cancelHoverCard();
      if (storeApi.getState().hoveredTaskId === taskId) {
        storeApi.getState().setHoveredTaskId(null);
      }
    };
  }, [currentTask.id, cancelHoverCard, storeApi]);

  const { startLink } = useGanttLinkDrag({
    task: currentTask,
    interaction,
    onTasksChange,
    onDependencyCreate,
  });

  // This bar's part in the running link drag, as a class. A string, not an object - the
  // selector reruns on every store update and a fresh object each time loops forever.
  const linkRoleClass = useGanttStore((store) => {
    const draft = store.linkDraft;
    if (!draft) return "";
    if (draft.hoverTaskId === currentTask.id) {
      const kind = draft.rejection ? "invalid" : "valid";
      return ` link-${kind} link-at-${draft.hoverAnchor}`;
    }
    if (draft.fromTaskId === currentTask.id) {
      return ` link-source link-at-${draft.fromAnchor}`;
    }
    return "";
  });

  // Connector dots - dragging from one creates a dependency
  const linkHandles = canCreateLink && (
    <>
      {(["start", "end"] as LinkAnchor[]).map((anchor) => (
        <span
          key={anchor}
          className={`gantt-link-handle ${anchor}`}
          onPointerDown={startLink(anchor)}
          role="button"
          tabIndex={-1}
          aria-label={`Link from the ${anchor} of ${currentTask.name}`}
        />
      ))}
    </>
  );

  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.currentTask?.id === currentTask.id);
  const selectedScale = useGanttStore((store) => store.selectedScale);
  const localeOptions = useGanttStore((store) => store.localeOptions);
  const isSelected = useGanttStore(
    (store) => store.selectedTaskId === currentTask.id
  );

  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  // A minimum width keeps short tasks grabbable; the label moves outside when narrow
  const finalLeft = currentTask.barLeft + offsetX;
  const trueWidth = currentTask.barWidth + offsetWidth;
  const finalWidth = Math.max(trueWidth, MIN_BAR_WIDTH);
  const labelOutside = finalWidth < MIN_LABEL_INSIDE_WIDTH;

  const { onProgressPointerDown, progress, isDraggingProgress } =
    useGanttProgressDrag(currentTask, barRef, {
      onTasksChange,
      });
  const showProgress = progress !== null;

  // Only reports where the pointer is; canResize decides whether the edge is grabbable
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current;
      if (!bar) return;

      const rect = bar.getBoundingClientRect();
      if (rect.width < MIN_RESIZABLE_WIDTH) {
        setOnResizeEdge(false);
        return;
      }

      const relativeX = e.clientX - rect.left;

      setOnResizeEdge(
        relativeX <= EDGE_THRESHOLD || relativeX >= rect.width - EDGE_THRESHOLD
      );
    },
    []
  );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // The click that closes a drag is the end of that gesture, not a selection
    if (consumeDragClick()) return;
    onTaskClick?.(currentTask, e);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onTaskDoubleClick?.(currentTask, e);
  };

  // A gesture that is not allowed shows no affordance at all
  const restCursor = canMove ? "grab" : "default";
  const barCursor = isDragging
    ? canMove || canResize
      ? "grabbing"
      : restCursor
    : onResizeEdge && canResize
      ? "ew-resize"
      : restCursor;

  const { tooltip } = useMemo(
    () => resolveFormatters(selectedScale, localeOptions),
    [selectedScale, localeOptions]
  );
  // The dates ride the bar itself - a screen reader user never sees the date header above it
  const ariaLabel = formatTaskAriaLabel(
    currentTask,
    tooltip,
    showProgress ? progress : null
  );

  const getTooltipText = (mode: DragMode | null) => {
    if (!liveOffset) return "";

    const startText = tooltip(liveOffset.offsetStartDate);
    const endText = tooltip(liveOffset.offsetEndDate);

    switch (mode) {
      case "left":
        return `Start: ${startText}`;
      case "right":
        return `End: ${endText}`;
      case "bar":
      default:
        return `${startText} → ${endText}`;
    }
  };

  // What the tooltip is for, most specific first - a gesture in progress beats a hover
  const tooltipReason: GanttTooltipReason | null = !showTooltip
    ? null
    : isDraggingProgress
      ? "progress"
      : isDragging && liveOffset
        ? dragMode === "left" || dragMode === "right"
          ? "resize"
          : "move"
        : hovered
          ? "hover"
          : null;

  // WCAG 2.1 SC 1.4.13: hover content must be dismissible without moving the pointer
  useEffect(() => {
    if (!hovered) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHovered(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [hovered]);

  const renderTooltipNode = () => {
    if (!tooltipReason) return null;

    const isGesture = tooltipReason !== "hover";
    const startDate =
      isGesture && liveOffset
        ? liveOffset.offsetStartDate
        : dayjs(currentTask.startDate);
    const endDate =
      isGesture && liveOffset
        ? liveOffset.offsetEndDate
        : dayjs(currentTask.endDate);

    if (renderTooltip) {
      return renderTooltip({
        task: currentTask,
        reason: tooltipReason,
        startDate,
        endDate,
        durationMs: endDate.valueOf() - startDate.valueOf(),
        progress,
        scale: selectedScale,
      });
    }

    // Gesture tooltips are a single live line; the hover one is the task's summary
    if (tooltipReason === "progress") {
      return (
        <div className="gantt-bar-tooltip" role="status" aria-live="polite">
          {progress}%
        </div>
      );
    }

    if (isGesture) {
      // Hidden, not removed: the only live region a pointer drag produces, and
      // `reason: "move" | "resize"` is a documented renderTooltip value.
      // .gantt-sr-only must stay declared after .gantt-bar-tooltip in styles.css - equal
      // specificity, so source order is what hides this and clips the ::after caret.
      return (
        <div
          className="gantt-bar-tooltip gantt-sr-only"
          role="status"
          aria-live="polite"
        >
          {getTooltipText(dragMode)}
        </div>
      );
    }

    return (
      <div className="gantt-bar-tooltip gantt-bar-tooltip-detail" role="tooltip">
        <span className="gantt-tooltip-name">{currentTask.name}</span>
        <span className="gantt-tooltip-meta">
          {`${tooltip(startDate)} → ${tooltip(endDate)}`}
        </span>
        <span className="gantt-tooltip-meta">
          {formatDuration(endDate.valueOf() - startDate.valueOf())}
          {progress !== null ? ` · ${progress}%` : ""}
        </span>
      </div>
    );
  };

  const colorVars = resolveTaskColors(currentTask.color) as CSSProperties;

  const barStyle: CSSProperties = {
    transform: `translateX(${finalLeft}px)`,
    width: finalWidth,
    height: currentTask.isSummary ? SUMMARY_BAR_HEIGHT : BAR_HEIGHT,
    cursor: barCursor,
    ...colorVars,
  };


  const extraClasses = [
    isSelected ? "selected" : "",
    currentTask.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  const suffix = extraClasses ? ` ${extraClasses}` : "";

  return (
    <div
      ref={barRef}
      id={`task-${currentTask.id}`}
      data-task-id={currentTask.id}
      className={`gantt-task-bar${isDragging ? " dragging" : ""}${
        tooltipReason ? " has-tooltip" : ""
      }${labelOutside ? " compact" : ""}${
        currentTask.isSummary ? " summary" : ""
      }${canResize ? "" : " no-resize"}${linkRoleClass}${suffix}`}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseMove={handleMouseMove}
      onPointerEnter={(e) => {
        // A tap fires mouseenter with no mouseleave, so the card would stick under the finger
        if (e.pointerType !== "mouse") return;
        setHoveredTaskId(currentTask.id);
        cancelHoverCard();
        hoverCardTimer.current = setTimeout(
          () => setHovered(true),
          HOVER_CARD_DELAY_MS
        );
      }}
      onMouseLeave={() => {
        setOnResizeEdge(false);
        setHoveredTaskId(null);
        cancelHoverCard();
        setHovered(false);
      }}
      style={barStyle}
      role="gridcell"
      tabIndex={tabIndex}
      data-gantt-cell={cellCoord}
      aria-label={ariaLabel}
    >
      {showProgress && (
        <>
          <div
            className="gantt-progress-fill"
            style={{ width: `${progress}%` }}
          />
          {/* Only the draggable handle is gated - the fill stays a readout */}
          {canChangeProgress && (
            <div
              className={`gantt-progress-handle${
                isDraggingProgress ? " dragging" : ""
              }`}
              style={{
                left: `clamp(${PROGRESS_HANDLE_INSET}px, ${progress}%, calc(100% - ${PROGRESS_HANDLE_INSET}px))`,
              }}
              onPointerDown={onProgressPointerDown}
              role="slider"
              tabIndex={-1}
              aria-label={`${currentTask.name} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            />
          )}
        </>
      )}

      <span
        className={`gantt-task-name${labelOutside ? " outside" : ""}`}
      >
        {currentTask.name}
      </span>

      {linkHandles}

      {renderTooltipNode()}
    </div>
  );
}
