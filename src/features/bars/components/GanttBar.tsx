import {
  HOVER_CARD_DELAY_MS,
  MIN_LABEL_INSIDE_WIDTH,
  MIN_RESIZABLE_WIDTH,
} from "shared/constants";
import { resizeEdgeAt, useGanttBarDrag } from "features/bars/hooks/useGanttBarDrag";
import { useGanttLinkDrag } from "features/dependencies/hooks/useGanttLinkDrag";
import { GanttDependencyChange } from "features/dependencies/types";
import {
  CSSProperties,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useGanttStore, useGanttStoreApi } from "shared/context";
import { GanttBarOptions, GanttGeometry, LinkAnchor } from "shared/types";
import {
  GanttInteractionConfig,
  normalizeProgress,
  resolveTaskColors,
  resolveTaskInteraction,
  TaskTransformed,
} from "shared/task";
import dayjs from "core/dates";
import type { WorkingCalendar } from "core/calendar";
import { formatDuration } from "shared/utils/i18n";

interface GanttBarProps {
  currentTask: TaskTransformed;
  options: GanttBarOptions;
  interaction?: GanttInteractionConfig;
  calendar?: WorkingCalendar;
  autoScrollOnDrag: boolean;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  geometry: GanttGeometry;
  crowded: LinkAnchor[];
}

export default function GanttBar({
  currentTask,
  options,
  interaction,
  calendar,
  autoScrollOnDrag,
  onDependencyCreate,
  geometry,
  crowded,
}: GanttBarProps) {
  const {
    onTasksChange,
    onTaskActivate,
    onTaskDoubleClick,
    showTooltip = true,
    tooltip,
  } = options;

  const { onPointerDown, consumeDragClick } = useGanttBarDrag(
    currentTask,
    { onTasksChange, autoScroll: autoScrollOnDrag },
    interaction,
    calendar
  );
  const { canMove, canResize, canCreateLink } =
    resolveTaskInteraction(currentTask, interaction);
  const [atResizeEdge, setAtResizeEdge] = useState(false);
  const [hovered, setHovered] = useState(false);

  const storeApi = useGanttStoreApi();
  const setHoveredTaskId = useGanttStore((store) => store.setHoveredTaskId);
  const hoverCardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverCard = useCallback(() => {
    if (hoverCardTimer.current === null) return;
    clearTimeout(hoverCardTimer.current);
    hoverCardTimer.current = null;
  }, []);

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
    geometry,
  });

  const linkRoleClass = useGanttStore((store) => {
    const draft = store.linkDraft;
    if (!draft) return "";
    if (draft.hoverTaskId === currentTask.id) {
      return draft.rejection ? " link-invalid" : " link-valid";
    }
    if (draft.fromTaskId === currentTask.id) return " link-source";
    return "";
  });

  const linkHandles =
    canCreateLink &&
    (["start", "end"] as LinkAnchor[]).map((anchor) => (
      <span
        key={anchor}
        className={`gantt-link-handle ${anchor}${crowded.includes(anchor) ? " crowded" : ""}`}
        onPointerDown={startLink(anchor)}
        onClick={(e) => e.stopPropagation()}
      />
    ));

  const liveOffset = useGanttStore((store) => store.dragOffsets[currentTask.id]);
  const isDragging = useGanttStore((store) => store.barDrag?.task.id === currentTask.id);
  const isSelected = useGanttStore(
    (store) => store.selectedTaskId === currentTask.id
  );
  const isHovered = useGanttStore((store) => store.hoveredTaskId === currentTask.id);
  const linking = useGanttStore((store) => store.linkDraft !== null);

  const offsetX = liveOffset?.offsetX ?? 0;
  const offsetWidth = liveOffset?.offsetWidth ?? 0;

  const finalLeft = currentTask.barLeft + offsetX;
  const trueWidth = currentTask.barWidth + offsetWidth;
  const finalWidth = Math.max(trueWidth, MIN_RESIZABLE_WIDTH);
  const labelOutside = finalWidth < MIN_LABEL_INSIDE_WIDTH;

  const progress = normalizeProgress(currentTask.progress);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) =>
    setAtResizeEdge(
      resizeEdgeAt(e.currentTarget.getBoundingClientRect(), e.clientX, "mouse") !== null
    );

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (consumeDragClick()) return;
    onTaskActivate?.(currentTask, e);
  };

  const restCursor = canMove ? "grab" : "default";
  const barCursor = (() => {
    if (isDragging) return canMove || canResize ? "grabbing" : restCursor;
    if (atResizeEdge && canResize) return "ew-resize";
    return restCursor;
  })();

  const showHoverCard =
    showTooltip && hovered && !linking && !(isDragging && liveOffset);

  useEffect(() => {
    if (!hovered) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHovered(false);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [hovered]);

  const tooltipNode = () => {
    if (!showHoverCard) return null;

    const startDate = dayjs(currentTask.startDate);
    const endDate = dayjs(currentTask.endDate);

    return (
      <div className="gantt-bar-tooltip gantt-bar-tooltip-detail">
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

  const height = currentTask.isSummary ? geometry.summaryBarHeight : geometry.barHeight;
  const barStyle = {
    transform: `translateX(${finalLeft}px)`,
    width: finalWidth,
    height,
    cursor: barCursor,
    "--gantt-bar-height": `${height}px`,
    ...resolveTaskColors(currentTask.color),
  } as CSSProperties;

  return (
    <div
      data-task-id={currentTask.id}
      className={`gantt-task-bar${isDragging ? " dragging" : ""}${
        isHovered ? " hovered" : ""
      }${labelOutside ? " compact" : ""}${
        currentTask.isSummary ? " summary" : ""
      }${canResize ? "" : " no-resize"}${linkRoleClass}${
        isSelected ? " selected" : ""
      }${currentTask.className ? ` ${currentTask.className}` : ""}`}
      onPointerDown={onPointerDown}
      onClick={handleClick}
      onDoubleClick={(e) => onTaskDoubleClick?.(currentTask, e)}
      onMouseMove={handleMouseMove}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        setHoveredTaskId(currentTask.id);
        cancelHoverCard();
        hoverCardTimer.current = setTimeout(
          () => setHovered(true),
          HOVER_CARD_DELAY_MS
        );
      }}
      onMouseLeave={() => {
        setAtResizeEdge(false);
        setHoveredTaskId(null);
        cancelHoverCard();
        setHovered(false);
      }}
      style={barStyle}
    >
      {progress !== null && (
        <div
          className="gantt-progress-fill"
          style={{ width: `${progress}%` }}
        />
      )}

      <span
        className={`gantt-task-name${labelOutside ? " outside" : ""}`}
      >
        {currentTask.name}
      </span>

      {linkHandles}

      {tooltipNode()}
    </div>
  );
}
