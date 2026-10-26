import { useEffect, useRef } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttBottomRowCell, GanttDateRange, GanttScaleKey } from "shared/types";
import { timelineRange } from "features/timeline/utils/geometry";

/** Reports the rendered timeline range - the hook a host lazy-loads tasks from */
export function useGanttRangeReport(
  bottomRowCells: GanttBottomRowCell[],
  selectedScale: GanttScaleKey,
  onRangeChange?: (range: GanttDateRange) => void
): void {
  const scaleRef = useLatestRef(selectedScale);
  const reportRef = useLatestRef(onRangeChange);
  const reportedRef = useRef("");

  useEffect(() => {
    const report = reportRef.current;
    if (!report) return;

    const range = timelineRange(bottomRowCells, scaleRef.current);
    if (!range) return;

    // Fires on a real range change only - a re-render with the same dates is not one
    const key = `${range.start.valueOf()}:${range.end.valueOf()}`;
    if (key === reportedRef.current) return;

    reportedRef.current = key;
    report(range);
  }, [bottomRowCells, scaleRef, reportRef]);
}
