import HandleIcon from "assets/images/icons/handle.svg?react";

interface DragHandleProps {
  side: "left" | "right";
  hoveredHandle: "none" | "left" | "right";
  setHoveredHandle: (side: "none" | "left" | "right") => void;
}

export default function DragHandle({
  side,
  hoveredHandle,
  setHoveredHandle,
}: DragHandleProps) {
  return (
    <button
      data-mode={side}
      className={`gantt-drag-handle gantt-drag-handle-${side}`}
      onMouseEnter={() => setHoveredHandle(side)}
      onMouseLeave={() => setHoveredHandle("none")}
    >
      <HandleIcon
        className={`gantt-drag-handle-icon ${
          hoveredHandle === side
            ? "gantt-drag-handle-icon-visible"
            : "gantt-drag-handle-icon-hidden"
        }`}
      />
    </button>
  );
}
