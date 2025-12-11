import { GANTT_SCALE_CONFIG } from "constants/gantt";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { GanttBottomRowCell, GanttScaleKey } from "types/gantt";
import { processHeaderGroups } from "utils/headerUtils";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
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
  const [stickyIndex, setStickyIndex] = useState(0);

  // 헤더 그룹 생성 및 처리 (memoized)
  const groupsWithPositions = useMemo(() => {
    const topGroups = createTopHeaderGroups(bottomRowCells, selectedScale);
    return processHeaderGroups(topGroups);
  }, [bottomRowCells, selectedScale]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;

    // 가로 스크롤 시 sticky 헤더 인덱스 업데이트
    for (let i = groupsWithPositions.length - 1; i >= 0; i--) {
      if (scrollLeft >= groupsWithPositions[i].left) {
        setStickyIndex(i);
        break;
      }
    }
  }, [groupsWithPositions, scrollRef]);

  // 스크롤 리스너 등록
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, scrollRef]);

  return (
    <header className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* 상단 헤더 그룹 */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {groupsWithPositions.map((group, idx) => {
              const isSticky = idx === stickyIndex;
              return (
                <div
                  key={`${group.label}-${idx}`}
                  className={`gantt-top-group${isSticky ? " sticky" : ""}`}
                  style={{
                    width: `${group.widthPx}px`,
                    ...(isSticky && { left: 0 }),
                  }}
                >
                  <p className="gantt-top-group-label">{group.label}</p>
                </div>
              );
            })}
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
