행 데이터는 데이터베이스에서 나오고, 필드 이름은 차트가 원하는 것과 하나도 맞지 않아요. 매핑을 시작하기 전에 어떤 필드가 필수인지, 어떤 필드가 prop을 켜기 전까지는 아무 일도 하지 않는지 알아야 해요. 값이 잘못된 형태로 들어왔을 때 무슨 일이 벌어지는지도 알아야 해요. 차트는 검증을 전혀 하지 않아요. 그래서 필드가 틀려도 오류가 나지 않고, 대신 틀린 그림이 그려져요. 이 문서는 `tasks`에 넘기는 배열의 계약이에요.

## 렌더링되는 최소 형태

작업마다 필수 필드 여섯 개가 필요해요. 나머지는 전부 선택이에요.

```tsx
// src/TaskDataExample.tsx
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2025-06-01',
    endDate: '2025-06-10',
    parentId: null,
    sequence: '1',
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2025-06-10',
    endDate: '2025-06-24',
    parentId: null,
    sequence: '2',
    progress: 40,
    dependencies: [{ targetId: 'design', type: 'FS' }],
  },
];

export function TaskDataExample() {
  return <ReactGanttChart tasks={tasks} height={400} />;
}
```

`tasks` 자체는 컴포넌트에서 선택 prop이에요. 빼거나 `[]`를 넘기면 빈 차트가 그려져요.

## 작업 필드

