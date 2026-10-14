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

  // Widest visible row's natural width: prefix (grip, number, indent, expander) plus the full
  // text and anything after it (lane count), plus the cell's right padding. Virtualized rows
  // off screen are not in the DOM, so "fit" fits what the viewer can see.
  const fitToContent = (splitter: HTMLElement) => {
    const texts = splitter.parentElement?.querySelectorAll<HTMLElement>(
      ".gantt-grid-cell-text",
    );
    if (!texts?.length) return;
    // Rects live in visual space, the width style in layout px - a browser zoom or an
    // ancestor scale divides the two, so everything measured converts back through this
    const grid = splitter.parentElement?.querySelector<HTMLElement>(".gantt-grid");
    if (!grid) return;
    const scale = grid.getBoundingClientRect().width / grid.offsetWidth || 1;
    const range = document.createRange();
    let fit = 0;
    texts.forEach((text) => {
      const row = text.closest(".gantt-grid-row");
      if (!row) return;
      // The ellipsis clips the box, not the layout, so a range over the contents still
      // measures the full text - fractionally, where offsetWidth/scrollWidth round down
      range.selectNodeContents(text);
      const textWidth = range.getBoundingClientRect().width;
      const prefix =
        text.getBoundingClientRect().left - row.getBoundingClientRect().left;
      let needed = prefix + textWidth;
      for (
        let sibling = text.nextElementSibling as HTMLElement | null;
        sibling;
        sibling = sibling.nextElementSibling as HTMLElement | null
      )
        needed += sibling.getBoundingClientRect().width;
      fit = Math.max(fit, needed);
    });
    // 10 is the cell's right padding, added after the scale conversion because it is a
    // layout value, not a measured rect
    onWidthChange(clampWidth(Math.ceil(fit / scale + 10) + 1));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fitToContent(e.currentTarget);
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onWidthChange(clampWidth(width + (e.key === "ArrowLeft" ? -16 : 16)));
  };

  return (
    <div
      className="gantt-grid-splitter"
      style={{ left: `${width - 2}px` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => fitToContent(e.currentTarget)}
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
