`scheduleTasks`는 작업 배열을 받아 새 배열을 돌려줘요. 모든 후행 작업(successor)이 의존성
링크에 맞게 옮겨진 배열이에요. 차트가 드롭 시점에 실행하는 바로 그 함수예요. 패키지 루트에서
내보내고, React도 DOM도 끼어들지 않아요. 끌어다 놓은 막대에 정책별로 무슨 일이 일어나는지는
[스케줄링](../scheduling.md)에 있어요.

```ts
import {
  scheduleTasks,
  type ScheduleOptions,
  type ScheduleResult,
  type SchedulingLink,
  type SchedulingPolicy,
} from '@jaeungkim/gantt-chart';
```

## `scheduleTasks`

```ts
// src/core/scheduling.ts
/**
 * 이동을 의존성 그래프 전체로 전파해요.
 *
 * 위상 정렬 순서로 앞을 향해 한 번만 훑어요. 각 작업은 자기 선행 작업(predecessor)들이
 * 요구하는 델타 중 가장 큰 값만큼 밀리고, 그다음 자기 후행 작업의 입력이 돼요. 순환은
 * 따라가지 않고 보고한 뒤 건너뛰기 때문에, 이 과정은 항상 끝나요.
 */
export function scheduleTasks(
  tasks: Task[],
  options: ScheduleOptions = {}
): ScheduleResult
```

| 매개변수 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `tasks` | [`Task[]`](task.md) | 예 | 프로젝트 전체이고, 순서는 상관없어요. 읽기 전용이라 배열도 그 원소도 절대 변형하지 않아요 |
| `options` | `ScheduleOptions` | 아니요 | 기본값은 `{}`예요. 즉 `policy: 'off'`이라 아무 일도 하지 않아요 |

## `SchedulingPolicy`

```ts
// src/core/scheduling.ts
/**
 * 선행 작업의 이동이 후행 작업까지 얼마나 이어지는지 정해요.
 *
 * - `off` - 아무것도 전파되지 않아요(기본값이며, 차트는 예전과 똑같이 동작해요)
 * - `shift-on-overlap` - 그대로 두면 링크가 깨질 때만 후행 작업을 뒤로 밀고, 앞으로는
 *   절대 당기지 않아요
 * - `maintain-gap` - 후행 작업이 가능한 가장 이른 날짜에 정확히 놓여요. 그래서 선행 작업을
 *   양방향으로 따라가고, 간격은 링크의 지연(lag)과 같게 유지돼요
 */
export type SchedulingPolicy = 'off' | 'shift-on-overlap' | 'maintain-gap';
```

`schedulingPolicy` prop도 같은 세 값을 받아요. 값마다 이동 전후 날짜를 짚어 본 예시는
[스케줄링](../scheduling.md)에 있어요.

## `ScheduleOptions`

```ts
// src/core/scheduling.ts
export interface ScheduleOptions {
  policy?: SchedulingPolicy;
  calendar?: WorkingCalendar;
  /**
   * 방금 이동한 작업들이에요. 이들의 후행 작업만 다시 계산하고, 시드 자신은
   * 호출자가 놓아둔 자리에 그대로 둬요.
   * 생략하면 프로젝트 전체를 다시 맞춰요.
   */
  seeds?: Iterable<string>;
  /** 요약 행을 고정해요 - hierarchy를 켜면 요약 행의 날짜는 자식에서 나와요 */
  hierarchy?: boolean;
  /** 의존성 순환에 걸린 id들과 함께 호출돼요. 그 작업들은 건드리지 않아요 */
  onCycle?: (taskIds: string[]) => void;
}
```

| 옵션 | 타입 | 기본값 | 의미 |
|---|---|---|---|
| `policy` | `SchedulingPolicy` | `'off'` | `'off'`이면 그래프를 만들기도 전에 함수가 곧바로 반환해요 |
| `calendar` | [`WorkingCalendar`](core-calendar.md) | `CALENDAR_DAYS` | 모든 이동과 지연(lag), 기간을 세는 날짜 단위예요. `CALENDAR_DAYS`는 주 7일을 모두 셈에 넣어요 |
| `seeds` | `Iterable<string>` | `undefined` | 작업 id예요. 순회는 그 아래로 이어지는 작업들로만 좁혀지고, 시드 자신은 고정돼요. 생략하면 모든 작업을 다시 맞춰요 |
| `hierarchy` | `boolean` | `false` | `true`면 어떤 작업의 `parentId`로 등장하는 id를 전부 고정해요 |
| `onCycle` | `(taskIds: string[]) => void` | `undefined` | 그래프에 순환이 있을 때만 호출돼요. 실행당 한 번, 작업이 하나라도 움직이기 전에, `ScheduleResult.cycle`과 같은 배열로 호출해요 |

## `ScheduleResult`

```ts
// src/core/scheduling.ts
export interface ScheduleResult {
  /** 아무것도 움직이지 않으면 같은 배열 인스턴스라, 호출자가 갱신을 건너뛸 수 있어요 */
  tasks: Task[];
  movedIds: string[];
  cycle: string[] | null;
}
```

