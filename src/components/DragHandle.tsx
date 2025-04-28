import HandleIcon from 'assets/images/icons/handle.svg?react';

interface DragHandleProps {
  side: 'left' | 'right';
  hoveredHandle: 'none' | 'left' | 'right';
  setHoveredHandle: (side: 'none' | 'left' | 'right') => void;
}

export default function DragHandle({
  side,
  hoveredHandle,
  setHoveredHandle,
}: DragHandleProps) {
  return (
    <button
      data-mode={side}
      onMouseEnter={() => setHoveredHandle(side)}
      onMouseLeave={() => setHoveredHandle('none')}
      style={{
        position: 'absolute',
        top: 0,
        [side]: -18.4,
        width: 32,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'w-resize',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <HandleIcon
        style={{
          width: 24,
          height: 24,
          fill: '#919294',
          opacity: hoveredHandle === side ? 1 : 0,
        }}
      />
    </button>
  );
}
