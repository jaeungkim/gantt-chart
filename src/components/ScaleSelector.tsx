import { GANTT_SCALE_CONFIG } from "constants/gantt";
import { useRef } from "react";
import { GanttScaleKey } from "types/gantt";

interface ScaleSelectorProps {
  selectedScale: GanttScaleKey;
  onScaleChange: (scale: GanttScaleKey) => void;
}

const SCALE_OPTIONS = Object.keys(GANTT_SCALE_CONFIG) as GanttScaleKey[];

/**
 * Segmented control for choosing the Gantt chart scale
 * Uses a pill-style button group instead of a dropdown
 */
export default function ScaleSelector({
  selectedScale,
  onScaleChange,
}: ScaleSelectorProps) {
  // roving tabindex - only the selected option is a tab stop, so moving the selection with
  // the arrow keys has to move focus too, or the next key press would act on the old option
  const buttonRefs = useRef<Partial<Record<GanttScaleKey, HTMLButtonElement>>>(
    {}
  );

  // The reference index comes from the currently selected option, not from the button that was pressed
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
      aria-label="Timeline scale"
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
