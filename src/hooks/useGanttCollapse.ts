import { useCallback, useMemo, useState } from "react";

/** Default collapsed list - pinned at module scope so no new array is created per render */
const EMPTY_IDS: string[] = [];

interface UseGanttCollapseParams {
  /** Controlled list - given, this is what the chart shows */
  collapsedIds?: string[];
  /** Uncontrolled seed; later changes are ignored */
  defaultCollapsedIds?: string[];
  onCollapsedChange?: (collapsedIds: string[]) => void;
}

export interface GanttCollapseState {
  /** Ids of every collapsed parent and group header */
  collapsedIds: ReadonlySet<string>;
  /** Collapses an expanded row and expands a collapsed one */
  toggle: (rowId: string) => void;
}

/**
 * Which rows are collapsed, controlled by the host or by the chart itself
 *
 * Passing `collapsedIds` hands the decision to the host: the chart reports the
 * next list through `onCollapsedChange` and shows nothing new until the prop
 * comes back changed. Without it the chart keeps the list itself and the callback
 * is only a notification.
 */
export function useGanttCollapse({
  collapsedIds,
  defaultCollapsedIds,
  onCollapsedChange,
}: UseGanttCollapseParams): GanttCollapseState {
  const [uncontrolled, setUncontrolled] = useState<string[]>(
    () => defaultCollapsedIds ?? EMPTY_IDS
  );
  const collapsed = collapsedIds ?? uncontrolled;
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const toggle = useCallback(
    (rowId: string) => {
      const next = collapsed.includes(rowId)
        ? collapsed.filter((id) => id !== rowId)
        : [...collapsed, rowId];

      // In controlled mode the screen stays put until the prop changes - the host decides
      if (collapsedIds === undefined) setUncontrolled(next);
      onCollapsedChange?.(next);
    },
    [collapsed, collapsedIds, onCollapsedChange]
  );

  return { collapsedIds: collapsedSet, toggle };
}
