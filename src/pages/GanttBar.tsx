import HandleIcon from 'assets/images/icons/handle.svg?react';

interface GanttBarProps {
  barLeftMargin: number;
  barWidth: number;
}

function GanttBar({ barLeftMargin, barWidth }: GanttBarProps) {
  // Render left handle
  const renderLeftHandle = () => (
    <button
      className="absolute top-0 flex h-full cursor-w-resize items-center justify-center opacity-0 hover:opacity-100"
      style={{ left: '-1.15rem', width: '2rem', height: '100%' }}
    >
      <HandleIcon className="fill-base-500 size-6" />
    </button>
  );

  // Render right handle
  const renderRightHandle = () => (
    <button
      className="absolute top-0 flex h-full cursor-w-resize items-center justify-center opacity-0 hover:opacity-100"
      style={{ right: '-1.15rem', width: '2rem', height: '100%' }}
    >
      <HandleIcon className="fill-base-500 size-6" />
    </button>
  );

  return (
    <div
      className="bg-base-400 relative flex items-center"
      style={{
        marginLeft: `${barLeftMargin}rem`,
        width: `${barWidth}rem`,
        height: `1rem`,
      }}
    >
      {renderLeftHandle()}
      {/* The main bar content can go here */}
      <div className="flex-1" />
      {renderRightHandle()}
    </div>
  );
}

export default GanttBar;
