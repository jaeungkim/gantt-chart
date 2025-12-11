import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { GanttScaleKey } from "types/gantt";

interface ScaleSelectorProps {
  selectedScale: GanttScaleKey;
  onScaleChange: (scale: GanttScaleKey) => void;
}

const SCALE_OPTIONS = Object.keys(GANTT_SCALE_CONFIG) as GanttScaleKey[];

/**
 * Gantt 차트 스케일 선택 세그먼트 컨트롤 컴포넌트
 * 드롭다운 대신 pill-style 버튼 그룹 사용
 */
export default function ScaleSelector({
  selectedScale,
  onScaleChange,
}: ScaleSelectorProps) {
  const handleKeyDown = (e: React.KeyboardEvent, scale: GanttScaleKey) => {
    const currentIndex = SCALE_OPTIONS.indexOf(scale);

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % SCALE_OPTIONS.length;
      onScaleChange(SCALE_OPTIONS[nextIndex]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex =
        (currentIndex - 1 + SCALE_OPTIONS.length) % SCALE_OPTIONS.length;
      onScaleChange(SCALE_OPTIONS[prevIndex]);
    }
  };

  return (
    <div
      className="gantt-scale-selector"
      role="group"
      aria-label="타임라인 스케일 선택"
    >
      <div className="gantt-scale-control">
        {SCALE_OPTIONS.map((scale) => {
          const isActive = scale === selectedScale;
          return (
            <button
              key={scale}
              type="button"
              className="gantt-scale-button"
              data-active={isActive}
              onClick={() => onScaleChange(scale)}
              onKeyDown={(e) => handleKeyDown(e, scale)}
              aria-pressed={isActive}
              tabIndex={isActive ? 0 : -1}
            >
              {scale}
            </button>
          );
        })}
      </div>
    </div>
  );
}
