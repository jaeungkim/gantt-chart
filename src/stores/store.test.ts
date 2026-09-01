import { beforeEach, describe, expect, it } from 'vitest';
import dayjs from 'utils/dayjs';
// 이 import 자체가 SSR 안전성 회귀 테스트다 - 모듈 스코프에서 sessionStorage를
// 건드리면 노드 환경(jsdom 없음)에서 파일 로드가 곧바로 실패한다.
import { createGanttStore, readPersistedScale } from './store';

// 노드 환경에는 sessionStorage가 없으므로 최소 스텁을 심고 쓰기 횟수를 센다
const writes: Array<[string, string]> = [];
const stubSessionStorage = () => {
  const data = new Map<string, string>();
  writes.length = 0;
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes.push([key, value]);
        data.set(key, value);
      },
      removeItem: (key: string) => data.delete(key),
    },
  });
  return data;
};

// 인스턴스마다 새 스토어 - 테스트끼리 상태를 공유하지 않는다
let store: ReturnType<typeof createGanttStore>;

beforeEach(() => {
  store = createGanttStore();
});

describe('readPersistedScale', () => {
  it('returns null when nothing is stored', () => {
    stubSessionStorage();
    expect(readPersistedScale()).toBeNull();
  });

  it('returns the stored scale', () => {
    stubSessionStorage().set('gantt-scale', 'week');
    expect(readPersistedScale()).toBe('week');
  });

  it('ignores an unknown stored value', () => {
    stubSessionStorage().set('gantt-scale', 'fortnight');
    expect(readPersistedScale()).toBeNull();
  });

  it('returns null instead of throwing when sessionStorage is unavailable', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
    expect(readPersistedScale()).toBeNull();
  });
});

describe('setSelectedScale persistence', () => {
  it('writes the scale once and skips a redundant write', () => {
    stubSessionStorage();

    store.getState().setSelectedScale('week');
    store.getState().setSelectedScale('week');

    expect(store.getState().selectedScale).toBe('week');
    expect(writes).toEqual([['gantt-scale', 'week']]);
    expect(readPersistedScale()).toBe('week');
  });

  it('does not write on drag updates', () => {
    stubSessionStorage();

    for (let i = 0; i < 50; i++) {
      store.getState().setDragOffset('t1', {
        offsetX: i,
        offsetWidth: 0,
        offsetStartDate: dayjs('2025-01-01'),
        offsetEndDate: dayjs('2025-01-02'),
      });
    }
    store.getState().clearAllDragOffsets();
    store.getState().setRawTasks([]);

    expect(writes).toEqual([]);
  });

  it('survives an unavailable sessionStorage', () => {
    Reflect.deleteProperty(globalThis, 'sessionStorage');

    expect(() => store.getState().setSelectedScale('day')).not.toThrow();
    expect(store.getState().selectedScale).toBe('day');
  });
});

describe('setRawTasks', () => {
  it('accepts an empty array so the chart can be cleared', () => {
    store.setState({
      rawTasks: [
        {
          id: 'a',
          name: 'a',
          startDate: '2025-01-01',
          endDate: '2025-01-02',
          parentId: null,
          sequence: '1',
        },
      ],
    });

    store.getState().setRawTasks([]);

    expect(store.getState().rawTasks).toEqual([]);
  });
});

describe('per-instance isolation', () => {
  it('keeps two charts on one page from sharing state', () => {
    stubSessionStorage();

    const a = createGanttStore('gantt-scale-a');
    const b = createGanttStore('gantt-scale-b');

    a.getState().setSelectedScale('week');
    a.getState().setRawTasks([
      {
        id: 'a1',
        name: 'a1',
        startDate: '2025-01-01',
        endDate: '2025-01-02',
        parentId: null,
        sequence: '1',
      },
    ]);
    a.getState().setDragOffset('a1', {
      offsetX: 12,
      offsetWidth: 0,
      offsetStartDate: dayjs('2025-01-01'),
      offsetEndDate: dayjs('2025-01-02'),
    });

    expect(b.getState().selectedScale).toBe('month');
    expect(b.getState().rawTasks).toEqual([]);
    expect(b.getState().dragOffsets).toEqual({});

    // 스케일 저장도 인스턴스별 키로 분리된다
    b.getState().setSelectedScale('day');
    expect(readPersistedScale('gantt-scale-a')).toBe('week');
    expect(readPersistedScale('gantt-scale-b')).toBe('day');
  });
});
