import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// 플러그인은 실제로 쓰는 것만 등록한다.
// (이전에는 12개를 등록했지만 호출부가 하나도 없어 번들만 키웠다)
dayjs.extend(utc);

/**
 * 차트 전용 dayjs - 항상 UTC 모드로 파싱하고 표시한다.
 *
 * 태스크 날짜의 계약이 "UTC ISO 문자열"이므로(README > Task Format) 배치와 라벨도
 * UTC에 맞춘다. 로컬 모드로 파싱하면 같은 데이터가 뷰어의 위치에 따라 다른 날짜
 * 칸에 그려지고(#84), 로컬 달력의 DST 날(23/25시간) 때문에 셀 너비도 흔들린다(#28).
 *
 * - 존이 붙은 문자열('...Z', '+09:00')은 그 순간을 UTC 시각으로 표시한다
 * - 존이 없는 문자열('2025-06-01', '2025-06-01T09:00')은 UTC 벽시계로 읽으므로
 *   뷰어 타임존과 무관하게 적은 그대로 표시된다
 */
const ganttDayjs = dayjs.utc;

export default ganttDayjs;
