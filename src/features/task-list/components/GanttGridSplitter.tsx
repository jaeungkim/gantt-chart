import { MAX_GRID_WIDTH, MIN_GRID_WIDTH } from "shared/constants";

// Timeline kept visible beside the pane, so the handle never leaves .gantt-main, which clips
const MIN_TIMELINE_PX = 40;

interface GanttGridSplitterProps {
  width: number;
  onWidthChange: (width: number) => void;
}

export default function GanttGridSplitter({
  width,
  onWidthChange,
}: GanttGridSplitterProps) {
  const clampWidth = (next: number, availablePx = Infinity) =>
    Math.min(
      MAX_GRID_WIDTH,
      availablePx - MIN_TIMELINE_PX,
      Math.max(MIN_GRID_WIDTH, next)
    );

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!e.isPrimary || e.button !== 0) return;

    const startX = e.clientX;
    const availablePx = e.currentTarget.parentElement?.clientWidth;
    const startWidth = clampWidth(width, availablePx);
    e.currentTarget.setPointerCapture(e.pointerId);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== e.pointerId) return;
      onWidthChange(
        clampWidth(startWidth + moveEvent.clientX - startX, availablePx)
      );
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
    const main = splitter.parentElement;
    if (!main) return;
    const texts = main.querySelectorAll<HTMLElement>(".gantt-grid-cell-text");
    if (!texts.length) return;
    // Rects live in visual space, the width style in layout px - an ancestor scale divides
    // the two, so everything measured converts back through this
    const grid = main.querySelector<HTMLElement>(".gantt-grid");
    if (!grid) return;
    const scale = grid.getBoundingClientRect().width / grid.offsetWidth || 1;
    const range = document.createRange();
    let fit = 0;
    texts.forEach((text) => {
      const row = text.closest(".gantt-grid-row");
      if (!row) return;
      // The ellipsis clips the box, not the layout, so a range over the contents still
      // measures the full text - fractionally, where offsetWidth/scrollWidth round to whole px
      range.selectNodeContents(text);
      const textWidth = range.getBoundingClientRect().width;
      const prefix =
        text.getBoundingClientRect().left - row.getBoundingClientRect().left;
      let needed = prefix + textWidth;
      for (
        let sibling = text.nextElementSibling;
        sibling;
        sibling = sibling.nextElementSibling
      )
        needed += sibling.getBoundingClientRect().width;
      fit = Math.max(fit, needed);
    });
    // 10 is the cell's right padding, added after the scale conversion because it is a
    // layout value, not a measured rect
    onWidthChange(clampWidth(Math.ceil(fit / scale + 10) + 1, main.clientWidth));
  };

  return (
    <div
      className="gantt-grid-splitter"
      // a chart that narrowed under a wide pane still draws the handle where it can be grabbed
      style={{ left: `min(${width - 2}px, 100% - ${MIN_TIMELINE_PX + 2}px)` }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => fitToContent(e.currentTarget)}
    />
  );
}
