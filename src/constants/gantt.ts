import { GanttScaleConfig, GanttScaleKey } from 'types/gantt';

export const NODE_HEIGHT = 38;
export const TIMELINE_SHIFT_BUFFER = 5;
/** 바가 좁아도 최소한 이 너비로 렌더링 (px) - 짧은 태스크도 잡을 수 있게 */
export const MIN_BAR_WIDTH = 14;
/** 이 너비 미만이면 태스크명을 바 바깥에 표시 (px) */
export const MIN_LABEL_INSIDE_WIDTH = 56;
/** 리사이즈 엣지 감지 영역 (px) */
export const EDGE_THRESHOLD = 8;
/** 바 너비가 이 값 미만이면 엣지 리사이즈 없이 전체를 이동 핸들로 사용 (px) */
export const MIN_RESIZABLE_WIDTH = EDGE_THRESHOLD * 3;
/** 마일스톤 다이아몬드 한 변 길이 (px, 45도 회전 전) */
export const MILESTONE_SIZE = 16;
/** 다이아몬드 중심에서 꼭짓점까지의 가로 거리 (px) */
export const MILESTONE_HALF_DIAGONAL = Math.round((MILESTONE_SIZE * Math.SQRT2) / 2);

/** 스케일별 날짜 표시 포맷 (툴팁, 드래그 가이드 공용) */
export const DATE_FORMATS: Record<GanttScaleKey, string> = {
  day: 'MMM D, h A',
  week: 'MMM D',
  month: 'MMM D',
  year: 'MMM YYYY',
};

export const GANTT_SCALE_CONFIG: Record<GanttScaleKey, GanttScaleConfig> = {
  day: {
    labelUnit: 'day',
    tickUnit: 'hour',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 1,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('hh'),
    formatHeaderLabel: (d) => d.format('MMM D'),
  },
  week: {
    labelUnit: 'month', 
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'hour',
    dragStepAmount: 6,
    basePxPerDragStep: 54,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM'),
  },
  month: {
    labelUnit: 'month',
    tickUnit: 'day',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 1,
    basePxPerDragStep: 32,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
  year: {
    labelUnit: 'month',
    tickUnit: 'month',
    unitPerTick: 1,
    dragStepUnit: 'day',
    dragStepAmount: 7,
    basePxPerDragStep: 28,
    formatTickLabel: (d) => d.format('D'),
    formatHeaderLabel: (d) => d.format('MMM YYYY'),
  },
};
