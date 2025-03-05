/**
 * Registers a drag event with mouse movement.
 */
export function registerMouseDownDrag(
    onDragChange: (deltaX: number, deltaY: number) => void,
    stopPropagation?: boolean,
  ) {
    return {
      onMouseDown: (clickEvent: React.MouseEvent) => {
        if (stopPropagation) clickEvent.stopPropagation();
  
        const mouseMoveHandler = (moveEvent: MouseEvent) => {
          onDragChange(
            moveEvent.screenX - clickEvent.screenX,
            moveEvent.screenY - clickEvent.screenY,
          );
        };
  
        const mouseUpHandler = () => {
          document.removeEventListener('mousemove', mouseMoveHandler);
        };
  
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler, { once: true });
      },
    };
  }
  