import { useCallback, useMemo, useState } from "react";

// Module scope, so no new array is created per render
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
  /** Expands a row, doing nothing when it is already open */
  expand: (rowId: string) => void;
}

/** Which rows are collapsed - `collapsedIds` hands the decision to the host, otherwise the chart keeps the list */
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

  // Controlled mode: the screen only moves once the prop comes back changed
  const commit = useCallback(
    (next: string[]) => {
      if (collapsedIds === undefined) setUncontrolled(next);
      onCollapsedChange?.(next);
    },
    [collapsedIds, onCollapsedChange]
  );

  const toggle = useCallback(
    (rowId: string) => {
      commit(
        collapsed.includes(rowId)
          ? collapsed.filter((id) => id !== rowId)
          : [...collapsed, rowId]
      );
    },
    [collapsed, commit]
  );

  const expand = useCallback(
    (rowId: string) => {
      if (!collapsed.includes(rowId)) return;
      commit(collapsed.filter((id) => id !== rowId));
    },
    [collapsed, commit]
  );

  return { collapsedIds: collapsedSet, toggle, expand };
}
