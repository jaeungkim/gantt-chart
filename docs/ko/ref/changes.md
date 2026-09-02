차트가 무언가를 쓰기 전에 콜백으로 건네는 페이로드예요. 차트가 스스로는 만들지 않는 작업의 초안도 함께 넘겨요. 여섯 개 모두 패키지 루트에서 타입으로 export돼요.

```ts
import type {
  GanttBeforeChangeHandler,
  GanttChangeType,
  GanttDependencyChange,
  GanttReorderChange,
  GanttTaskChange,
  GanttTaskDraft,
} from '@jaeungkim/gantt-chart';
```

어떤 콜백이 어떤 페이로드를 받는지 정리할게요.

| 콜백 | 페이로드 | 반환값 |
|---|---|---|
| `onBeforeTaskChange` | `GanttTaskChange` | `boolean \| void \| Promise<boolean \| void>` |
| `onReorder` | `GanttReorderChange` | `void \| boolean` |
| `onDependencyCreate` | `GanttDependencyChange` | `boolean \| void` |
| `onDependencyDelete` | `GanttDependencyChange` | `boolean \| void` |
| `onTaskCreate` | `GanttTaskDraft` | `void` |

prop 시그니처는 [GanttProps](props.md)에 모두 정리돼 있어요. 거부가 실제로 어떻게 동작하는지는 [이벤트와 취소 가능한 변경](../events.md)에서 다뤄요.

## GanttChangeType

```ts
/** 제스처가 곧 쓰려는 내용 */
export type GanttChangeType = 'move' | 'resize' | 'progress';
```

| 값 | 제스처 |
|---|---|
| `'move'` | 막대 전체를 드래그했어요. `startDate`와 `endDate`가 모두 다시 쓰여요. |
| `'resize'` | 한쪽 가장자리를 드래그했어요. `edge`가 어느 쪽인지 알려주고, 그 날짜만 다시 쓰여요. |
| `'progress'` | 진행률 핸들을 드래그했어요. `progress`만 다시 쓰여요. |

## GanttTaskChange

```ts
/**
 * 끝난 제스처가 커밋하려는 변경
 *
 * 아무것도 쓰이기 전에 `onBeforeTaskChange`로 넘어가요. 호스트 앱은 이걸 서버로 보내고
 * 거부로 답할 수 있어요.
 */
export interface GanttTaskChange {
  type: GanttChangeType;
  /** 사용자가 잡은 막대 */
  task: Task;
  /** 이 제스처가 다시 쓰는 작업만 - 요약 막대를 드래그하면 하위 트리 전체가 담겨요 */
  changedTasks: Task[];
  /** 같은 작업들의 제스처 직전 상태, 순서도 그대로예요 */
  previousTasks: Task[];
  /** 차트가 `onTasksChange`에 넘길 전체 배열 */
  tasks: Task[];
  /** 어느 가장자리가 움직였는지 - `resize`에서만 */
  edge?: 'start' | 'end';
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `type` | `GanttChangeType` | 막대 드래그는 `'move'`, 가장자리 드래그는 `'resize'`, 진행률 핸들은 `'progress'`예요. |
| `task` | `Task` | 제스처가 시작된 막대의 작업이에요. 제스처가 끝난 뒤 상태로 담겨요. |
| `changedTasks` | `Task[]` | 이 제스처가 다시 쓰는 모든 작업의 제스처 이후 상태예요. 렌더 순서를 따라요. |
| `previousTasks` | `Task[]` | 같은 작업들의 이전 상태예요. `changedTasks`와 인덱스가 하나씩 대응해요. |
| `tasks` | `Task[]` | 변경이 커밋되면 `onTasksChange`가 받는 전체 배열이에요. |
| `edge` | `'start' \| 'end'` | 왼쪽 가장자리 크기 조절은 `'start'`, 오른쪽은 `'end'`예요. `'move'`와 `'progress'`에서는 `undefined`예요. |

`Task`는 [Task와 작업 타입](task.md)에 정의돼 있어요.

`changedTasks`에 항목이 여러 개 담기는 경우는 두 가지예요. 첫째는 요약 막대를 드래그해서 하위 트리 전체가 움직인 경우예요. 둘째는 자동 스케줄링이 켜져 있고, 드롭이 후행 작업(successor)을 밀어낸 경우예요. 둘 다 [작업 편집](../editing.md)과 [스케줄링](../scheduling.md)에서 설명해요.

## GanttBeforeChangeHandler

```ts
/**
 * 제스처가 커밋되기 전에 실행되고, 커밋을 취소할 수 있어요
 *
 * `false`를 반환하거나, `false`로 resolve되는 프로미스나 reject된 프로미스를 반환하면
 * 막대가 원래 자리로 돌아가요. 그 밖의 값은 모두 커밋돼요. 프로미스가 대기 중인 동안
 * 막대는 놓인 자리에 그대로 있어서, UI가 왕복 통신에 멈추지 않아요.
 */
