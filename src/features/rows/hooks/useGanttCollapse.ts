import { useMemo, useState } from "react";

interface UseGanttCollapseParams {
  collapsedIds?: string[];
  defaultCollapsedIds?: string[];
  onCollapsedChange?: (collapsedIds: string[]) => void;
}

interface GanttCollapseState {
  collapsedIds: ReadonlySet<string>;
  toggle: (rowId: string) => void;
  expand: (rowId: string) => void;
}

export function useGanttCollapse({
  collapsedIds,
  defaultCollapsedIds,
  onCollapsedChange,
}: UseGanttCollapseParams): GanttCollapseState {
  const [uncontrolled, setUncontrolled] = useState<string[]>(
    () => defaultCollapsedIds ?? []
  );
  const collapsed = collapsedIds ?? uncontrolled;
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const toggle = (rowId: string) => {
    const next = collapsed.includes(rowId)
      ? collapsed.filter((id) => id !== rowId)
      : [...collapsed, rowId];
    if (collapsedIds === undefined) setUncontrolled(next);
    onCollapsedChange?.(next);
  };

  const expand = (rowId: string) => {
    if (collapsed.includes(rowId)) toggle(rowId);
  };

  return { collapsedIds: collapsedSet, toggle, expand };
}
