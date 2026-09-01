import { MILESTONE_HALF_DIAGONAL, NODE_HEIGHT } from "constants/gantt";
import {
  isMilestoneTask,
  RenderedDependency,
  TaskTransformed,
} from "types/task";

/** 드래그 중인 태스크의 라이브 오프셋 (드래그 중이 아니면 0) */
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
 * 태스크 양 끝의 화살표 앵커 X 좌표.
 * 드래그 중이면 해당 태스크의 라이브 오프셋을 반영하고,
 * 마일스톤은 다이아몬드 좌/우 꼭짓점에 연결한다.
 */
function anchorX(task: TaskTransformed, offset: DragOffset) {
  const half = isMilestoneTask(task) ? MILESTONE_HALF_DIAGONAL : 0;
  const left = task.barLeft + offset.offsetX;

  return {
    startX: left - half,
    endX: half ? left + half : left + task.barWidth + offset.offsetWidth,
  };
}

/** 개발 모드에서 타입별로 한 번만 경고 */
const warnedDepTypes = new Set<string>();

/**
 * 의존성 하나의 화살표 좌표 계산.
 * targetTask가 선행(predecessor), sourceTask가 의존성을 소유한 후행(successor).
 * 알 수 없는 의존성 타입이면 null (해당 화살표만 건너뜀).
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

  // 바 중앙 높이에서 연결 (전통적인 Gantt 차트 스타일)
  const barCenterY = rowHeight / 2;
  const fromY = targetIndex * rowHeight + barCenterY;
  const toY = sourceIndex * rowHeight + barCenterY;

  // 양쪽 끝 모두 자기 자신의 드래그 오프셋을 반영해야 화살표가 바를 따라온다
  const from = anchorX(targetTask, targetOffset);
  const to = anchorX(sourceTask, sourceOffset);

  // 의존성 타입에 따른 X 좌표 설정
  // FS: 선행 태스크 우측 → 후행 태스크 좌측
  // SS: 선행 태스크 좌측 → 후행 태스크 좌측
  // FF: 선행 태스크 우측 → 후행 태스크 우측
  // SF: 선행 태스크 좌측 → 후행 태스크 우측
  const coordinateMap = {
    FS: [from.endX, to.startX] as const,
    SS: [from.startX, to.startX] as const,
    FF: [from.endX, to.endX] as const,
    SF: [from.startX, to.endX] as const,
  };

  // 태스크는 consumer가 넘기는 JSON이라 런타임에 알 수 없는 타입이 올 수 있다
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

/** 의존성 배열 빌드 */
export function buildDependencies(
  transformedTasks: TaskTransformed[],
  liveOffsets: Record<string, DragOffset>
): RenderedDependency[] {
  const dependencies: RenderedDependency[] = [];

  for (const currentTask of transformedTasks) {
    const sourceOffset = liveOffsets[currentTask.id] ?? NO_OFFSET;

    for (const dep of currentTask.dependencies ?? []) {
      const targetTask = transformedTasks.find((t) => t.id === dep.targetId);
      if (!targetTask) continue;

      const coords = calculateArrowCoords(
        currentTask,
        targetTask,
        sourceOffset,
        liveOffsets[targetTask.id] ?? NO_OFFSET,
        dep.type
      );
      if (!coords) continue;

      dependencies.push({ ...dep, ...coords });
    }
  }

  return dependencies;
}
