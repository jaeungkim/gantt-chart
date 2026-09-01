/** How long a finger has to rest on a bar before the drag lifts (ms) */
export const TOUCH_LONG_PRESS_MS = 400;
/** How far the finger may drift during that wait before the press is read as a scroll (px) */
export const TOUCH_SLOP_PX = 10;

export interface PointerGestureStart {
  pointerType: string;
  pointerId: number;
  clientX: number;
  clientY: number;
}

/**
 * Starts a drag gesture the way the pointer that began it expects.
 *
 * A mouse press is unambiguous, so `onStart` runs immediately and nothing changes
 * for existing behavior. Touch and pen have to be disambiguated from a scroll:
 * `onStart` runs only once the pointer has stayed within `TOUCH_SLOP_PX` for
 * `TOUCH_LONG_PRESS_MS`, so a swipe over a bar still scrolls the timeline and only
 * a deliberate press lifts it.
 *
 * Returns the function that aborts a pending long press, or null when the gesture
 * already started (a mouse, or nothing left to abort).
 */
export function armPointerGesture(
  start: PointerGestureStart,
  onStart: (clientX: number, clientY: number) => void,
  target: EventTarget = document
): (() => void) | null {
  if (start.pointerType === 'mouse') {
    onStart(start.clientX, start.clientY);
    return null;
  }

  // The finger usually drifts a pixel or two while resting - lift from where it
  // ended up, not from where it landed, so the first drag step is not skewed
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

/**
 * Stops the browser from scrolling while a touch drag is running.
 *
 * `touch-action` is fixed when the gesture starts, and bars have to allow panning
 * so a swipe can scroll - so once the long press lifts a bar, the scroll has to be
 * suppressed here instead. The listener must be non-passive for that to work.
 */
export function suppressTouchScroll(target: EventTarget = document): () => void {
  const block = (event: Event) => event.preventDefault();
  target.addEventListener('touchmove', block, { passive: false });
  return () => target.removeEventListener('touchmove', block);
}