| 필드 | 타입 | 값 |
|---|---|---|
| `tasks` | `Task[]` | 작업이 하나라도 움직이면 새 배열이고, 하나도 안 움직이면 `tasks` 인자 그 자체예요. 움직이지 않은 작업 객체는 새 배열 안에서도 동일성을 유지해요 |
| `movedIds` | `string[]` | 이번 실행이 고쳐 쓴 작업의 id이고, 도달한 순서대로 담겨요. 아무것도 움직이지 않으면 `[]`예요 |
| `cycle` | `string[] \| null` | 위상 정렬을 할 수 없었던 id 전부예요. 그래프에 순환이 없으면 `null`이에요. `policy: 'off'`일 때와 `tasks`가 빈 배열일 때는 항상 `null`인데, 둘 다 그래프를 만들기 전에 반환하기 때문이에요 |

## `SchedulingLink`

양 끝이 해석된 의존성 간선 하나예요. `buildTaskGraph`가 각 작업의 `dependencies` 배열에서
이걸 만들어요. `scheduleTasks`는 내부에서 이걸 쓰고, 호스트 앱 코드에는
[`TaskGraph`](core-graph.md)와 `linkKey`를 거쳐 전달돼요.

```ts
// src/core/scheduling.ts
/** 양 끝이 해석된 의존성 하나 */
export interface SchedulingLink {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  /** 부호가 있고, 캘린더의 날짜 단위를 따라요 */
  lag: number;
}
```

| 필드 | 타입 | 값 |
|---|---|---|
| `predecessorId` | `string` | 이 링크가 나온 [`TaskDependency`](task.md)의 `targetId`예요 |
| `successorId` | `string` | 그 의존성을 들고 있는 작업의 id예요 |
| `type` | [`DependencyType`](task.md) | `'FS'`, `'SS'`, `'FF'`, `'SF'` 중 하나예요. 각각이 무엇을 기준으로 잡는지는 [의존성](../dependencies.md)에 있어요 |
| `lag` | `number` | 부호가 있는 일수예요. 원본 `TaskDependency`가 `lag`을 생략했으면 `0`이에요. `calendar`의 날짜 단위로 세기 때문에, 근무일 캘린더에서 `2`는 근무일 이틀을 뜻해요 |

## 예제

```ts
// schedule.ts - node 환경, React 렌더링 없음
import { scheduleTasks, type Task } from '@jaeungkim/gantt-chart';

const tasks: Task[] = [
  {
    id: 'a',
    name: 'Design',
    startDate: '2026-06-02',
    endDate: '2026-06-05',
    parentId: null,
    sequence: '1',
  },
  {
    id: 'b',
    name: 'Build',
    startDate: '2026-06-03',
    endDate: '2026-06-05',
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: 'a', type: 'FS', lag: 0 }],
  },
];

const result = scheduleTasks(tasks, { policy: 'maintain-gap' });

console.log(result.movedIds); // [ 'b' ]
console.log(result.tasks[1].startDate); // 2026-06-05T00:00:00.000Z
console.log(result.tasks[1].endDate); // 2026-06-07T00:00:00.000Z
console.log(result.cycle); // null
```

## 제약

`policy: 'off'`은 그래프를 만들지 않고 `{ tasks, movedIds: [], cycle: null }`을 돌려줘요.
데이터에 실제로 순환이 있어도 `cycle`은 `null`이고 `onCycle`은 호출되지 않아요. `tasks`가 빈
배열일 때도 똑같이 일찍 반환해요.

`cycle`에는 Kahn 알고리즘이 정렬하지 못한 id가 전부 담겨요. 이건 순환 고리 자체보다 넓어요.
순환에 속한 작업 하나에만 의존하는 작업도 `cycle`에 나타나요. 위상 정렬 순서에서 끝내 도달할
수 없었기 때문이에요. `TaskGraph.cycle`의 JSDoc은 "순환 위에 있다"라고 적지만, 코드가 보고하는
건 "정렬할 수 없었다"예요.

`manuallyScheduled: true`인 작업은 절대 움직이지 않아요. 그대로 남은 날짜는 여전히 그 작업의
후행 작업을 제약해요.

시드는 순회가 시작되기 전에 고정돼요. 그래서 시드로 지정한 작업은 호출자가 써 넣은 날짜를
그대로 지켜요. 그 날짜가 자기 선행 작업 링크를 깨뜨려도 마찬가지예요.

모든 이동은 `startDate`와 `endDate`를 같은 일수만큼 옮겨요. 작업의 길이와 시각은 전파 뒤에도
살아남아요. 늘어나거나 줄어들거나 모양이 바뀌는 일은 없어요.

이 페이지에 이름이 나온 함수는 모두 패키지 루트에서 내보내요. 알고리즘이 내부에서 쓰는 헬퍼인
`linkDelta`, `shiftTask`, `taskStart`, `taskEnd`는 `@jaeungkim/gantt-chart`에서 내보내지
**않아서** 가져올 수 없어요. 패키지는 `./core` 하위 경로를 선언하지 않고, `exports`는 `.`과
`./style.css`뿐이에요. 그래서 Node에서 `scheduleTasks`를 가져오면 번들 전체가 해석되는데, 그
번들은 `react`와 `react-dom`을 peer dependency로 두고 있어요.
[헤드리스 코어](../headless-core.md)를 참고하세요.

여유(slack)와 이른 날짜, 늦은 날짜는 별도의 패스에서 나와요.
[`computeCriticalPath`](core-critical-path.md)를 참고하세요. `scheduleTasks`는 그중 어느 것도
보고하지 않아요.
