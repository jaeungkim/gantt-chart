import { useEffect, useRef } from "react";
import { useLatestRef } from "shared/hooks/useLatestRef";
import { GanttScaleKey } from "shared/types";

export function useGanttScaleReport(
  selectedScale: GanttScaleKey,
  onScaleChange?: (scale: GanttScaleKey) => void
): void {
  const reportRef = useLatestRef(onScaleChange);
  const reportedRef = useRef(selectedScale);

  useEffect(() => {
    if (selectedScale === reportedRef.current) return;

    reportedRef.current = selectedScale;
    reportRef.current?.(selectedScale);
  }, [selectedScale, reportRef]);
}
