import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import React, { useEffect, useMemo, useState } from 'react';
import { useGanttStore } from 'stores/store';
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

  const currentTask = useGanttStore((store) => store.currentTask);
  const dragOffset = useGanttStore((store) => {
    if (!currentTask) return '';
    const taskId = currentTask.id as keyof typeof store.dragOffsets;
    return store.dragOffsets[taskId] ?? '';
  });

  const topGroups = useMemo(
    () => createTopHeaderGroups(bottomRowCells, selectedScale),
    [bottomRowCells, selectedScale],
  );

  const mergedGroups = useMemo(() => {
    const merged: typeof topGroups = [];
    // console.log('topGroups', topGroups);
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

  const mergedGroupsWithLeft = useMemo(() => {
    let offset = 0;
    return mergedGroups.map((group) => {
      const g = { ...group, left: offset };
      offset += group.widthPx;
      return g;
    });
  }, [mergedGroups]);

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
    handleScroll();
    return () => el.removeEventListener('scroll', handleScroll);
  }, [mergedGroupsWithLeft]);

  const stickyLabel = mergedGroupsWithLeft[stickyIndex]?.label ?? '';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        backgroundColor: '#F0F1F2',
      }}
    >
      <div
        style={{
          display: 'flex',
          minWidth: 'max-content',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            height: '32px',
          }}
        >
          <div
            style={{
              position: 'sticky',
              left: 0,
              zIndex: 40,
              display: 'flex',
              width: `${bottomRowCells[0]?.widthPx ?? 0}px`,
              flexShrink: 0,
              alignItems: 'center',
              justifyContent: 'start',
              backgroundColor: '#F0F1F2',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            {stickyLabel}
          </div>

          <div
            style={{
              display: 'flex',
            }}
          >
            {/* start with 0+1 index not 0 */}
            {mergedGroupsWithLeft.map((group, idx) => {
              if (idx === 0) return;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '8px 0px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textAlign: 'left',
                    width: `${group.widthPx}px`,
                    backgroundColor: '#F0F1F2',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      padding: '0 0px',
                    }}
                  >
                    {idx === 0 ? '' : group.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid #D6D6D8',
            display: 'flex',
          }}
        >
          <div>
            {dragOffset && currentTask && (
              <div
                style={{
                  position: 'absolute',
                  left: `${dragOffset.offsetX + (currentTask?.barLeft ?? 0)}px`,
                  zIndex: 60,
                  backgroundColor: '#D6D6D8',
                  width: `${dragOffset.offsetWidth + (currentTask?.barWidth ?? 0)}px`,
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '100px',
                  opacity: 0.7,
                  fontSize: '12px',
                  overflow: 'hidden',
                  justifyContent: 'space-between',
                }}
              >
                {selectedScale === 'week' && (
                  <>
                    <p>{dragOffset.offsetStartDate.format('h A')}</p>
                    <p>{dragOffset.offsetEndDate.format('h A')}</p>
                  </>
                )}
                {selectedScale === 'year' && (
                  <>
                    <p>{dragOffset.offsetStartDate.format('D')}</p>
                    <p>{dragOffset.offsetEndDate.format('D')}</p>
                  </>
                )}
              </div>
            )}
          </div>
          {bottomRowCells.map((cell, idx) => {
            const tickLabel = config.formatTickLabel?.(cell.startDate) || '';
            const bottomRowCellKey = `bottom-row-${cell.startDate}-${idx}`;

            return (
              <div
                key={bottomRowCellKey}
                style={{
                  position: 'relative',
                  lineHeight: 'normal',
                  padding: '4px 0',
                  // textAlign: 'center',
                  fontSize: '12px',
                  width: `${cell.widthPx}px`,
                }}
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
