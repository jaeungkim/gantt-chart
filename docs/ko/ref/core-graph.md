`TaskGraph`는 스케줄러가 순회하는 의존성(dependency) 그래프예요. 여기 있는 네 함수가 그래프를 만들고,
탐색하고, 검사하고, 이름표를 붙여요. 넷 다 패키지 루트의 런타임 export이고, React도 DOM도 건드리지
않아요. 그래서 Node에서도, 워커에서도, 테스트에서도 돌아가요.

```ts
import {
  buildTaskGraph,
  canLink,
  findPath,
  linkKey,
  type SchedulingLink,
  type TaskGraph,
} from '@jaeungkim/gantt-chart';
```

`SchedulingLink`은 양쪽 끝이 모두 해석된 의존성 하나예요. 정의는
[스케줄링 코어](core-scheduling.md)에 있어요. 이 함수들이 읽는 `Task` 모양은
[작업](task.md)에 있고요. 동작은 [의존성](../dependencies.md)과
[스케줄링](../scheduling.md)에서 다뤄요. 차트 없이 코어만 돌리는 이야기는
[헤드리스 코어](../headless-core.md)예요.

## `TaskGraph`

```ts
export interface TaskGraph {
  byId: Map<string, Task>;
  links: SchedulingLink[];
  /** 후행 작업 id -> 그 작업을 제약하는 링크들 */
  incoming: Map<string, SchedulingLink[]>;
  /** 선행 작업 id -> 그 작업이 제약하는 링크들 */
  outgoing: Map<string, SchedulingLink[]>;
  /** 위상 정렬 순서, 선행 작업이 먼저. 순환에 걸린 것은 제외해요. */
  order: string[];
  /** 순환 위에 있어서 정렬하지 못한 id (없으면 null) */
  cycle: string[] | null;
}
```

| 필드 | 타입 | 내용 | 비었거나 없을 때 |
|---|---|---|---|
| `byId` | `Map<string, Task>` | 전달된 모든 작업, `id`를 키로 | `tasks` 배열이 비면 빈 `Map` |
| `links` | `SchedulingLink[]` | 살아남은 의존성마다 한 항목. 작업 순서가 먼저고, 같은 작업 안에서는 `dependencies` 순서 | 아래 제거 규칙을 통과한 의존성이 하나도 없으면 `[]` |
| `incoming` | `Map<string, SchedulingLink[]>` | 후행 작업(successor) id → 그 작업을 제약하는 링크들 | 선행 작업(predecessor)이 없는 작업은 `.get(id)`이 `[]`가 아니라 `undefined` |
| `outgoing` | `Map<string, SchedulingLink[]>` | 선행 작업 id → 그 작업이 제약하는 링크들 | 후행 작업이 없는 작업은 `.get(id)`이 `[]`가 아니라 `undefined` |
| `order` | `string[]` | 위상 정렬 순서, 선행 작업이 먼저. 링크가 하나도 없는 작업도 들어가요 | `tasks` 배열이 비면 `[]` |
| `cycle` | `string[] \| null` | 정렬되지 못한 모든 id, 입력 순서대로 | `order.length === tasks.length`이면 `null` |

`cycle` 필드의 주석은 이 id들이 "순환 위에 있다"고 말해요. 코드는 더 넓은 이야기를 해요.
`cycle`은 진입 차수가 끝내 0이 되지 못한 모든 id예요. 여기에는 고리의 하류에 있을 뿐인 작업도
들어가요. `a`와 `b`가 서로를 가리키고 `down`이 `a`에만 의존하면 `cycle`은 `['a', 'b', 'down']`이에요.

## `buildTaskGraph`

```ts
/**
 * 의존성 그래프를 만들고 위상 정렬해요 (Kahn).
 *
 * 데이터에 없는 작업을 가리키는 링크는 버려요. 순환에 걸린 것은 `order`에서 빠지고
 * `cycle`에 담겨요 - 그래서 데이터가 어떻든 호출자는 유한하고 비순환인 목록만 순회해요.
 */
export function buildTaskGraph(tasks: Task[]): TaskGraph
```

| 매개변수 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `tasks` | `Task[]` | 예 | 평평한 작업 목록이에요. 읽기만 하고 절대 바꾸지 않아요 |

`TaskGraph`를 반환해요. 예외를 던지지도, 경고를 내지도 않아요.

`links`를 모으는 동안 두 가지 의존성이 조용히 버려져요.

| 버려지는 것 | 판정 |
|---|---|
| 자기 링크 — `dependency.targetId`가 그 작업의 `id`와 같을 때 | `targetId === task.id` |
| 끊긴 링크 — `targetId`가 `tasks`에 없는 id를 가리킬 때 | `byId.has(targetId)`가 `false` |

둘 다 가진 작업도 `byId`와 `order`에는 그대로 나와요. 다만 두 의존성 모두 `links`,
`incoming`, `outgoing`에는 닿지 않아요.

`buildTaskGraph([])`는 빈 `byId`, `incoming`, `outgoing` 맵과 `links: []`,
`order: []`, `cycle: null`을 반환해요.

## `findPath`

```ts
/**
 * `fromId`에서 `toId`까지의 의존성 경로, 없으면 null이에요.
 * 후행 작업을 따라가므로 결과는 선행 작업부터 읽혀요.
 */
export function findPath(
  tasks: Task[],
  fromId: string,
  toId: string
): string[] | null
```

