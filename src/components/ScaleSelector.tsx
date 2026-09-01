import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useRef } from "react";
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
  // roving tabindex - 탭 대상은 선택된 옵션 하나뿐이므로 방향키로 선택을 옮길 때
  // 포커스도 함께 옮겨야 다음 키 입력이 새 옵션 기준으로 동작한다
  const buttonRefs = useRef<Partial<Record<GanttScaleKey, HTMLButtonElement>>>(
    {}
  );

  // 기준 인덱스는 눌린 버튼이 아니라 현재 선택된 옵션에서 가져온다
  const moveSelection = (step: number) => {
    const currentIndex = SCALE_OPTIONS.indexOf(selectedScale);
    const nextIndex =
      (currentIndex + step + SCALE_OPTIONS.length) % SCALE_OPTIONS.length;
    const nextScale = SCALE_OPTIONS[nextIndex];

    onScaleChange(nextScale);
    buttonRefs.current[nextScale]?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
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
              ref={(el) => {
                if (el) buttonRefs.current[scale] = el;
                else delete buttonRefs.current[scale];
              }}
              type="button"
              className="gantt-scale-button"
              data-active={isActive}
              onClick={() => onScaleChange(scale)}
              onKeyDown={handleKeyDown}
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
