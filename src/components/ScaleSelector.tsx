import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import { GanttScaleKey } from 'types/gantt';

interface ScaleSelectorProps {
  selectedScale: GanttScaleKey;
  onScaleChange: (scale: GanttScaleKey) => void;
}

/**
 * Gantt 차트 스케일 선택 드롭다운 컴포넌트
 */
export default function ScaleSelector({
  selectedScale,
  onScaleChange,
}: ScaleSelectorProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onScaleChange(e.target.value as GanttScaleKey);
  };

  return (
    <div className="gantt-scale-selector">
      <select
        className="gantt-scale-select"
        value={selectedScale}
        onChange={handleChange}
        aria-label="타임라인 스케일 선택"
      >
        {Object.keys(GANTT_SCALE_CONFIG).map((scale) => (
          <option key={scale} value={scale}>
            {scale}
          </option>
        ))}
      </select>
    </div>
  );
}

