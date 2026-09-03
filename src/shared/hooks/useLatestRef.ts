import { RefObject, useLayoutEffect, useRef } from "react";

// Lets a listener registered once read the current render's value via `ref.current`.
// Declare it first in a hook: effects run in declaration order, so every effect below sees the
// fresh value.
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);

  useLayoutEffect(() => {
    ref.current = value;
  });

  return ref;
}
