import localDayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { GANTT_SCALE_CONFIG } from 'constants/gantt';
import type { Task } from 'types/task';
import dayjs from 'utils/dayjs';
import { computeTimelineData, shiftByDragSteps } from './timeline';

/**
 * 테스트 동안만 뷰어의 로컬 타임존을 바꾼다.
 * (Node는 process.env.TZ 대입 즉시 Date 계산에 반영한다)
 */
function withTimeZone<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

const task = (startDate: string, endDate: string): Task => ({
  id: 'a',
  name: 'a',
  startDate,
  endDate,
  parentId: null,
  sequence: '1',
});

const widths = (t: Task, scale: 'day' | 'week' | 'month' | 'year') =>
  computeTimelineData([t], scale).bottomCells.map((c) => c.widthPx);

// America/New_York: 2025-03-09 는 23시간(봄 DST), 2025-11-02 는 25시간(가을 DST)
const SPRING_FORWARD = task('2025-03-08T00:00:00Z', '2025-03-10T00:00:00Z');
const FALL_BACK = task('2025-11-01T00:00:00Z', '2025-11-03T00:00:00Z');

describe('DST 경계에서의 타임라인 셀 (#28)', () => {
  it('봄 DST가 낀 주에도 하루 셀 너비가 균일하다', () => {
    // 예전: 23시간짜리 하루가 diff('day') 정수 절삭으로 0일이 되어 3/9 셀이 0px로 사라졌다
    withTimeZone('America/New_York', () => {
      expect(new Set(widths(SPRING_FORWARD, 'month'))).toEqual(new Set([32]));
      expect(new Set(widths(SPRING_FORWARD, 'week'))).toEqual(new Set([216]));
    });
  });

  it('가을 DST가 낀 주에도 하루 셀 너비가 균일하다', () => {
    // 예전: 25시간짜리 하루가 week 스케일에서 225px(다른 날은 216px)로 튀었다
    withTimeZone('America/New_York', () => {
      expect(new Set(widths(FALL_BACK, 'month'))).toEqual(new Set([32]));
      expect(new Set(widths(FALL_BACK, 'week'))).toEqual(new Set([216]));
    });
  });

  it('year 스케일 월 셀 너비가 실제 달력 월 길이를 따른다', () => {
    // year: dragStepUnit 'day' 7일, basePxPerDragStep 28 -> 하루 4px
    // 예전: DST가 낀 3월이 30.96일로 잘려 124px 대신 120px이 되었다
    withTimeZone('America/New_York', () => {
      const cells = computeTimelineData(
        [task('2025-02-01T00:00:00Z', '2025-07-01T00:00:00Z')],
        'year',
      ).bottomCells;
      const byMonth = new Map(
        cells.map((c) => [c.startDate.format('YYYY-MM'), c.widthPx]),
      );
      expect(byMonth.get('2025-02')).toBe(28 * 4);
      expect(byMonth.get('2025-03')).toBe(31 * 4); // DST 있음
      expect(byMonth.get('2025-04')).toBe(30 * 4);
      expect(byMonth.get('2025-11')).toBe(30 * 4); // DST 있음
    });
  });
});

