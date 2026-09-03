import { NODE_HEIGHT } from "shared/constants";
import {
  RenderedDependency,
  TaskTransformed,
} from "shared/task";
import { LinkAnchor } from "dependencies/utils/link";

// Live offset of the task being dragged (0 when it is not being dragged)
interface DragOffset {
  offsetX: number;
  offsetWidth: number;
}

const NO_OFFSET: DragOffset = { offsetX: 0, offsetWidth: 0 };

// SVG <path> `d` for an FS, FF, SF or SS dependency; anything else falls back to a straight line
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

  const initialPath = `M ${startX} ${startY}`;

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  const movingUp = endY <= startY;
  const movingDown = endY >= startY;
  const movingRight = endX >= startX;
  const movingLeft = endX <= startX;

  const thresholdExceeded = absDeltaX > minHorizontalThreshold;
  const halfHorizontalDistance = Math.abs(deltaX / 2);
  const halfVerticalDistance = Math.abs(deltaY / 2);

  function getFSPath(): string {
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
      return "";
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
      return `${initialPath} L ${endX} ${endY}`;
  }
}

// Arrow anchor X at both ends of a task, with that task's live drag offset applied
function anchorX(task: TaskTransformed, offset: DragOffset) {
  const left = task.barLeft + offset.offsetX;

  return {
    startX: left,
    endX: left + task.barWidth + offset.offsetWidth,
  };
}

// Where one end of a bar sits, in content coordinates
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

const warnedDepTypes = new Set<string>();

// targetTask is the predecessor, sourceTask the successor; null means an unknown type, arrow skipped
function calculateArrowCoords(
  sourceTask: TaskTransformed,
  targetTask: TaskTransformed,
  sourceOffset: DragOffset,
  targetOffset: DragOffset,
  depType: string
) {
  const rowHeight = NODE_HEIGHT;
  const sourceIndex = sourceTask.order - 1;
  const targetIndex = targetTask.order - 1;

  const barCenterY = rowHeight / 2;
  const fromY = targetIndex * rowHeight + barCenterY;
  const toY = sourceIndex * rowHeight + barCenterY;

  // Both ends have to apply their own drag offset for the arrow to follow the bars
  const from = anchorX(targetTask, targetOffset);
  const to = anchorX(sourceTask, sourceOffset);

  // Predecessor end to successor end: FS right/left, SS left/left, FF right/right, SF left/right
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

// Built once per task-array change: a per-dependency scan would be O(n^2) on every drag frame
export function buildTaskIndex(
  transformedTasks: TaskTransformed[]
): Map<string, TaskTransformed> {
  return new Map(transformedTasks.map((task) => [task.id, task]));
}

// Slack for arrow culling - the elbowed path runs a little past the endpoints (px)
const ARROW_BLEED = 32;

export interface ArrowViewport {
  topPx: number;
  bottomPx: number;
  isBarVisible: (left: number, width: number) => boolean;
}

// Bounding box of both endpoints, so an arrow crossing the viewport with both ends off-screen draws
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

// The index doubles as the iteration source and the lookup table (insertion order = task order)
export function buildDependencies(
  taskById: Map<string, TaskTransformed>,
  liveOffsets: Record<string, DragOffset>,
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
      });
    }
  }

  return dependencies;
}
