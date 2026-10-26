import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { VirtualAxis } from 'shared/virtual/axis';
import type { ScrollDirection, VirtualWindow } from 'shared/virtual/window';
import { fullWindow, OVERSCAN, sameWindow, windowOf } from 'shared/virtual/window';

interface UseVirtualWindowParams {
  scrollRef: RefObject<HTMLElement | null>;
  row: VirtualAxis;
  col: VirtualAxis;
}

interface VirtualWindows {
  row: VirtualWindow;
  col: VirtualWindow;
  sync: () => void;
}

// Both axes from one subscription, so header and bars can never disagree.
export function useVirtualWindow({
  scrollRef,
  row,
  col,
}: UseVirtualWindowParams): VirtualWindows {
  const [windows, setWindows] = useState(() => ({
    row: fullWindow(row.count),
    col: fullWindow(col.count),
  }));

  const lastScroll = useRef({ top: 0, left: 0 });
  const frame = useRef(0);

  const sync = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    const { scrollTop, scrollLeft, clientHeight, clientWidth } = element;
    const rowDirection = directionOf(scrollTop, lastScroll.current.top);
    const colDirection = directionOf(scrollLeft, lastScroll.current.left);
    lastScroll.current = { top: scrollTop, left: scrollLeft };

    const next = {
      row: windowOf(row, scrollTop, clientHeight, OVERSCAN, rowDirection),
      col: windowOf(col, scrollLeft, clientWidth, OVERSCAN, colDirection),
    };

    setWindows((prev) =>
      sameWindow(prev.row, next.row) && sameWindow(prev.col, next.col)
        ? prev
        : next,
    );
  }, [scrollRef, row, col]);

  const onScroll = useCallback(() => {
    if (frame.current !== 0) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      sync();
    });
  }, [sync]);

  // Layout effect: the element exists only after commit; an axis change re-measures here.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    sync();
    element.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [scrollRef, onScroll, sync]);

  useEffect(
    () => () => {
      if (frame.current !== 0) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { ...windows, sync };
}

function directionOf(next: number, previous: number): ScrollDirection {
  if (next > previous) return 1;
  if (next < previous) return -1;
  return 0;
}
