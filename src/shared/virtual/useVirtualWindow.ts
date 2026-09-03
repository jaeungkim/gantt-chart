import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { VirtualAxis } from 'shared/virtual/axis';
import type { ScrollDirection, VirtualWindow } from 'shared/virtual/window';
import { fullWindow, sameWindow, windowOf } from 'shared/virtual/window';

export type ScrollAlign = 'start' | 'center' | 'end' | 'auto';

interface UseVirtualWindowParams {
  scrollRef: RefObject<HTMLElement | null>;
  row: VirtualAxis;
  col: VirtualAxis;
}

interface VirtualWindows {
  row: VirtualWindow;
  col: VirtualWindow;
  scrollToRow: (index: number, align?: ScrollAlign) => void;
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
      row: windowOf(row, scrollTop, clientHeight, 5, rowDirection),
      col: windowOf(col, scrollLeft, clientWidth, 5, colDirection),
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

  const scrollToRow = useCallback(
    (index: number, align: ScrollAlign = 'start') => {
      const element = scrollRef.current;
      if (!element || index < 0 || index >= row.count) return;

      const viewport = element.clientHeight;
      const start = row.offsetAt(index);
      const size = row.sizeAt(index);
      const current = element.scrollTop;

      let next = start;
      if (align === 'center') next = start - (viewport - size) / 2;
      else if (align === 'end') next = start - viewport + size;
      else if (align === 'auto') {
        if (start >= current && start + size <= current + viewport) return;
        next = start < current ? start : start - viewport + size;
      }

      element.scrollTo({ top: Math.max(0, next) });
    },
    [scrollRef, row],
  );

  return { row: windows.row, col: windows.col, scrollToRow };
}

function directionOf(next: number, previous: number): ScrollDirection {
  if (next > previous) return 1;
  if (next < previous) return -1;
  return 0;
}
