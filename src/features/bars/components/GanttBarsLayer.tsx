import type { VirtualItem } from "shared/virtual/window";
import GanttBar from "features/bars/components/GanttBar";
import { GanttDependencyChange } from "features/dependencies/types";
import { GanttBarOptions, GanttGeometry, LinkAnchor } from "shared/types";
import type { WorkingCalendar } from "core/calendar";
import { GanttInteractionConfig, TaskTransformed } from "shared/task";
import { GanttRow } from "features/rows/utils/rows";
import { useShallow } from "zustand/shallow";
import { useGanttStore } from "shared/context";
import { LINK_HANDLE_REACH, MIN_RESIZABLE_WIDTH } from "shared/constants";

interface GanttBarsLayerProps {
  rows: GanttRow[];
  virtualItems: VirtualItem[];
  isBarVisible: (barLeft: number, barWidth: number) => boolean;
  options: GanttBarOptions;
  interaction: GanttInteractionConfig;
  calendar?: WorkingCalendar;
  autoScrollOnDrag: boolean;
  onDependencyCreate?: (change: GanttDependencyChange) => boolean | void;
  geometry: GanttGeometry;
}

const drawnEnd = (task: TaskTransformed) =>
  task.barLeft + Math.max(task.barWidth, MIN_RESIZABLE_WIDTH);

function crowdedAnchors(lane: TaskTransformed[], i: number): LinkAnchor[] {
  const prev = lane[i - 1];
  return prev && lane[i].barLeft - drawnEnd(prev) < LINK_HANDLE_REACH ? ["start"] : [];
}

export default function GanttBarsLayer({
  rows,
  virtualItems,
  isBarVisible,
  options,
  interaction,
  calendar,
  autoScrollOnDrag,
  onDependencyCreate,
  geometry,
}: GanttBarsLayerProps) {
  const draggedIds = useGanttStore(
    useShallow((store) => Object.keys(store.dragOffsets))
  );
  const held = useGanttStore((store) => store.barDrag?.task);

  const barWrap = (
    task: TaskTransformed,
    start: number,
    size: number,
    crowded: LinkAnchor[] = []
  ) => (
    <div
      key={task.id}
      className="gantt-bar-wrap"
      style={{
        height: `${size - 1}px`,
        transform: `translateY(${start}px)`,
      }}
    >
      <GanttBar
        currentTask={task}
        options={options}
        interaction={interaction}
        calendar={calendar}
        autoScrollOnDrag={autoScrollOnDrag}
        onDependencyCreate={onDependencyCreate}
        geometry={geometry}
        crowded={crowded}
      />
    </div>
  );

  const bars = virtualItems.flatMap((virtualRow) => {
    const row = rows[virtualRow.index];
    if (!row) return [];

    return row.tasks.map((task, i) =>
      draggedIds.includes(task.id) || isBarVisible(task.barLeft, task.barWidth)
        ? barWrap(task, virtualRow.start, virtualRow.size, crowdedAnchors(row.tasks, i))
        : null
    );
  });

  const heldIndex = held ? held.order - 1 : -1;
  const heldTask = rows[heldIndex]?.tasks.find((task) => task.id === held?.id);
  const first = virtualItems[0]?.index ?? 0;
  const last = virtualItems[virtualItems.length - 1]?.index ?? -1;
  if (!heldTask || (heldIndex >= first && heldIndex <= last)) return bars;

  const heldBar = barWrap(heldTask, heldIndex * geometry.rowHeight, geometry.rowHeight);
  return heldIndex < first ? [heldBar, ...bars] : [...bars, heldBar];
}
