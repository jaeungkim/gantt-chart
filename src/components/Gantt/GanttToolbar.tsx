import ScaleSelector from "components/ScaleSelector";
import { GanttScaleKey } from "types/gantt";

interface GanttToolbarProps {
  /** Whether the chart has a task list to collapse - without one there is no button */
  taskListEnabled: boolean;
  taskListCollapsed: boolean;
  onToggleTaskList: () => void;
  selectedScale: GanttScaleKey;
  onScaleChange: (scale: GanttScaleKey) => void;
}

/** The bar above the chart: the task list toggle and the scale selector */
export default function GanttToolbar({
  taskListEnabled,
  taskListCollapsed,
  onToggleTaskList,
  selectedScale,
  onScaleChange,
}: GanttToolbarProps) {
  return (
    <div className="gantt-toolbar">
      {taskListEnabled && (
        <button
          type="button"
          className="gantt-grid-toggle"
          onClick={onToggleTaskList}
          aria-expanded={!taskListCollapsed}
          aria-label={
            taskListCollapsed ? "Expand task list" : "Collapse task list"
          }
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
            <path d="M6 2.5 L6 13.5" />
          </svg>
        </button>
      )}
      <ScaleSelector
        selectedScale={selectedScale}
        onScaleChange={onScaleChange}
      />
    </div>
  );
}
