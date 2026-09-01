import { DATE_FORMATS } from "constants/gantt";
import { useGanttStore } from "stores/store";
import { isMilestoneTask } from "types/task";

interface GanttDragGuidesProps {
  width: number;
}

/**
 * 드래그 중 시작/종료 지점을 헤더까지 관통하는 세로 가이드로 표시
 * 각 가이드 상단에 현재 날짜 라벨을 붙여 헤더에서 시점을 바로 읽을 수 있게 한다
 */
export default function GanttDragGuides({ width }: GanttDragGuidesProps) {
  const currentTask = useGanttStore((store) => store.currentTask);
  const dragOffsets = useGanttStore((store) => store.dragOffsets);
  const selectedScale = useGanttStore((store) => store.selectedScale);

  const offset = currentTask ? dragOffsets[currentTask.id] : undefined;
  if (!currentTask || !offset) return null;

  const format = DATE_FORMATS[selectedScale];
  const startX = currentTask.barLeft + offset.offsetX;
  const endX = startX + currentTask.barWidth + offset.offsetWidth;

  const guides = isMilestoneTask(currentTask)
    ? [{ x: startX, label: offset.offsetStartDate.format(format) }]
    : [
        { x: startX, label: offset.offsetStartDate.format(format) },
        { x: endX, label: offset.offsetEndDate.format(format) },
      ];

  return (
    <div
      className="gantt-drag-guides"
      style={{ width: `${width}px` }}
      aria-hidden="true"
    >
      {guides.map((guide, idx) => (
        <div
          key={`guide-${idx}`}
          className="gantt-drag-guide"
          style={{ left: `${guide.x}px` }}
        >
          <span className="gantt-drag-guide-label">{guide.label}</span>
        </div>
      ))}
    </div>
  );
}