export type GanttBeforeChangeHandler = (
  change: GanttTaskChange
) => boolean | void | Promise<boolean | void>;
```

## GanttReorderChange

```ts
/**
 * 행 드래그가 커밋한 내용 - 이동을 저장하는 데 필요한 모든 것
 *
 * 콜백에서 `false`를 반환하면 드롭이 취소돼요. 차트에는 아무것도 쓰이지 않고
 * `onTasksChange`도 실행되지 않아요.
 */
export interface GanttReorderChange {
  /** 이동한 작업, 새 parentId와 sequence를 이미 갖고 있어요 */
  task: Task;
  /** 새 부모 (null = 루트) */
  parentId: string | null;
  /** 들어온 데이터에서 작업이 갖고 있던 부모, 정규화가 건드리지 않은 값이에요 */
  previousParentId: string | null;
  /** 새 부모의 자식들 안에서 0부터 세는 위치 */
  index: number;
  /** 이동한 작업의 새 점 표기 sequence */
  sequence: string;
  /** 갱신된 전체 배열 - onTasksChange가 받는 것과 같아요 */
  tasks: Task[];
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `task` | `Task` | 드래그한 작업이에요. 새 `parentId`와 `sequence`를 이미 갖고 있어요. |
| `parentId` | `string \| null` | 작업이 놓인 부모예요. `null`은 최상위를 뜻해요. |
| `previousParentId` | `string \| null` | 넘겨받은 배열에서 작업이 갖고 있던 `parentId`예요. 차트가 정규화하기 전 값이에요. |
| `index` | `number` | 새 부모의 자식들 안에서 0부터 세는 위치예요. |
| `sequence` | `string` | 작업의 새 점 표기 sequence예요. `task.sequence`와 같은 값이에요. |
| `tasks` | `Task[]` | 드롭이 커밋되면 `onTasksChange`가 받는, 번호가 다시 매겨진 전체 배열이에요. |

번호를 다시 매기는 규칙은 [행 순서 변경](../reordering.md)에 있어요.

## GanttDependencyChange

```ts
/** 사용자가 그린 연결, 커밋 전에 `onDependencyCreate`로 넘어가요 */
export interface GanttDependencyChange {
  /** 드래그를 시작한 작업 */
  predecessorId: string;
  /** 드래그를 놓은 작업 - `dependencies`에 항목이 추가되는 쪽 */
  successorId: string;
  type: DependencyType;
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `predecessorId` | `string` | 연결에서 앞에 오는 선행 작업(predecessor)이에요. 삭제할 때는 제거되는 항목의 `targetId`예요. |
| `successorId` | `string` | 연결에서 뒤에 오는 후행 작업이에요. 이 작업의 `dependencies` 배열에 항목이 추가되거나 빠져요. |
| `type` | `DependencyType` | `'FS'`, `'SS'`, `'FF'`, `'SF'` 중 하나예요. 드래그가 지나간 두 커넥터 점에서 결정돼요. |

`DependencyType`은 [Task와 작업 타입](task.md)에 정의돼 있어요. 네 가지 연결 타입은 [의존성](../dependencies.md)에서 설명해요.

## GanttTaskDraft

```ts
/** 사용자가 그린 작업, `onTaskCreate`로 넘어가요 - 차트는 아무것도 커밋하지 않아요 */
export interface GanttTaskDraft {
  /** UTC ISO 문자열, 현재 배율에 맞춰 스냅돼요 */
  startDate: string;
  endDate: string;
  /** 범위를 그린 행의 작업 id, 행에 작업이 없으면 null */
  rowTaskId: string | null;
}
```

| 필드 | 타입 | 의미 |
|---|---|---|
| `startDate` | `string` | UTC ISO 문자열이에요. 현재 배율에서 드래그가 닿은 첫 눈금의 시작이에요. |
| `endDate` | `string` | UTC ISO 문자열이에요. 드래그가 닿은 마지막 눈금의 끝이라, 범위는 항상 눈금 전체를 덮어요. |
| `rowTaskId` | `string \| null` | 범위를 그린 행을 소유한 작업이에요. 그룹 헤더 행과 마지막 행 아래 드래그에서는 `null`이에요. 작업이 여러 개인 레인 행에서는 첫 작업의 id가 나와요. |

그리는 동작은 [작업 편집](../editing.md)에서 설명해요.

## 제약

취소 가능한 네 콜백은 반환값을 읽는 방식이 서로 달라요.

| 콜백 | 거부 판정 | 프로미스 await | 예외가 던져질 때 |
|---|---|---|---|
| `onBeforeTaskChange` | resolve된 값이 `=== false` | 함 | 되돌려요 |
| `onReorder` | 반환값이 `=== false` | 안 함 | 포인터 핸들러로 전파돼요 |
| `onDependencyCreate` | 반환값이 `=== false` | 안 함 | 포인터 핸들러로 전파돼요 |
| `onDependencyDelete` | 반환값이 `=== false` | 안 함 | 포인터 핸들러로 전파돼요 |
| `onTaskCreate` | 취소할 수 없음 | 안 함 | 포인터 핸들러로 전파돼요 |

await하는 콜백은 `onBeforeTaskChange` 하나뿐이에요. 차트는 핸들러가 반환한 값을 await하고, 엄격하게 `=== false`일 때만 거부해요. `undefined`, `null`, `0`, `''`은 모두 커밋돼요. 예외가 던져지거나 프로미스가 reject되면 실패로 보고 막대를 되돌려요. 프로미스가 대기 중인 동안 막대는 사용자가 놓은 자리에 남고, 아무것도 쓰이지 않아요.

`onReorder`, `onDependencyCreate`, `onDependencyDelete`는 동기적으로 `false`와 비교돼요. 반환된 프로미스는 객체라서 절대 `false`가 아니에요. 그래서 변경은 곧바로 커밋되고, 프로미스가 나중에 resolve하는 값은 무시돼요.

`onTaskCreate`는 `void`를 반환하고, 그 반환값은 버려져요. 차트가 스스로 작업을 추가하지는 않아요. 행은 호스트 앱이 새 `tasks` 배열을 다시 넘길 때만 나타나요.

`onBeforeTaskChange` 프로미스가 아직 대기 중인데 같은 레인(lane)에서 두 번째 제스처가 일어날 때가 있어요. 이때는 늦게 온 답을 적용하지 않고 버려요. 이동과 크기 조절은 작업마다 레인 하나를 함께 써서 서로를 대체해요. 진행률 편집은 자기 레인을 따로 써서, 대기 중인 날짜 변경을 건드리지 않아요.

`onBeforeTaskChange`는 포인터 제스처에서만 실행돼요. 키보드 이동과 키보드 진행률 조정은 차트에 바로 커밋돼요. 이 콜백을 거치지 않고 `onTasksChange`를 호출해요.

`GanttDependencyChange`에는 `lag`가 없어요. 생성 콜백과 삭제 콜백 모두 연결을 양 끝과 타입으로만 설명해요.

다음: [GanttHandle](handle.md).
