// ms a finger must rest on a bar before the drag lifts
export const TOUCH_LONG_PRESS_MS = 400;
// px the finger may drift during that wait before the press reads as a scroll
export const TOUCH_SLOP_PX = 10;

interface PointerGestureStart {
  pointerType: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}

// Mouse starts at once; touch/pen wait out a long press within the slop. Returns the abort, null for mouse.
export function armPointerGesture(
  start: PointerGestureStart,
  onStart: (clientX: number, clientY: number) => void,
  target: EventTarget = document
): (() => void) | null {
  if (start.pointerType === 'mouse') {
    onStart(start.clientX, start.clientY);
    return null;
  }

  // Lift from where the finger ended up, not where it landed, so the first drag step is not skewed
  let currentX = start.clientX;
  let currentY = start.clientY;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    target.removeEventListener('pointermove', handleMove);
    target.removeEventListener('pointerup', handleEnd);
    target.removeEventListener('pointercancel', handleEnd);
  };

  function handleMove(event: Event) {
    const moveEvent = event as PointerEvent;
    if (moveEvent.pointerId !== start.pointerId) return;

    const drift =
      Math.abs(moveEvent.clientX - start.clientX) +
      Math.abs(moveEvent.clientY - start.clientY);

    // Past the slop the browser is panning, not the user pressing - let it scroll
    if (drift > TOUCH_SLOP_PX) {
      cancel();
      return;
    }

    currentX = moveEvent.clientX;
    currentY = moveEvent.clientY;
  }

  function handleEnd(event: Event) {
    if ((event as PointerEvent).pointerId !== start.pointerId) return;
    cancel();
  }

  target.addEventListener('pointermove', handleMove);
  target.addEventListener('pointerup', handleEnd);
  target.addEventListener('pointercancel', handleEnd);

  timer = setTimeout(() => {
    cancel();
    onStart(currentX, currentY);
  }, TOUCH_LONG_PRESS_MS);

  return cancel;
}

// Bars stay pannable, so scroll is blocked with preventDefault - which needs a non-passive listener.
export function suppressTouchScroll(): () => void {
  const block = (event: Event) => event.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  return () => document.removeEventListener('touchmove', block);
}
