import { useMemo } from "react";
import { GanttBottomRowCell } from "types/gantt";
import dayjs from "utils/dayjs";

interface TodayMarkerProps {
  bottomRowCells: GanttBottomRowCell[];
  height: number;
}

/**
 * 오늘 날짜를 표시하는 세로선 마커
 * 타임라인 내에서 현재 위치를 시각적으로 표시
 */
export default function TodayMarker({
  bottomRowCells,
  height,
}: TodayMarkerProps) {
  // 오늘 위치 계산
  const todayPosition = useMemo(() => {
    if (bottomRowCells.length === 0) return null;

    const today = dayjs();
    let accumulatedPx = 0;

    for (let i = 0; i < bottomRowCells.length; i++) {
      const cell = bottomRowCells[i];
      const cellStart = cell.startDate;
      // 다음 셀의 시작일이 현재 셀의 종료일
      const nextCell = bottomRowCells[i + 1];
      const cellEnd = nextCell?.startDate ?? cellStart.add(1, "day");

      // 오늘이 이 셀 범위 내에 있는지 확인
      if (today.isSameOrAfter(cellStart) && today.isBefore(cellEnd)) {
        // 셀 내에서 오늘의 비율 계산
        const cellDuration = cellEnd.diff(cellStart);
        const todayOffset = today.diff(cellStart);
        const ratio = todayOffset / cellDuration;
        return accumulatedPx + ratio * cell.widthPx;
      }

      accumulatedPx += cell.widthPx;
    }

    // 오늘이 범위를 벗어나면 표시하지 않음
    return null;
  }, [bottomRowCells]);

  // 범위 밖이면 렌더링하지 않음
  if (todayPosition === null) return null;

  return (
    <div
      className="gantt-today-marker"
      style={{ left: `${todayPosition}px`, height: `${height}px` }}
      role="presentation"
      aria-label="Today"
    >
      <span className="gantt-today-label">Today</span>
    </div>
  );
}

