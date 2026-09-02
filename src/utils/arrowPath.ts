import { MILESTONE_HALF_DIAGONAL, NODE_HEIGHT } from "constants/gantt";
import { linkKey } from "../core";
import {
  isMilestoneTask,
  RenderedDependency,
  TaskTransformed,
} from "types/task";
import { LinkAnchor } from "utils/dependency";

/** Live offset of the task being dragged (0 when it is not being dragged) */
export interface DragOffset {
  offsetX: number;
  offsetWidth: number;
}

const NO_OFFSET: DragOffset = { offsetX: 0, offsetWidth: 0 };

/**
 * Returns the path string for an SVG <path> element for various dependency types.
 * @param dependencyType - One of 'FS', 'FF', 'SF', 'SS' (with a fallback).
 * @param startX - Starting X coordinate.
 * @param startY - Starting Y coordinate.
 * @param endX - Ending X coordinate.
 * @param endY - Ending Y coordinate.
 */
export function getSmartGanttPath(
  dependencyType: string,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): string {
  if (startY < 0 || endY < 0) {
    return `M ${startX} ${startY} h ${(endX - startX) / 2}`;
  }

  const cornerRadius = 7;
  const stepOffset = 11;
  const horizontalBack = 25;
  const minHorizontalThreshold = 20;

  // Initial 'move-to' command
  const initialPath = `M ${startX} ${startY}`;

  // Calculate deltas
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  // Check directions
  const movingUp = endY <= startY;
  const movingDown = endY >= startY;
  const movingRight = endX >= startX;
  const movingLeft = endX <= startX;

  // Distance thresholds
  const thresholdExceeded = absDeltaX > minHorizontalThreshold;
  const halfHorizontalDistance = Math.abs(deltaX / 2);
  const halfVerticalDistance = Math.abs(deltaY / 2);

  // --------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // --------------------------------------------------------------------------
  function getFSPath(): string {
    // Sub-helper to pick direction
    function getFSDirection(): string {
      if ((movingRight || movingLeft) && movingDown && !thresholdExceeded) {
        return "downSmallHorizontal";
      }
      if ((movingRight || movingLeft) && movingUp && !thresholdExceeded) {
        return "upSmallHorizontal";
      }
      if (movingDown && movingLeft) {
        return "downLeft";
      }
      if (movingDown && movingRight) {
        return "downRight";
      }
      if (movingUp && movingLeft) {
        return "upLeft";
      }
      if (movingUp && movingRight) {
        return "upRight";
      }
      return ""; // Default
    }

    let path = initialPath;
    const direction = getFSDirection();

    switch (direction) {
      case "downRight": {
        path += ` h ${halfHorizontalDistance - cornerRadius}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} ${cornerRadius}`;
        path += ` v ${deltaY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} ${cornerRadius}`;
        path += ` h ${halfHorizontalDistance - cornerRadius}`;
        break;
      }
      case "upRight": {
        path += ` h ${halfHorizontalDistance - cornerRadius}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} -${cornerRadius}`;
        path += ` v -${absDeltaY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} -${cornerRadius}`;
        path += ` h ${halfHorizontalDistance - cornerRadius}`;
        break;
      }
      case "downLeft":
      case "downSmallHorizontal": {
        const halfwayY = startY + deltaY / 2;
        path += ` h ${stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} ${cornerRadius}`;
        path += ` v ${halfwayY - startY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} ${cornerRadius}`;
        path += ` h ${deltaX - 2 * stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} ${cornerRadius}`;
        path += ` v ${halfwayY - startY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} ${cornerRadius}`;
        path += ` h ${stepOffset}`;
        break;
      }
      case "upLeft":
      case "upSmallHorizontal": {
        const halfwayY = startY + deltaY / 2;
        path += ` h ${stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} -${cornerRadius}`;
        path += ` v -${startY - halfwayY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} -${cornerRadius}`;
        path += ` h ${deltaX - 2 * stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} -${cornerRadius}`;
        path += ` v -${startY - halfwayY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} -${cornerRadius}`;
        path += ` h ${stepOffset}`;
        break;
      }
      default: {
        // If no specific direction matched, just return the initial path
        return path;
      }
    }

    return path;
  }

  function getFFPath(): string {
    let path = initialPath;

    if (movingDown && movingLeft) {
      path += ` h ${horizontalBack - stepOffset}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} ${cornerRadius}`;
      path += ` v ${deltaY - cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} ${cornerRadius}`;
      path += ` h ${deltaX - cornerRadius * 2}`;
    } else if (movingDown && movingRight) {
      path += ` h ${deltaX + horizontalBack - stepOffset}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} ${cornerRadius}`;
      path += ` v ${deltaY - cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} ${cornerRadius}`;
      path += ` h -${horizontalBack - stepOffset}`;
    } else if (movingUp && movingLeft) {
      path += ` h ${horizontalBack - stepOffset}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} -${cornerRadius}`;
      path += ` v ${deltaY + cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} -${cornerRadius}`;
      path += ` h ${deltaX - horizontalBack + stepOffset}`;
    } else if (movingUp && movingRight) {
      path += ` h ${deltaX + horizontalBack - stepOffset}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} -${cornerRadius}`;
      path += ` v ${deltaY + cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} -${cornerRadius}`;
      path += ` h -${horizontalBack - stepOffset}`;
    }

    return path;
  }

  function getSFPath(): string {
    // Sub-helper to pick direction
    function getSFDirection(): string {
      if ((movingRight || movingLeft) && movingDown && !thresholdExceeded) {
        return "downSmallHorizontal";
      }
      if ((movingRight || movingLeft) && movingUp && !thresholdExceeded) {
        return "upSmallHorizontal";
      }
      if (movingDown && movingLeft) {
        return "downLeft";
      }
      if (movingDown && movingRight) {
        return "downRight";
      }
      if (movingUp && movingLeft) {
        return "upLeft";
      }
      if (movingUp && movingRight) {
        return "upRight";
      }
      return "";
    }

    let path = initialPath;
    const direction = getSFDirection();

    switch (direction) {
      case "downRight":
      case "downSmallHorizontal": {
        path += ` h ${-stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} ${cornerRadius}`;
        path += ` v ${halfVerticalDistance - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} ${cornerRadius}`;
        path += ` h ${stepOffset * 2 + deltaX}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} ${cornerRadius}`;
        path += ` v ${halfVerticalDistance - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} ${cornerRadius}`;
        path += ` h ${-stepOffset}`;
        break;
      }
      case "upRight":
      case "upSmallHorizontal": {
        path += ` h ${-stepOffset}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} -${cornerRadius}`;
        path += ` v ${-(halfVerticalDistance - cornerRadius * 2)}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} -${cornerRadius}`;
        path += ` h ${stepOffset * 2 + deltaX}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} -${cornerRadius}`;
        path += ` v ${-(halfVerticalDistance - cornerRadius * 2)}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} -${cornerRadius}`;
        path += ` h ${-stepOffset}`;
        break;
      }
      case "downLeft": {
        path += ` h ${-halfHorizontalDistance + cornerRadius}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} ${cornerRadius}`;
        path += ` v ${absDeltaY - cornerRadius * 2}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} ${cornerRadius}`;
        path += ` h ${-halfHorizontalDistance + cornerRadius}`;
        break;
      }
      case "upLeft": {
        path += ` h ${-(halfHorizontalDistance - cornerRadius)}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} -${cornerRadius}`;
        path += ` v ${-(absDeltaY - cornerRadius * 2)}`;
        path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} -${cornerRadius}`;
        path += ` h ${-halfHorizontalDistance + cornerRadius}`;
        break;
      }
      default:
        return path;
    }

    return path;
  }

  function getSSPath(): string {
    let path = initialPath;

    if (movingDown && movingLeft) {
      path += ` h ${deltaX - horizontalBack}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} ${cornerRadius}`;
      path += ` v ${deltaY - cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} ${cornerRadius}`;
      path += ` h ${horizontalBack}`;
    } else if (movingDown && movingRight) {
      path += ` h ${-horizontalBack}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 -${cornerRadius} ${cornerRadius}`;
      path += ` v ${deltaY - cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 0 ${cornerRadius} ${cornerRadius}`;
      path += ` h ${deltaX + horizontalBack}`;
    } else if (movingUp && movingLeft) {
      path += ` h ${deltaX - horizontalBack}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} -${cornerRadius}`;
      path += ` v ${deltaY + cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} -${cornerRadius}`;
      path += ` h ${horizontalBack}`;
    } else if (movingUp && movingRight) {
      path += ` h ${-horizontalBack}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 -${cornerRadius} -${cornerRadius}`;
      path += ` v ${deltaY + cornerRadius * 2}`;
      path += ` a ${cornerRadius} ${cornerRadius} 0 0 1 ${cornerRadius} -${cornerRadius}`;
      path += ` h ${deltaX + horizontalBack}`;
    }

    return path;
  }

  // --------------------------------------------------------------------------
  // MAIN SWITCH FOR DEPENDENCY TYPE
  // --------------------------------------------------------------------------
  switch (dependencyType) {
    case "FS":
      return getFSPath();
    case "FF":
      return getFFPath();
    case "SF":
      return getSFPath();
    case "SS":
      return getSSPath();
    default:
      // Fallback: simple line
      return `${initialPath} L ${endX} ${endY}`;
  }
}

/**
 * Arrow anchor X coordinates at both ends of a task.
 * Applies that task's live offset while it is being dragged, and connects
 * milestones at the left/right vertices of the diamond.
 */
function anchorX(task: TaskTransformed, offset: DragOffset) {
  const half = isMilestoneTask(task) ? MILESTONE_HALF_DIAGONAL : 0;
  const left = task.barLeft + offset.offsetX;

  return {
    startX: left - half,
    endX: half ? left + half : left + task.barWidth + offset.offsetWidth,
  };
}

/**
 * Where one end of a task's bar sits, in timeline content coordinates
 * The connector dots and the drag preview line have to land on the same points the
 * committed arrow will use.
 */
export function anchorPoint(
  task: TaskTransformed,
  anchor: LinkAnchor,
  offset: DragOffset = NO_OFFSET
): { x: number; y: number } {
  const { startX, endX } = anchorX(task, offset);

  return {
    x: anchor === "start" ? startX : endX,
    y: (task.order - 1) * NODE_HEIGHT + NODE_HEIGHT / 2,
  };
}

/** Warn once per type, in development mode */
const warnedDepTypes = new Set<string>();

/**
 * Computes the arrow coordinates for a single dependency.
 * targetTask is the predecessor, sourceTask the successor that owns the dependency.
 * Returns null for an unknown dependency type (only that arrow is skipped).
 */
export function calculateArrowCoords(
  sourceTask: TaskTransformed,
  targetTask: TaskTransformed,
  sourceOffset: DragOffset,
  targetOffset: DragOffset,
  depType: string
) {
  const rowHeight = NODE_HEIGHT;
  const sourceIndex = sourceTask.order - 1;
  const targetIndex = targetTask.order - 1;

  // Connect at the vertical center of the bar (classic Gantt chart style)
  const barCenterY = rowHeight / 2;
  const fromY = targetIndex * rowHeight + barCenterY;
  const toY = sourceIndex * rowHeight + barCenterY;

  // Both ends have to apply their own drag offset for the arrow to follow the bars
  const from = anchorX(targetTask, targetOffset);
  const to = anchorX(sourceTask, sourceOffset);

  // X coordinates per dependency type
  // FS: predecessor right → successor left
  // SS: predecessor left → successor left
  // FF: predecessor right → successor right
  // SF: predecessor left → successor right
  const coordinateMap = {
    FS: [from.endX, to.startX] as const,
    SS: [from.startX, to.startX] as const,
    FF: [from.endX, to.endX] as const,
    SF: [from.startX, to.endX] as const,
  };

  // Tasks come from consumer-supplied JSON, so an unknown type can arrive at runtime
  const coords: readonly [number, number] | undefined =
    coordinateMap[depType as keyof typeof coordinateMap];

  if (!coords) {
    if (import.meta.env.DEV && !warnedDepTypes.has(depType)) {
      warnedDepTypes.add(depType);
      console.warn(
        `[gantt-chart] Unknown dependency type "${depType}" - arrow skipped. Expected one of FS, SS, FF, SF.`
      );
    }
    return null;
  }

  const [fromX, toX] = coords;

  return { fromX, fromY, toX, toY };
}

/**
 * Index for looking up tasks by id.
 *
 * Built once whenever the task array changes and then reused - scanning the array
 * for every dependency costs time proportional to the square of the task count,
 * and that cost would be paid again on every drag frame.
 */
export function buildTaskIndex(
  transformedTasks: TaskTransformed[]
): Map<string, TaskTransformed> {
  return new Map(transformedTasks.map((task) => [task.id, task]));
}

/** Slack allowed when deciding whether a single arrow falls outside the viewport (px) */
const ARROW_BLEED = 32;

/** Visible area used for arrow culling */
export interface ArrowViewport {
  /** Vertical visible range (in row-virtualization terms, px) */
  topPx: number;
  bottomPx: number;
  /** Horizontal visibility - reuses the column virtualization's bar visibility check */
  isBarVisible: (left: number, width: number) => boolean;
}

/**
 * Decides whether an arrow overlaps the visible area.
 *
 * It looks at the bounding box of the two endpoints, so a line is still drawn when
 * both ends are off-screen but it crosses the viewport. The elbowed path runs a
 * little past the endpoints, hence the slack.
 */
export function isArrowVisible(
  dep: Pick<RenderedDependency, "fromX" | "fromY" | "toX" | "toY">,
  viewport: ArrowViewport
): boolean {
  const top = Math.min(dep.fromY, dep.toY) - ARROW_BLEED;
  const bottom = Math.max(dep.fromY, dep.toY) + ARROW_BLEED;
  if (bottom < viewport.topPx || top > viewport.bottomPx) return false;

  const left = Math.min(dep.fromX, dep.toX) - ARROW_BLEED;
  const right = Math.max(dep.fromX, dep.toX) + ARROW_BLEED;
  return viewport.isBarVisible(left, right - left);
}

/**
 * Builds the dependency array.
 * The index doubles as the iteration source and the lookup table
 * (insertion order = task order).
 */
export function buildDependencies(
  taskById: Map<string, TaskTransformed>,
  liveOffsets: Record<string, DragOffset>,
  criticalLinkIds?: Set<string>
): RenderedDependency[] {
  const dependencies: RenderedDependency[] = [];

  for (const currentTask of taskById.values()) {
    const sourceOffset = liveOffsets[currentTask.id] ?? NO_OFFSET;

    for (const dep of currentTask.dependencies ?? []) {
      const targetTask = taskById.get(dep.targetId);
      if (!targetTask) continue;

      const coords = calculateArrowCoords(
        currentTask,
        targetTask,
        sourceOffset,
        liveOffsets[targetTask.id] ?? NO_OFFSET,
        dep.type
      );
      if (!coords) continue;

      dependencies.push({
        ...dep,
        sourceId: currentTask.id,
        ...coords,
        critical: criticalLinkIds?.has(
          linkKey({
            predecessorId: targetTask.id,
            successorId: currentTask.id,
            type: dep.type,
            lag: dep.lag ?? 0,
          })
        ),
      });
    }
  }

  return dependencies;
}