| 매개변수 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `tasks` | `Task[]` | 예 | 평평한 작업 목록 |
| `fromId` | `string` | 예 | 출발점 id예요. `outgoing` 링크를 따라가요 |
| `toId` | `string` | 예 | 도착할 id |

후행 작업을 너비 우선으로 훑어요. 그래서 찾아낸 경로는 홉 수 기준 최단 경로예요.

| 경우 | 반환값 |
|---|---|
| 경로가 있을 때 | `string[]`, 선행 작업부터, 양쪽 끝점 포함 — `['a', 'b', 'c']` |
| 경로가 없을 때 | `null` |
| `fromId === toId` | `[fromId]`, 그래프를 만들기 전에 반환해서 `tasks`에 없는 id에도 그대로 적용돼요 |
| `fromId`가 `tasks`에 없을 때 | `null` |
| `toId`가 `tasks`에 없을 때 | `null` |
| `tasks`가 비었고 두 id가 다를 때 | `null` |

데이터에 순환이 있어도 탐색이 멈춰 서지 않아요. 방문 집합이 같은 id를 두 번 큐에 넣지 못하게 막아요.

## `canLink`

```ts
/**
 * 새 선행 작업 -> 후행 작업 링크를 고리 없이 추가할 수 있는지 여부예요.
 *
 * 데이터에 링크를 쓰기 전에 호출해요. 애초에 생기지 않은 순환은 엔진이 우회할 일도 없어요.
 * `cycle`은 문제가 된 연결이라, 에러 메시지에 그대로 넣을 수 있어요.
 */
export function canLink(
  tasks: Task[],
  predecessorId: string,
  successorId: string
): { ok: boolean; cycle: string[] | null }
```

| 매개변수 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `tasks` | `Task[]` | 예 | 새 링크가 들어가기 *전* 상태의 작업 목록 |
| `predecessorId` | `string` | 예 | 앞선 작업이에요. `dependencies[].targetId`에 들어갈 id |
| `successorId` | `string` | 예 | 뒤따르는 작업이에요. 새 의존성을 갖게 될 쪽 |

거절하는 경우는 정확히 두 가지예요.

| 입력 | 반환값 |
|---|---|
| `predecessorId === successorId` | `{ ok: false, cycle: [predecessorId, successorId] }` |
| 후행 작업이 이미 선행 작업에 닿을 수 있을 때 | `{ ok: false, cycle: [...pathBack, successorId] }` — `a → b → c` 연결이라면 `canLink(tasks, 'c', 'a')`는 `{ ok: false, cycle: ['a', 'b', 'c', 'a'] }`를 줘요 |
| 그 밖의 모든 경우, 이미 있는 링크와 `tasks`에 없는 id도 포함 | `{ ok: true, cycle: null }` |

거절될 때의 `cycle`은 고리를 닫는 홉까지 붙인 연결이에요. 그래서 첫 항목과 마지막 항목이
같은 id예요.

## `linkKey`

```ts
/** 링크의 안정적인 식별자 - 그려진 화살표에 태그로 붙어요 */
export function linkKey(link: SchedulingLink): string {
  return `${link.predecessorId}>${link.successorId}:${link.type}`;
}
```

| 매개변수 | 타입 | 필수 | 의미 |
|---|---|---|---|
| `link` | `SchedulingLink` | 예 | `predecessorId`, `successorId`, `type`만 읽어요 |

`` `${predecessorId}>${successorId}:${type}` `` 형식 그대로의 `string`을 반환해요. 두 id 사이에
`>`가 오고, 이어서 `:`와 두 글자짜리 링크 타입이 붙어요. `a`에서 `b`로 가는 finish-to-start
링크는 `'a>b:FS'`예요.

`computeCriticalPath`가 `criticalLinkIds`에 담는 키가 바로 이거예요.
[임계 경로 코어](core-critical-path.md)를 참고해요.

## 참고 사항

- `linkKey`는 `lag`를 무시해요. 같은 두 작업 사이에 `type`이 같고 지연(lag)만 다른 의존성 둘은
  같은 키를 만들어요.
- `canLink`는 중복 링크를 거절하지 않아요. 이 함수만 유일한 방어선으로 쓰는 호스트 앱은 같은
  `{ targetId, type }`을 `dependencies`에 두 번 쓸 수 있어요. 그러면 `buildTaskGraph`가 `linkKey`
  하나에서 충돌하는 `SchedulingLink` 두 개를 내놓아요. 차트의 링크 드래그는 중복까지 보는 두 번째
  검사를 따로 돌려요. 이건 내부용이라 패키지에서 export되지 않아요 —
  [의존성](../dependencies.md)을 참고해요.
- `findPath`는 호출할 때마다 `buildTaskGraph`를 부르고, `canLink`는 `findPath`를 불러요. 둘 다
  호출당 O(tasks + links)라서, 링크 묶음을 루프에서 검사하면 제곱이 돼요.
- 소스에서 이 함수들 옆에 있는 링크 기하 헬퍼 — `linkSourceDate`, `linkTargetDate`, `linkDelta`,
  `taskStart`, `taskEnd`, `shiftTask` — 는 패키지 루트에서 export되지 **않아요**.
  `@jaeungkim/gantt-chart`에서 import할 수 없어요.
