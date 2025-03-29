import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import React, { useEffect, useMemo, useState } from 'react';
import {
  GanttBottomRowCell,
  GanttScaleKey,
  GanttTopHeaderGroup,
} from 'types/gantt';
import { createTopHeaderGroups } from 'utils/timeline';

interface GanttChartHeaderProps {
  topHeaderGroups: GanttTopHeaderGroup[];
  bottomRowCells: GanttBottomRowCell[];
  selectedScale: GanttScaleKey;
  scrollRef: React.RefObject<HTMLDivElement>;
}

const GanttChartHeader: React.FC<GanttChartHeaderProps> = ({
  bottomRowCells,
  selectedScale,
  scrollRef,
}) => {
  const config = GANTT_SCALE_CONFIG[selectedScale];
  const [stickyIndex, setStickyIndex] = useState(0);

  // Top header groups
  const topGroups = useMemo(
    () => createTopHeaderGroups(bottomRowCells, selectedScale),
    [bottomRowCells, selectedScale],
  );

  // Merge adjacent labels
  const mergedGroups = useMemo(() => {
    const merged: typeof topGroups = [];
    for (const group of topGroups) {
      const last = merged[merged.length - 1];
      if (last && last.label === group.label) {
        last.widthPx += group.widthPx;
      } else {
        merged.push({ ...group });
      }
    }
    return merged;
  }, [topGroups]);

  // Add left offset
  const mergedGroupsWithLeft = useMemo(() => {
    let offset = 0;
    return mergedGroups.map((group) => {
      const g = { ...group, left: offset };
      offset += group.widthPx;
      return g;
    });
  }, [mergedGroups]);

  // Scroll tracking
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollLeft = el.scrollLeft;
      for (let i = mergedGroupsWithLeft.length - 1; i >= 0; i--) {
        if (scrollLeft >= mergedGroupsWithLeft[i].left) {
          setStickyIndex(i);
          break;
        }
      }
    };

    el.addEventListener('scroll', handleScroll);
    handleScroll(); // on mount
    return () => el.removeEventListener('scroll', handleScroll);
  }, [mergedGroupsWithLeft]);

  const stickyLabel = mergedGroupsWithLeft[stickyIndex]?.label ?? '';

  return (
    <div
      className="sticky top-0 z-30"
      style={{
        backgroundColor: '#F0F1F2',
      }}
    >
      <div className="flex min-w-max flex-col">
        {/* Top Header Row */}
        <div className="relative flex h-8">
          {/* Sticky floating label */}
          <div
            className="sticky left-0 z-40 flex w-24 shrink-0 items-center justify-center border-b border-solid text-sm font-bold"
            style={{
              backgroundColor: '#F0F1F2',
              borderColor: '#D6D6D8',
            }}
          >
            {stickyLabel}
          </div>

          {/* Scrollable header cells */}
          <div className="flex">
            {mergedGroupsWithLeft.map((group, idx) => (
              <div
                key={idx}
                className="border-b border-solid py-2 pr-4 text-left text-sm font-bold"
                style={{
                  width: `${group.widthPx}px`,
                  borderColor: '#D6D6D8',
                  backgroundColor: '#F0F1F2',
                }}
              >
                <p className="px-4">{idx === 0 ? '' : group.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tick row */}
        <div className="flex">
          {bottomRowCells.map((cell, idx) => {
            const tickLabel = config.formatTickLabel?.(cell.startDate) || '';
            return (
              <div
                key={idx}
                className="relative p-1 text-center text-xs"
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
