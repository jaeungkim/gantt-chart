import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  armPointerGesture,
  TOUCH_LONG_PRESS_MS,
  TOUCH_SLOP_PX,
} from './pointerGesture';

/** A pointer event carrying only the fields the helper reads */
const pointerEvent = (
  type: string,
  detail: { pointerId: number; clientX: number; clientY: number }
) => Object.assign(new Event(type), detail);

const touchStart = {
  pointerType: 'touch',
  pointerId: 1,
  clientX: 100,
  clientY: 200,
};

let target: EventTarget;

beforeEach(() => {
  vi.useFakeTimers();
  target = new EventTarget();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('armPointerGesture', () => {
  it('starts a mouse drag immediately', () => {
    const onStart = vi.fn();

    const cancel = armPointerGesture(
      { pointerType: 'mouse', pointerId: 1, clientX: 10, clientY: 20 },
      onStart,
      target
    );

    expect(onStart).toHaveBeenCalledWith(10, 20);
    expect(cancel).toBeNull();
  });

  it('waits for a long press before starting a touch drag', () => {
    const onStart = vi.fn();
    armPointerGesture(touchStart, onStart, target);

    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS - 1);
    expect(onStart).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStart).toHaveBeenCalledWith(100, 200);
  });

  it('lifts from where the finger settled, not where it landed', () => {
    const onStart = vi.fn();
    armPointerGesture(touchStart, onStart, target);

    target.dispatchEvent(
      pointerEvent('pointermove', { pointerId: 1, clientX: 103, clientY: 201 })
    );
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);

    expect(onStart).toHaveBeenCalledWith(103, 201);
  });

  it('gives the gesture up to the scroll once the finger passes the slop', () => {
    const onStart = vi.fn();
    armPointerGesture(touchStart, onStart, target);

    target.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        clientX: 100 + TOUCH_SLOP_PX + 1,
        clientY: 200,
      })
    );
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS * 2);

    expect(onStart).not.toHaveBeenCalled();
  });

  it('ignores a second finger while the first is resting', () => {
    const onStart = vi.fn();
    armPointerGesture(touchStart, onStart, target);

    target.dispatchEvent(
      pointerEvent('pointermove', { pointerId: 2, clientX: 400, clientY: 400 })
    );
    target.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 2, clientX: 400, clientY: 400 })
    );
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS);

    expect(onStart).toHaveBeenCalledWith(100, 200);
  });

  it('starts nothing when the touch ends before the press completes (a tap)', () => {
    const onStart = vi.fn();
    armPointerGesture(touchStart, onStart, target);

    target.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 200 })
    );
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS * 2);

    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts nothing after the caller cancels', () => {
    const onStart = vi.fn();
    const cancel = armPointerGesture(touchStart, onStart, target);

    cancel?.();
    vi.advanceTimersByTime(TOUCH_LONG_PRESS_MS * 2);

    expect(onStart).not.toHaveBeenCalled();
  });
});
