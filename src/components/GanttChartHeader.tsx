import { GANTT_SCALE_CONFIG } from "constants/gantt";
import React, { useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { mergeHeaderGroups } from "utils/headerUtils";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  /** 사용하지 않음 - 상단 그룹 라벨 고정은 CSS sticky로 처리 */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Gantt 차트 헤더 컴포넌트
 * 상단 그룹 라벨과 하단 시간 셀을 표시
 */
function GanttChartHeader({
  bottomRowCells,
  selectedScale,
  width,
}: GanttChartHeaderProps) {
  const config = GANTT_SCALE_CONFIG[selectedScale];

  // 헤더 그룹 생성 및 병합 (memoized)
  const topGroups = useMemo(
    () =>
      mergeHeaderGroups(createTopHeaderGroups(bottomRowCells, selectedScale)),
    [bottomRowCells, selectedScale]
  );

  return (
    <header className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* 상단 헤더 그룹 */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {topGroups.map((group, idx) => (
              <div
                key={`${group.label}-${idx}`}
                className="gantt-top-group"
                style={{ width: `${group.widthPx}px` }}
              >
                <p className="gantt-top-group-label">{group.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 시간 셀 */}
        <div className="gantt-bottom-row">
          {bottomRowCells.map((cell, idx) => {
            const tickLabel = config.formatTickLabel?.(cell.startDate) || "";

            return (
              <div
                key={`bottom-${idx}`}
                className="gantt-bottom-cell"
                style={{ width: `${cell.widthPx}px` }}
              >
                {tickLabel}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default GanttChartHeader;
