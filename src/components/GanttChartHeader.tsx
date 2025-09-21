import { GANTT_SCALE_CONFIG } from "constants/gantt";
import React, { useEffect, useState, useCallback } from "react";
import { useGanttStore } from "stores/store";
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from "types/gantt";
import { createTopHeaderGroups } from "utils/timeline";

interface GanttChartHeaderProps {
  topHeaderGroups: GanttTopHeaderGroup[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  width: number;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({
  bottomRowCells,
  selectedScale,
  width,
  scrollRef,
}) => {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const [stickyIndex, setStickyIndex] = useState(0);

  const currentTask = useGanttStore((state) => state.currentTask);
  const getCurrentDragOffset = useGanttStore(
    (state) => state.getCurrentDragOffset
  );

  // Get drag offset for current task
  const dragOffset = currentTask ? getCurrentDragOffset(currentTask.id) : null;

  // Create top header groups (simplified without useMemo)
  const topGroups = createTopHeaderGroups(bottomRowCells, selectedScale);

  // Merge groups with same labels (simplified without useMemo)
  const mergedGroups: GanttTopHeaderGroup[] = [];
  for (const group of topGroups) {
    const last = mergedGroups[mergedGroups.length - 1];
    if (last && last.label === group.label) {
      last.widthPx += group.widthPx;
    } else {
      mergedGroups.push({ ...group });
    }
  }

  // Add left positions to merged groups (simplified without useMemo)
  let offset = 0;
  const mergedGroupsWithLeft = mergedGroups.map((group) => {
    const g = { ...group, left: offset };
    offset += group.widthPx;
    return g;
  });

  // Handle scroll to update sticky index
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const scrollLeft = el.scrollLeft;
    for (let i = mergedGroupsWithLeft.length - 1; i >= 0; i--) {
      if (scrollLeft >= mergedGroupsWithLeft[i].left) {
        setStickyIndex(i);
        break;
      }
    }
  }, [mergedGroupsWithLeft, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial call
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, scrollRef]);

  return (
    <div className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* Top header groups */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {mergedGroupsWithLeft.map((group, idx) => {
              const isSticky = idx === stickyIndex;
              return (
                <div
                  key={idx}
                  className={`gantt-top-group ${isSticky ? "sticky" : ""}`}
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

        {/* Bottom row cells */}
        <div className="gantt-bottom-row">
          <div>
            {/* Drag preview */}
            {dragOffset && currentTask && (
              <div
                className="gantt-drag-preview"
                style={{
                  left: `${dragOffset.offsetX + (currentTask?.barLeft ?? 0)}px`,
                  width: `${
                    dragOffset.offsetWidth + (currentTask?.barWidth ?? 0)
                  }px`,
                }}
              >
                {selectedScale === "week" && (
                  <>
                    <p>{dragOffset.offsetStartDate.format("h A")}</p>
                    <p>{dragOffset.offsetEndDate.format("h A")}</p>
                  </>
                )}
                {selectedScale === "year" && (
                  <>
                    <p>{dragOffset.offsetStartDate.format("D")}</p>
                    <p>{dragOffset.offsetEndDate.format("D")}</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom row cells */}
          {bottomRowCells.map((cell, idx) => {
            const tickLabel = config.formatTickLabel?.(cell.startDate) || "";
            const bottomRowCellKey = `bottom-row-${cell.startDate}-${idx}`;

            return (
              <div
                key={bottomRowCellKey}
                className="gantt-bottom-cell"
                style={{ width: `${cell.widthPx}px` }}
              >
                {tickLabel}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttChartHeader;
