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
