import { useEffect, useRef } from "react";
import dayjs from "core/dates";
import { GanttBottomRowCell } from "shared/types";
import { GanttScrollApi } from "features/timeline/types";

export function useGanttInitialScroll(
  initialScrollTo: "today" | string | undefined,
  bottomRowCells: GanttBottomRowCell[],
  scrollApi: GanttScrollApi
): void {
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current || !initialScrollTo) return;
    if (!bottomRowCells.length) return;

    doneRef.current = true;
    const target = initialScrollTo === "today" ? dayjs() : initialScrollTo;
    scrollApi.scrollToDate(target, { smooth: false });
  }, [initialScrollTo, bottomRowCells, scrollApi]);
}