| 필드 | 타입 | 필수 | 기본값 | 의미 |
|---|---|---|---|---|
| `id` | `string` | 예 | — | 식별자예요. 의존성, 롤업(roll-up), 실행 취소 패치가 모두 이 값으로 작업을 찾아요. 고유한지는 검사하지 않아요. |
| `name` | `string` | 예 | — | 막대와 작업 목록 셀, ARIA 레이블에 붙는 이름이에요. 텍스트로 렌더링돼요. |
| `startDate` | `string` | 예 | — | 막대의 왼쪽 끝이에요. dayjs가 파싱할 수 있는 문자열이면 돼요. [날짜와 시간대](#날짜와-시간대)를 참고하세요. |
| `endDate` | `string` | 예 | — | 막대의 오른쪽 끝이에요. 마일스톤에서는 무시되는데, 아래에 예외가 하나 있어요. |
| `parentId` | `string \| null` | 예 | — | 부모 작업의 id예요. 최상위면 `null`이에요. `hierarchy`를 켰을 때만 읽어요. |
| `sequence` | `string` | 예 | — | 점으로 구분한 숫자예요. `'1'`, `'2.1'`, `'2.10'` 같은 값이 행 순서를 정해요. |
| `type` | `'task' \| 'milestone'` | 아니요 | `'task'` | `'milestone'`이면 `startDate` 위치에 마름모를 그려요. |
| `progress` | `number` | 아니요 | 없음 | 0에서 100 사이의 백분율이에요. 빼면 진행률 채움이 그려지지 않아요. |
| `color` | `string` | 아니요 | 테마 토큰 | CSS 색상이면 무엇이든 돼요. 진행률 채움과 호버 음영이 이 값에서 파생돼요. |
| `className` | `string` | 아니요 | 없음 | 막대 요소와 작업 목록 행에 덧붙는 클래스예요. |
| `lane` | `string` | 아니요 | 자기 행 | 같은 레인을 쓰는 작업들은 한 행에 나란히 그려져요. 빈 문자열은 없는 것으로 쳐요. |
| `dependencies` | `TaskDependency[]` | 아니요 | `[]` | 이 작업이 기다리는 선행 작업(predecessor) 목록이에요. |
| `readOnly` | `boolean` | 아니요 | 없음 | 이 작업의 모든 제스처를 막아요. |
| `allowMove` | `boolean` | 아니요 | 없음 | 막대를 좌우로 끄는 동작을 허용하거나 막아요. |
| `allowResize` | `boolean` | 아니요 | 없음 | 양쪽 끝을 끄는 동작을 허용하거나 막아요. |
| `allowProgressChange` | `boolean` | 아니요 | 없음 | 진행률 핸들을 허용하거나 막아요. |
| `allowLinkCreate` | `boolean` | 아니요 | 없음 | 이 작업에서 의존성 드래그를 시작하는 것을 허용하거나 막아요. |
| `allowLinkDelete` | `boolean` | 아니요 | 없음 | 이 작업이 가진 의존성을 지우는 것을 허용하거나 막아요. |
| `minDate` | `string` | 아니요 | 차트의 `minDate` | 드래그가 도달할 수 있는 가장 이른 날짜예요. |
| `maxDate` | `string` | 아니요 | 차트의 `maxDate` | 드래그가 도달할 수 있는 가장 늦은 날짜예요. |
| `manuallyScheduled` | `boolean` | 아니요 | `false` | 일정 계산 엔진이 이 작업을 절대 옮기지 않아요. 그래도 후행 작업(successor)을 제약하는 역할은 그대로예요. |
| `baselineStart` | `string` | 아니요 | 없음 | 계획된 시작일 스냅샷이에요. 실제 막대 아래에 얇은 막대로 그려져요. 이 값만 있으면 점 하나만 그려요. |
| `baselineEnd` | `string` | 아니요 | 없음 | 계획된 종료일 스냅샷이에요. `baselineStart`가 없으면 완전히 무시돼요. |

`allowX` 플래그 다섯 개와 `readOnly`는 구체적인 쪽이 먼저 이겨요. `task.allowX`, `task.readOnly`, 차트 설정 순서예요. [작업 편집](editing.md)에 자세히 나와요. `minDate`와 `maxDate`는 이 순서를 쓰지 않아요. 작업에 값이 있으면 차트 값을 그대로 대체해요. `color`와 `className`, 그리고 색이 지정된 막대가 설정하는 CSS 변수는 [커스텀 렌더링](custom-rendering.md)에서 다뤄요. `lane`은 [그룹과 스윔레인](grouping.md)에서 다뤄요.

### 혼자서는 아무 일도 하지 않는 필드

필드 세 개는 특정 prop을 켰을 때만 읽혀요. `lane`과 베이스라인 필드 두 개는 아니에요.

| 필드 | 필요한 조건 |
|---|---|
| `parentId` | `hierarchy` — 없으면 트리를 만들지 않고, 깊이는 `sequence`에서 나오고, 요약 행도 생기지 않아요. [작업 목록과 계층](task-list.md)을 참고하세요. |
| `manuallyScheduled` | `schedulingPolicy`가 `'off'`가 아닌 값이어야 해요. [일정 계산](scheduling.md)을 참고하세요. |
| `TaskDependency.lag` | `schedulingPolicy` 또는 `criticalPath`가 필요해요. 둘 다 없는 차트에서는 `lag: 5` 링크가 `lag: 0`과 똑같이 그려져요. |
| `lane` | 없어요. 패킹은 `groupBy`가 있든 없든 동작해요. `groupBy`를 켜면 레인은 자기 그룹 안에서만 묶여요. [그룹과 스윔레인](grouping.md)을 참고하세요. |
| `baselineStart` / `baselineEnd` | **없어요.** `baselineStart`가 있기만 하면 베이스라인이 바로 그려지고, 타임라인 범위도 넓어져요. 이를 막는 prop은 없고, 필드를 지우는 것 말고는 끌 방법도 없어요. [일정 계산](scheduling.md)을 참고하세요. |

`manuallyScheduled`는 사용자가 막대를 끄는 것까지 막지는 않아요. 일정 계산 엔진이 옮기는 것만 막아요.

### TaskDependency 필드

의존성은 **후행 작업**에 붙고, 자기 선행 작업을 가리켜요.

| 필드 | 타입 | 필수 | 기본값 | 의미 |
|---|---|---|---|---|
| `targetId` | `string` | 예 | — | 선행 작업의 `id`예요. |
| `type` | `'FS' \| 'SS' \| 'FF' \| 'SF'` | 예 | — | 첫 글자는 선행 작업의 끝점, 둘째 글자는 후행 작업의 끝점이에요. |
| `lag` | `number` | 아니요 | `0` | 부호 있는 일수예요. 양수는 지연(lag), 음수는 리드예요. `workingCalendar`를 켜면 근무일 기준이에요. |

네 가지 타입이 일정 계산에서 뜻하는 바, 그리고 화살표를 그리고 지우는 방법은 [의존성](dependencies.md)에 있어요.

두 가지 항목은 경고 없이 버려져요. `targetId`가 `tasks`에 없는 항목, 그리고 `targetId`가 자기 자신의 id인 항목이에요. 알 수 없는 `type`은 그 화살표를 건너뛰고, 개발 빌드에서만 값마다 한 번씩 `console.warn`을 남겨요. 프로덕션 번들에서는 아무 신호 없이 화살표만 사라져요.

## 날짜와 시간대

차트는 모든 날짜를 UTC 모드로 고정된 dayjs 인스턴스로 파싱해요. `timezone` 플러그인은 로드되지 않아서, 보는 사람마다 로컬 시간으로 바꾸는 모드는 없어요.

| 입력 | 화면에 표시되는 값 |
|---|---|
| `'2025-06-01T09:00:00Z'` | 그 시점을 UTC 시계로 읽은 09:00 |
| `'2025-06-01T18:00:00+09:00'` | 같은 시점이라 역시 09:00 |
| `'2025-06-01T09:00'` | UTC 벽시계로 읽어서, 누가 보든 09:00 |
| `'2025-06-01'` | `2025-06-01T00:00:00.000Z`, UTC 자정 |

그래서 `YYYY-MM-DD`만 넘기는 게 안전해요. 서울에서 보든 로스앤젤레스에서 보든 적힌 그 날짜에 놓여요.

UTC ISO 문자열은 차트가 내보내는 형태지만, 입력에서 요구하는 형태는 아니에요. dayjs가 파싱할 수 있는 문자열이면 무엇이든 되고, 시간대가 없는 문자열은 거부되거나 밀리지 않고 UTC 벽시계로 읽혀요. 그리드가 UTC라서 시간 셀은 모두 60분 폭이고 날짜 셀도 모두 같은 폭이에요. 서머타임 때문에 로컬 하루가 23시간이나 25시간이 되는 날에도 마찬가지예요.

작업에는 날짜 검증이 없어요. 파싱할 수 없는 `startDate`는 행을 숨기지도, 예외를 던지지도 않아요. 그 막대는 타임라인 왼쪽 끝에서 시작해 전체 폭을 차지해요. 마커와 범위 밴드는 검증을 *하니까*, 같은 잘못된 문자열이 마커로는 조용히 버려지고 작업으로는 전체 폭으로 그려져요.

차트가 되돌려주는 값은 모두 `toISOString()`으로 직렬화돼요. `'2025-06-01'`로 넘긴 작업은 첫 드래그 뒤에 `'2025-06-01T00:00:00.000Z'`로 돌아와요. 아래 비교 규칙에서 이게 중요해요.

## sequence와 parentId

`sequence`는 언제나 행 순서를 정해요. `parentId`는 중첩을 정하는데, `hierarchy`를 켰을 때만이에요. 둘 사이를 맞춰 주는 장치는 없어요.

구간은 왼쪽부터 숫자로 비교해요. `'1.10'`은 `'1.2'`보다 앞이 아니라 뒤에 와요. 없는 구간은 `0`으로 쳐서 `'1'`과 `'1.0'`은 같다고 나오고, 같으면 배열에 있던 순서를 유지해요. 입력 배열은 정렬 전에 복사되고, 절대 변형되지 않아요.

숫자가 아닌 구간은 `0`이 돼요. `'abc'`, `'1a'`, `''`는 모두 `'0'`처럼 정렬돼서 `'1'`보다 앞에 오고, 경고는 없어요. `sequence`가 중복돼도 오류는 아니에요. 두 행이 동점이 되고, 배열 순서가 동점을 갈라요.

> [!WARNING]
> `sequence`가 없으면 예외가 나요. 타임라인을 만드는 레이아웃 이펙트 안에서 `undefined`에 `sequence.split('.')`을 호출하고, 차트 전체가 렌더링에 실패해요. TypeScript가 이 필드를 필수로 표시하니까, 손으로 만든 JSON이나 타입 없이 매핑한 데이터에서만 문제가 돼요.

`hierarchy`가 꺼져 있으면 들여쓰기 깊이는 `sequence`의 점 개수예요. 그래서 `'2.1.1'`은 두 단계 안쪽에 그려져요. `hierarchy`를 켜면 깊이는 `parentId` 사슬에서 나오고, `sequence`는 순서만 정해요. 앞뒤가 안 맞는 입력은 그대로 안 맞게 그려져요. `sequence`가 부모보다 앞서는 자식은 부모 위에 그려져요.

라이브러리가 `sequence`를 다시 쓰는 상황은 딱 하나예요. 행을 재정렬하면 결과 트리를 깊이 우선으로 훑어 **모든** 작업의 번호를 다시 매기고, `parentId`는 옮긴 작업에만 써요. 재정렬 뒤에는 옮긴 행만이 아니라 배열 전체를 저장하세요. [행 재정렬](reordering.md)을 참고하세요.

## 마일스톤

마일스톤은 `type`이 정확히 `'milestone'` 문자열인 작업이에요. 비교가 엄격해서 `'Milestone'`과 `'MILESTONE'`은 그냥 일반 작업이에요.

마일스톤은 `startDate` 한 점만 차지하고, 계산된 막대 폭은 1px이며, 그 자리를 중심으로 16px 마름모를 그려요. 일정 계산과 임계 경로(critical path)에는 기간 0으로 보고돼요. 크기 조절은 절대 안 되고, 어떤 권한 플래그로도 다시 켤 수 없어요. 진행률 채움도 그리지 않아요. 롤업은 `startDate` 기준으로 세고, 레인 패킹은 `startDate`를 끝점으로 취급해요.

이 목록에서 빠진 하나가 키보드예요. 숫자 `progress`를 이미 가진 마일스톤은 키보드로 값을 올리고 내릴 수 있어요. 값은 바뀌고 `onTasksChange`도 호출되지만, 화면에서는 아무것도 움직이지 않아요. 진행률 편집이 구조적으로 막힌 건 요약 행뿐이에요.

까다로운 부분은 `endDate`예요. 렌더링도, 롤업도, 일정 계산도 이 값을 무시해요. 하지만 타임라인을 데이터에 맞추는 함수는 모든 작업의 `endDate`를 조건 없이 읽어요.

```ts
import type { Task } from '@jaeungkim/gantt-chart';

// 이 마일스톤은 2025-02-01에 마름모로 그려지지만,
// 아무것도 그려지지 않는 2030년까지 타임라인을 늘려 놔요.
const milestone: Task = {
  id: 'launch',
  name: 'Launch',
  type: 'milestone',
  startDate: '2025-02-01',
  endDate: '2030-01-01',
  parentId: null,
  sequence: '3',
};
```

마커의 `warnOnOverrun` 검사도 `endDate`를 똑같이 조건 없이 읽어요. 그래서 마일스톤은 그려지지도 않는 날짜에서 초과 경고를 띄울 수 있어요. 모든 마일스톤에 `endDate`를 `startDate`와 같게 두면 두 문제 모두 사라져요. 마일스톤의 `endDate`가 쓰이는 다른 한 곳은 롤업 진행률이고, 자식의 기간 가중치로 들어가요.

## progress

`progress`는 0에서 100 사이의 숫자예요. 범위를 벗어난 값은 거부되지 않고 잘려서 맞춰져요.

| 넘긴 값 | 실제로 쓰이는 값 |
|---|---|
| `42` | `42` |
| `33.7` | `33.7` — 반올림 없음 |
| `-10` | `0` |
| `150` | `100` |
| `Infinity` | `100` |
| `-Infinity` | `0` |
| `undefined` | 없음 — 채움을 그리지 않아요 |
| `NaN` | 없음 |
| `'50'` | 없음 — 문자열은 변환되지 않고 버려져요 |

사람들이 걸리는 건 마지막 행이에요. API에서 문자열로 온 백분율은 파싱되지 않아요. 막대는 채움 없이 그려지고, 아무것도 문제를 알려 주지 않아요.

반올림은 차트가 값을 *만들어 내는* 곳에서만 일어나요. 진행률 핸들을 끌면 정수가 나오고, 요약 행의 롤업 백분율도 반올림돼요. 직접 넘긴 소수 값은 소수 그대로 남아요.

부모가 가진 `progress`는 자식에서 롤업한 값보다 언제나 우선해요. 롤업 공식은 [작업 목록과 계층](task-list.md)에 있어요.

## tasks prop 업데이트하기

막대를 끌면 `onTasksChange` 핸들러가 상태에 쓰고, 그 상태가 다시 `tasks`로 내려오는데, 막대는 원래 자리로 되돌아가요. 더 나쁜 경우도 있어요. 막대는 그대로인데 실행 취소 스택이 비어 있어요. 둘 다 같은 구조에서 나와요.

차트는 들어온 `tasks` 배열과 마지막으로 받아들인 배열을 양쪽 다 `JSON.stringify`로 만들어 비교해요. 구조 비교도, 필드별 비교도 없어요. 두 문자열이 같으면 업데이트를 버리고 차트가 자기 상태를 유지해요. 방금 한 드래그가 되돌아가지 않는 건 이 덕분이에요. 문자열이 다르면 차트는 데이터를 교체하고 **실행 취소 스택 두 개를 모두 비워요**. 문자열이 다르다는 건 호스트 앱이 데이터를 갈아 끼웠다는 뜻이니까요.

문자열 비교에는 구조 비교라면 없었을 결과가 두 가지 따라와요.

**키 순서가 중요해요.** 아래 두 객체는 같은 작업을 나타내지만 서로 다른 문자열이 돼요.

```ts
JSON.stringify({ id: 'a', name: 'Design' }); // '{"id":"a","name":"Design"}'
JSON.stringify({ name: 'Design', id: 'a' }); // '{"name":"Design","id":"a"}'
```

**값이 `undefined`인 키는 보이지 않아요.** `{ id: 'a', progress: undefined }`와 `{ id: 'a' }`는 똑같이 직렬화돼서, 둘을 오가는 건 변경이 아니에요.

같은 코드에서 두 가지가 더 따라와요. 직접 붙인 추가 속성도 비교에 들어가고, 배열 참조를 그대로 둔 채 작업을 제자리에서 수정하면 보이지 않아요. 비교 자체가 실행되지 않으니까요.

### 잘못된 업데이트와 올바른 업데이트

이 핸들러는 모든 작업을 다른 키 순서로 다시 만들고 날짜 형식도 바꿔요. 모든 문자열이 차트가 내보낸 것과 달라져서, 제스처를 할 때마다 방금 쌓인 실행 취소 기록이 지워져요.

```tsx
// 잘못된 방식
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';

function Wrong({ tasks, setTasks }: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={(updated) => {
        setTasks(
          updated.map((task) => ({
            name: task.name,
            id: task.id,
            startDate: task.startDate.slice(0, 10), // '2025-06-01T00:00:00.000Z' -> '2025-06-01'
            endDate: task.endDate.slice(0, 10),
            parentId: task.parentId,
            sequence: task.sequence,
          }))
        );
      }}
    />
  );
}
```

받은 것을 그대로 돌려주세요. 그 배열은 이미 새 배열이고, 안에 든 객체도 이미 차트가 내보낸 형태예요.

```tsx
// 올바른 방식
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';

function Right({ tasks, setTasks }: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={(updated) => setTasks(updated)}
    />
  );
}
```

API에 맞춘 변형은 prop으로 되돌아가는 길이 아니라 저장 호출 안에서 하세요. 작업을 넣거나 지우느라 데이터를 직접 바꿔야 할 때가 있어요. 그럴 때는 차트가 마지막으로 내보낸 배열에서 새 배열을 만드세요. 실행 취소 기록이 초기화되는 건 받아들여야 해요. 실행 취소 한 단계가 무엇을 담는지, `onBeforeTaskChange`가 어디에 끼어드는지는 [이벤트와 변경 취소](events.md)에 있어요.

## 한계

차트는 배열을 읽기만 해요. 단속하지는 않아요.

- **어떤 검증도 없어요.** 필수 필드 검사도, 날짜 파싱 검사도, id 고유성 검사도, `progress` 범위 검사도, `DependencyType` 소속 검사도 없어요. 모델 전체에서 런타임 진단은 알 수 없는 의존성 타입을 알리는 개발 전용 `console.warn` 하나뿐이에요.
- **중복 id는 절대 감지되지 않아요.** 배열 항목마다 행은 그대로 생기지만, id로 찾는 조회는 마지막 항목만 남겨요. 의존성과 롤업, 실행 취소 패치가 엉뚱한 작업을 가리켜요. 배열을 넘기기 전에 중복을 제거하세요.
- **입력을 정규화하지 않아요.** 날짜를 다시 직렬화하지 않고, `sequence`도 다시 매기지 않고, `parentId`도 고쳐 쓰지 않아요. 부모를 잃은 작업이나 순환은 트리를 만들 때 최상위로 *취급*되지만, 필드 값 자체는 넘긴 그대로 남아요.
- **로컬 시간대 모드가 없어요.** UTC가 하드코딩돼 있어요. 사용자에게 로컬 벽시계 시간이 필요하면 호스트 앱에서 변환하세요.
- **차트는 작업을 추가하거나 삭제하지 않아요.** 새 작업을 그리면 `onTaskCreate`로 초안을 제안하고, `id`와 `parentId`, `sequence`는 호스트 앱이 채워요. 행 개수 변화는 필드 패치로 되돌릴 수 없어서, 단계를 쌓는 대신 실행 취소 기록을 비워요.
- **메타데이터 필드는 없어요.** 타입이 구조적이라 추가 속성은 살아남지만, 타입이 붙지 않고 `tasks` 비교에도 포함돼요.
- **`TaskTransformed`는 출력 전용이에요.** 차트가 렌더러와 컬럼 함수에 넘겨주는 타입이고, `tasks`는 오직 `Task`만 받아요. 필드 목록은 [Task](ref/task.md)에 있어요.
- **`sequence`와 `parentId`를 맞춰 주는 장치는 없어요.** `sequence`가 부모보다 앞서는 자식은 계속 부모 위에 그려져요. 첫 행 재정렬이 배열 전체 번호를 다시 매길 때까지요.

넘긴 객체에는 아무것도 되쓰지 않아요. 모든 변경은 새 배열이 되어 `onTasksChange`로 나가고, 직접 가진 사본은 교체하기 전까지 그대로예요.

다음: [작업 목록과 계층](task-list.md) — `parentId`를 요약 행으로 바꾸고, 그 옆에 놓을 컬럼을 고르기.
