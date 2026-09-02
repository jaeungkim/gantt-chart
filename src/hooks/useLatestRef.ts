import { RefObject, useLayoutEffect, useRef } from "react";

/**
 * Keeps the newest value of something in a ref, for listeners to read at event time
 *
 * A `scroll` or `wheel` handler is registered once and then outlives every render,
 * so reading a captured value there would read whatever it was when the listener
 * was attached. Reading `ref.current` instead always sees the current render's value
 * without re-subscribing the listener on every change.
 *
 * Written in a layout effect rather than during render, and - because a hook's own
 * effects run in the order they are declared - calling this first in a hook means
 * every effect below it already sees the fresh value.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  });

  return ref;
}
