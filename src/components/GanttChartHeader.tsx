import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useGanttColumnVirtualization } from "hooks/useGanttVirtualization";
import React, { useMemo } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { mergeHeaderGroups } from "utils/headerUtils";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  /** 하단 시간 셀 가상화용 스크롤 컨테이너 (상단 그룹 라벨 고정은 CSS sticky로 처리) */
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Gantt 차트 헤더 컴포넌트
 * 상단 그룹 라벨과 하단 시간 셀을 표시
 */
function GanttChartHeader({
  bottomRowCells,
  selectedScale,
  width,
  scrollRef,
}: GanttChartHeaderProps) {
  const config = GANTT_SCALE_CONFIG[selectedScale];

  // 하단 셀은 열 가상화 - day 스케일의 긴 범위는 셀이 수천 개다
  // (상단 그룹은 병합된 소수의 라벨이라 그대로 그린다)
  const { columnVirtualizer } = useGanttColumnVirtualization({
    bottomRowCells,
    scrollRef,
  });
  const virtualCells = columnVirtualizer.getVirtualItems();
  const leadingPx = virtualCells[0]?.start ?? 0;

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

        {/* 하단 시간 셀 (가시 영역만) */}
        <div className="gantt-bottom-row">
          {/* 건너뛴 앞쪽 셀들의 폭 - flex 흐름을 그대로 두려고 스페이서로 민다 */}
          <div style={{ width: `${leadingPx}px` }} aria-hidden="true" />
          {virtualCells.map((virtualCell) => {
            const cell = bottomRowCells[virtualCell.index];
            if (!cell) return null;

            const tickLabel = config.formatTickLabel?.(cell.startDate) || "";

            return (
              <div
                key={`bottom-${virtualCell.index}`}
                className="gantt-bottom-cell"
                style={{ width: `${virtualCell.size}px` }}
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
