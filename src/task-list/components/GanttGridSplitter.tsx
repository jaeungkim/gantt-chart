import { MAX_GRID_WIDTH, MIN_GRID_WIDTH } from "shared/constants";

interface GanttGridSplitterProps {
  width: number;
  onWidthChange: (width: number) => void;
}

// Rendered outside the scroll container, not inside the grid pane: the treegrid's children
// may only be rows, and a separator there would be a second tab stop.
export default function GanttGridSplitter({
  width,
  onWidthChange,
}: GanttGridSplitterProps) {
  const clampWidth = (next: number) =>
    Math.min(MAX_GRID_WIDTH, Math.max(MIN_GRID_WIDTH, next));

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!e.isPrimary || e.button !== 0) return;

    const startX = e.clientX;
    const startWidth = width;
    e.currentTarget.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return;
      onWidthChange(clampWidth(startWidth + moveEvent.clientX - startX));
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== e.pointerId) return;
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", handlePointerUp);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    document.addEventListener("pointercancel", handlePointerUp);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onWidthChange(clampWidth(width + (e.key === "ArrowLeft" ? -16 : 16)));
  };

  return (
    <div
      className="gantt-grid-splitter"
      style={{ left: `${width - 2}px` }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize task list"
      aria-valuenow={width}
      aria-valuemin={MIN_GRID_WIDTH}
      aria-valuemax={MAX_GRID_WIDTH}
      tabIndex={0}
    />
  );
}