describe('shiftByDragSteps (#28)', () => {
  it('달력 단위로 더해 봄 DST를 가로질러도 시각이 유지된다', () => {
    // 로컬 모드 인스턴스로도 검증 - 분으로 환산해 더하던 예전 방식은
    // 3/8 23:30 EST + 1440분 = 3/10 00:30 EDT 로 하루가 아니라 이틀 뒤 칸에 떨어졌다
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-03-08T23:30');
      expect(shiftByDragSteps(start, 1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-09 23:30',
      );
      expect(shiftByDragSteps(start, 2, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-10 23:30',
      );
      expect(shiftByDragSteps(start, -1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-07 23:30',
      );
    });
  });

  it('달력 단위로 더해 가을 DST를 가로질러도 시각이 유지된다', () => {
    // 예전: 11/1 23:30 EDT + 1440분 = 11/2 22:30 EST (하루가 25시간이라 한 시간 모자람)
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-11-01T23:30');
      expect(shiftByDragSteps(start, 1, 'month').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-11-02 23:30',
      );
    });
  });

  it('year 스케일 7일 스텝도 DST를 가로질러 정확히 7일씩 움직인다', () => {
    withTimeZone('America/New_York', () => {
      const start = localDayjs('2025-03-05T09:00');
      expect(shiftByDragSteps(start, 1, 'year').format('YYYY-MM-DD HH:mm')).toBe(
        '2025-03-12 09:00',
      );
    });
  });

  it('스케일별 드래그 스텝이 config 그대로다', () => {
    const base = dayjs('2025-01-01T00:00:00Z');
    expect(shiftByDragSteps(base, 3, 'day').toISOString()).toBe('2025-01-01T03:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'week').toISOString()).toBe('2025-01-01T18:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'month').toISOString()).toBe('2025-01-04T00:00:00.000Z');
    expect(shiftByDragSteps(base, 3, 'year').toISOString()).toBe('2025-01-22T00:00:00.000Z');
    // month 스케일 스텝을 30일 고정으로 환산하면 실제 달 길이와 어긋난다
    expect(shiftByDragSteps(dayjs('2025-01-31T00:00:00Z'), 30, 'month').toISOString()).toBe(
      '2025-03-02T00:00:00.000Z',
    );
  });
});

describe('UTC 기준 배치 (#84)', () => {
  const boundary = task('2025-03-10T23:00:00Z', '2025-03-11T05:00:00Z');

  it('뷰어 타임존이 달라도 같은 데이터가 같은 위치에 그려진다', () => {
    const seoul = withTimeZone('Asia/Seoul', () => computeTimelineData([boundary], 'month'));
    const london = withTimeZone('Europe/London', () =>
      computeTimelineData([boundary], 'month'),
    );

    expect(seoul.transformedTasks[0].barLeft).toBe(london.transformedTasks[0].barLeft);
    expect(seoul.transformedTasks[0].barWidth).toBe(london.transformedTasks[0].barWidth);
    expect(seoul.bottomCells.map((c) => c.startDate.toISOString())).toEqual(
      london.bottomCells.map((c) => c.startDate.toISOString()),
    );
  });

  it('UTC 날짜 경계 태스크가 UTC 달력 칸에 붙는다', () => {
    // 3/10 23:00Z 시작 -> "Mar 10" 칸의 23/24 지점
    const { bottomCells, transformedTasks } = withTimeZone('Asia/Seoul', () =>
      computeTimelineData([boundary], 'month'),
    );
    const index = bottomCells.findIndex(
      (c) => c.startDate.format('YYYY-MM-DD') === '2025-03-10',
    );

    expect(index).toBeGreaterThanOrEqual(0);
    expect(transformedTasks[0].barLeft).toBeCloseTo(index * 32 + (32 * 23) / 24, 5);
    expect(transformedTasks[0].barWidth).toBeCloseTo((32 * 6) / 24, 5);
  });

  it('셀 라벨과 헤더가 UTC 달력 날짜를 쓴다', () => {
    const { bottomCells } = withTimeZone('Asia/Seoul', () =>
      computeTimelineData([task('2025-06-01T00:00:00Z', '2025-06-02T00:00:00Z')], 'month'),
    );
    const labels = bottomCells.map((c) => GANTT_SCALE_CONFIG.month.formatTickLabel?.(c.startDate));

    // 첫 셀은 6/1에서 5틱 앞선 5/27
    expect(bottomCells[0].startDate.toISOString()).toBe('2025-05-27T00:00:00.000Z');
    expect(labels.slice(0, 6)).toEqual(['27', '28', '29', '30', '31', '1']);
  });

  it('존 없는 문자열은 UTC 벽시계로 읽어 적은 그대로 표시한다', () => {
    withTimeZone('Asia/Seoul', () => {
      expect(dayjs('2025-06-01T09:00').format('YYYY-MM-DD HH:mm')).toBe('2025-06-01 09:00');
      expect(dayjs('2025-06-01').toISOString()).toBe('2025-06-01T00:00:00.000Z');
    });
  });
});
