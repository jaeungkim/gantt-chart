import { GANTT_SCALE_CONFIG } from "constants/gantt";
import React, { useEffect, useState } from "react";
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

// Helper function to merge groups with same labels
function mergeHeaderGroups(
  groups: GanttTopHeaderGroup[]
): GanttTopHeaderGroup[] {
  const merged: GanttTopHeaderGroup[] = [];

  for (const group of groups) {
    const last = merged[merged.length - 1];
    if (last && last.label === group.label) {
      last.widthPx += group.widthPx;
    } else {
      merged.push({ ...group });
    }
  }

  return merged;
}

// Helper function to add left positions to groups
function addLeftPositions(
  groups: GanttTopHeaderGroup[]
): (GanttTopHeaderGroup & { left: number })[] {
  let offset = 0;
  return groups.map((group) => {
    const groupWithLeft = { ...group, left: offset };
    offset += group.widthPx;
    return groupWithLeft;
  });
}

// Drag preview component
function DragPreview({
  dragOffset,
  currentTask,
  selectedScale,
}: {
  dragOffset: any;
  currentTask: any;
  selectedScale: GanttScaleKey;
}) {
  if (!dragOffset || !currentTask) return null;

  return (
    <div
      className="gantt-drag-preview"
      style={{
        left: `${dragOffset.offsetX + (currentTask?.barLeft ?? 0)}px`,
        width: `${dragOffset.offsetWidth + (currentTask?.barWidth ?? 0)}px`,
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
  );
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

  // Create and process header groups
  const topGroups = createTopHeaderGroups(bottomRowCells, selectedScale);
  const mergedGroups = mergeHeaderGroups(topGroups);
  const groupsWithPositions = addLeftPositions(mergedGroups);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      for (let i = groupsWithPositions.length - 1; i >= 0; i--) {
        if (scrollLeft >= groupsWithPositions[i].left) {
          setStickyIndex(i);
          break;
        }
      }
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial call
    return () => el.removeEventListener("scroll", handleScroll);
  }, [groupsWithPositions, scrollRef]);

  return (
    <div className="gantt-header" style={{ width: `${width}px` }}>
      <div className="gantt-header-content">
        {/* Top header groups */}
        <div className="gantt-top-header">
          <div className="gantt-top-groups">
            {groupsWithPositions.map((group, idx) => {
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
            <DragPreview
              dragOffset={dragOffset}
              currentTask={currentTask}
              selectedScale={selectedScale}
            />
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
