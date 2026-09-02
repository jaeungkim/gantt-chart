막대 하나를 이틀 뒤로 끌어다 놓았어요. 후행 작업(successor)은 제자리에 그대로 있고, 기다려야 할
작업 위에 겹쳐 앉아 있어요. 그 막대 아래로 이어지는 날짜는 전부 틀어졌는데, 화면은 아무 말도 하지
않아요. `schedulingPolicy`는 막대가 움직일 때 후행 작업을 어떻게 할지 정해요.

## `schedulingPolicy`로 자동 일정 계산하기

이 prop은 세 가지 값 중 하나를 받고, 기본값은 `"off"`예요.

| 값 | 후행 작업이 움직이는 때 | 방향 | 결과 |
|---|---|---|---|
| `"off"` | 없음 | – | 아무것도 전파되지 않아요. 기능이 아예 없는 것과 같아요 |
| `"shift-on-overlap"` | 링크가 깨졌을 때만 | 뒤로만 | 후행 작업은 원래 갖고 있던 여유(slack)를 그대로 지켜요 |
| `"maintain-gap"` | 링크에 딱 붙어 있지 않을 때마다 | 뒤로도 앞으로도 | 후행 작업이 가능한 가장 이른 날짜에 놓여요. 그래서 간격이 링크의 `lag`와 같아져요 |

실제로 동작하는 두 정책의 차이는 클램프 하나예요. `shift-on-overlap`은 음수 보정을 버리고 앞으로만
밀어요. `maintain-gap`은 그 보정을 적용해요. 그래서 선행 작업(predecessor)이 앞당겨지면 후행 작업도
당겨져요.

```tsx
// src/App.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  {
    id: 'design',
    name: 'Design',
    startDate: '2026-03-02T09:00:00Z',
    endDate: '2026-03-06T17:00:00Z',
    parentId: null,
    sequence: '1',
  },
  {
    id: 'build',
    name: 'Build',
    startDate: '2026-03-09T09:00:00Z',
    endDate: '2026-03-20T17:00:00Z',
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: 'design', type: 'FS' }],
  },
];

export function App() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      schedulingPolicy="shift-on-overlap"
    />
  );
}
```

각 작업의 어느 쪽 끝을 링크가 붙잡는지는 의존성의 몫이지 이 페이지의 주제가 아니에요. 네 가지 타입과
`lag`는 [의존성](dependencies.md)에서 다뤄요.

### 언제 실행되나요

엔진은 막대 드래그에서만 실행돼요. 이동과 왼쪽·오른쪽 크기 조절이 모두 엔진을 거쳐요. 크기 조절이 어떤
후행 작업을 건드리는지는 링크 타입에 달려 있어요. 타입마다 선행 작업의 특정한 한쪽 끝을 읽기
때문이에요.

링크를 그려도 일정은 다시 계산되지 않아요. 링크를 지우거나, 새 `tasks` 배열을 불러오거나, 행 순서를
바꾸거나, `criticalPath`를 켜도 마찬가지예요. 겹쳐 있는 후행 작업 위에 FS 링크를 새로 그려도, 누군가
막대를 끌기 전까지 그 겹침은 그대로 남아요.

포인터를 누르고 있는 동안 후행 작업은 막대를 따라 화면에서 함께 움직여요. 드래그 중에는 아무것도
기록되지 않아요. 손을 떼면 끌던 작업과 움직인 모든 후행 작업이 하나의 배열로 `onTasksChange`에 함께
도착해요. 실행 취소 한 단계로 묶여요.

### 절대 움직이지 않는 것

`manuallyScheduled: true`인 작업은 건너뛰어요. 그 작업의 날짜는 전파를 그대로 견뎌요. 후행 작업은
여전히 그 날짜를 기준으로 계산돼요. 그래서 작업 하나를 고정해도 그 작업을 지나는 사슬이 끊기지는
않아요. 이 필드 자체는 나머지 작업 형태와 함께 [작업 데이터](task-data.md)에 정리돼 있어요.

끌고 있던 막대도 고정돼요. 포인터가 놓아준 자리에 그대로 앉아요. 자기 선행 작업 링크가 깨져도
마찬가지예요. 엔진은 그 막대에서 앞쪽으로만 걸어가기 때문이에요. 선행 작업은 절대 밀리지 않아요.

`hierarchy`가 켜져 있으면 요약 행도 고정돼요. 다른 작업의 `parentId`로 등장하는 id는 전부 건너뛰어요.
그 날짜는 어차피 자식에서 말아 올려지기 때문이에요. 이 롤업은
[작업 목록과 계층](task-list.md)에서 설명해요.

작업의 모양은 바뀌지 않아요. 전파는 양쪽 끝을 같은 일수만큼 옮겨요. 그래서 기간과 하루 중 시각은
그대로 남아요.

## 순환

의존성 루프는 절대 따라가지 않아요. 그래프는 위상 정렬되고, 정렬할 수 없는 것은 순회에서 빠져요. 그런
작업은 자기 날짜에 그대로 남아요. 나머지 프로젝트는 그 주위로 계속 계산돼요.

`onSchedulingCycle`은 무엇이 빠졌는지 알려줘요:

```tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';

export function Schedule({ initial }: { initial: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [stalled, setStalled] = useState<string[]>([]);

  return (
    <>
      {stalled.length > 0 && <p>Not scheduled: {stalled.join(', ')}</p>}
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        schedulingPolicy="maintain-gap"
        onSchedulingCycle={(taskIds: string[]) => setStalled(taskIds)}
      />
    </>
  );
}
```

배열에는 정렬할 수 없었던 모든 id가 담겨요. 루프의 구성원만 담기는 게 아니에요. 순환의 아래쪽에 놓였을
뿐인 작업도 함께 들어가요. 그 작업 역시 정렬할 수 없었기 때문이에요. 그 목록이 곧 엔진이 날짜를
건드리지 않은 작업들이에요.

애초에 데이터에서 루프를 막는 일은 `canLink`의 몫이에요. 시그니처는
[작업 그래프 헬퍼](ref/core-graph.md)에 있어요.

> [!WARNING]
> `onSchedulingCycle`은 제스처 한 번에 여러 번 발생해요. 드래그 단계가 바뀐 프리뷰 프레임마다 한 번,
> 드롭에서 한 번, 커밋에서 한 번이에요. 그리고 `schedulingPolicy`가 `"off"`일 때는 아예 발생하지
> 않아요. 그 경우엔 그래프 자체를 만들지 않기 때문이에요. 다이얼로그를 여는 용도가 아니라 상태를
> 설정하는 용도로 쓰세요.

## 근무일 달력

`workingCalendar`는 불리언이고 기본값은 `false`예요. 켜면 차트가 비근무일을 건너뛰는 달력을 만들어요.
그 달력은 일정 계산 엔진, 임계 경로(critical path) 패스, 드래그의 드롭 스냅에 넘어가요. 끄면 이 셋은
모든 날을 세는 달력을 받아요. 평범한 달력 산술이에요.

```tsx
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';

export function WorkWeek({ tasks, setTasks }: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      schedulingPolicy="maintain-gap"
      workingCalendar
      holidays={['2026-09-21']}
    />
  );
}
```

이 달력은 타임라인에 음영을 칠하는 것과 같은 판별식으로 만들어져요. `isNonWorkingDay`를 따로 넘기지
않으면 토요일, 일요일, 그리고 `holidays`에 적힌 날짜가 비근무일이에요. 날짜는 UTC 기준
`YYYY-MM-DD`로 맞춰요. 그래서 음영과 건너뛰는 날이 어긋날 수 없어요. 음영 자체와 두 prop은
[타임라인](timeline.md)이 다뤄요.

`isNonWorkingDay`를 넘기면 이 판별 전체가 대체돼요. 차트는 달력에 항상 판별식을 건네요. 그래서 직접
만든 달력만 설정할 수 있는 옵션인 `workingWeekdays`는 컴포넌트로는 닿을 수 없어요. 월요일부터
금요일이 아닌 근무 주는 `isNonWorkingDay` 함수로 써야 해요. 아니면 `createWorkingCalendar`로 직접
만들면 돼요. 둘 다 [근무일 달력](ref/core-calendar.md)에 있어요.

### 무엇이 바뀌나요

| 영역 | 효과 |
|---|---|
| 기간 | `duration`이 달력일이 아니라 근무일을 세요 |
| 지연(lag) | `lag: 2`가 근무일 이틀을 뜻해요 |
| 전파 | 후행 작업이 움직이면서 비근무일을 건너뛰어요 |
| 여유 | 이른 날짜와 늦은 날짜, 그리고 두 여유 값이 모두 근무일로 세어져요 |
| 드롭 스냅 | 움직인 쪽 끝이 — 막대 전체를 옮길 때는 시작이 — 다음 근무일로 밀려 붙고, 막대의 나머지는 같은 일수만큼 따라와요 |

### 무엇이 바뀌지 않나요

막대를 그리는 위치와 폭은 달력을 보지 않아요. 주말을 가로지르는 막대는 화면에서 여전히 주말을
가로질러요. 그 날들이 세어지지 않을 뿐이에요. 타임라인 눈금과 헤더 셀도 같은 이유로 그대로예요.
음영도 마찬가지고, 음영에는 자기 prop이 따로 있어요.

드래그 단계 자체는 여전히 달력일 기준이에요. 포인터를 날짜로 바꾸는 계산은 모든 날을 세요. 달력은 그
위에 앞으로 미는 스냅만 얹어요. 그래서 이동은 막대의 근무일 폭이 아니라 달력일 폭을 지켜요.

그 스냅은 앞으로만 가고, 다른 규칙에 밀릴 수 있어요. `minDate` / `maxDate` 제한이 그 뒤에 실행되고
이겨요. 그래서 경계에 고정된 막대는 토요일에 앉을 수 있어요. 스냅하면 자기 끝을 넘어가 버리는 왼쪽 끝
크기 조절은 아예 스냅하지 않아요. 이 경계는 [작업 편집](editing.md)에서 설명해요.

`schedulingPolicy="off"`이고 `criticalPath`도 꺼져 있으면, 눈에 보이는 `workingCalendar`의 변화는 드롭
스냅 하나뿐이에요.

## 임계 경로

`criticalPath`는 불리언이고 기본값은 `false`예요. 켜면 차트가 원본 작업을 대상으로 전진 패스와 후진
패스를 돌려요. 일정 계산 엔진이 쓰는 것과 같은 달력을 거쳐요.

여기서 나오는 결과는 두 가지예요. DOM에서는 패스가 임계로 표시한 모든 막대에 `critical` 클래스가
붙어요. 마일스톤도 같은 방식이고, 사슬을 따라가는 의존성 화살표와 화살촉에도 붙어요. 색은
`--gantt-critical` 계열 변수에서 가져와요. 이 변수들은 나머지와 함께 [테마](theming.md)에 정리돼
있어요. 데이터에서는 변환된 각 작업에 읽기 전용 필드가 생겨요.

| 필드 | 타입 | 의미 |
|---|---|---|
| `earlyStart` / `earlyFinish` | `string` | 작업이 실행될 수 있는 가장 이른 시점, UTC ISO 문자열 |
| `lateStart` / `lateFinish` | `string` | 프로젝트 종료를 미루지 않고 실행될 수 있는 가장 늦은 시점 |
| `totalSlack` | `number` | 프로젝트 종료가 밀리기 전까지 늦출 수 있는 일수 |
| `freeSlack` | `number` | 어떤 후행 작업의 이른 시작도 밀리지 않는 선에서 늦출 수 있는 일수 |
| `critical` | `boolean` | 총 여유가 0이고, 아직 끝나지 않음 |
| `duration` | `number` | 달력일. `workingCalendar`가 켜져 있으면 근무일 |

prop이 꺼져 있는 동안에는 `undefined`예요. 순환에 걸렸거나 그 아래쪽에 있는 작업도 계속 `undefined`로
남아요. 그런 작업은 정렬되지 않으니 지표도 생기지 않아요. 패스를 직접 돌리면 `computeCriticalPath`가
같은 값을 돌려줘요. 결과 타입은 [임계 경로](ref/core-critical-path.md)에 있어요.

```tsx
import {
  ReactGanttChart,
  type GanttColumn,
  type Task,
} from '@jaeungkim/gantt-chart';

const columns: GanttColumn[] = [
  { key: 'name', header: 'Task', width: 220 },
  { key: 'duration', header: 'Days', width: 60, render: (task) => task.duration ?? '-' },
  { key: 'totalSlack', header: 'Slack', width: 60, render: (task) => task.totalSlack ?? '-' },
];

export function Schedule({ tasks, setTasks }: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      criticalPath
      columns={columns}
    />
  );
}
```

`columns` prop은 [작업 목록과 계층](task-list.md)에서 다뤄요.

### 총 여유와 자유 여유

`totalSlack`은 프로젝트를 기준으로 재요. 프로젝트 종료일이 밀리기 전까지 작업이 늦출 수 있는
일수예요. 총 여유가 0인 작업은 임계 경로 위에 있어요.

`freeSlack`은 이웃을 기준으로 재요. 어떤 후행 작업도 더 늦게 시작하지 않는 선에서 늦출 수 있는
일수이고, 0에서 잘려요. 후행 작업이 하나도 없는 작업은 예외예요. 이때 자유 여유는 0이 아니라 총 여유와
같아요.

링크는 양쪽 끝이 모두 임계이고 그 링크가 실제로 후행 작업을 붙잡고 있을 때만 임계 사슬에 들어가요.
임계 작업 둘 사이라도 여유가 있는 링크는 빠져요.

### 진행률 100%인 작업

끝난 작업은 절대 임계가 아니에요. `progress`는 검사 전에 0-100으로 잘려요. 그래서 `150`도 완료로
쳐요. `progress`가 없거나 숫자가 아니면 완료로 치지 않아요.

여유 값은 달라지지 않아요. 사슬 위의 완료된 작업은 `totalSlack: 0`을 유지하고 `critical` 플래그만
잃어요. 임계 링크는 양쪽 끝이 필요하니, 그 작업 양옆의 링크도 함께 사슬에서 빠져요. 그래서 강조된
사슬에 눈에 띄는 구멍이 생길 수 있어요. 따라서 `critical: false`가 `totalSlack > 0`을 뜻하지는
않아요.

## 베이스라인

베이스라인은 오늘의 날짜와 비교하고 싶은 계획이에요. 작업의 두 필드가 이를 담고, 둘 다 UTC ISO
문자열이에요:

```ts
import type { Task } from '@jaeungkim/gantt-chart';

const audit: Task = {
  id: 'audit',
  name: 'Content audit',
  startDate: '2026-09-01T09:00:00Z',
  endDate: '2026-09-04T17:00:00Z',
  parentId: null,
  sequence: '2',
  baselineStart: '2026-09-01T09:00:00Z',
  baselineEnd: '2026-09-03T17:00:00Z',
};
```

베이스라인을 켜는 prop은 없어요. `baselineStart`를 가진 작업이면 일정 계산 prop이 무엇이든 실제 막대
아래에 얇은 막대를 그려요. `baselineEnd`는 선택이에요. 없으면 베이스라인은 폭 1픽셀짜리 한 점으로
줄어들어요.

베이스라인 요소는 막대가 아니라 행에 속해요. 그래서 막대를 끌면 제자리에 남은 베이스라인 위를
미끄러져 지나가요. 그게 이 기능의 핵심이에요. 타임라인 범위는 베이스라인 날짜까지 덮도록 넓어져요.
그래서 실제 막대 밖에 있는 베이스라인도 잘려 나가지 않아요.

마일스톤은 막대 대신 작게 회전한 정사각형을 받아요. 모양은 베이스라인의 날짜가 아니라 작업 자신의
`type`이 정해요. `baselineStart`만 가진 평범한 작업은 다이아몬드가 아니라 1픽셀 막대를 받아요.
마일스톤 규칙은 [작업 데이터](task-data.md)가 갖고 있어요.

`renderBaseline`은 기본 요소를 대체해요:

```tsx
import {
  ReactGanttChart,
  type Task,
  type TaskTransformed,
} from '@jaeungkim/gantt-chart';

export function Plan({ tasks, setTasks }: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      renderBaseline={(task: TaskTransformed) => (
        <div
          className="my-baseline"
          style={{ left: `${task.baselineLeft}px`, width: `${task.baselineWidth}px` }}
          title={`Planned: ${task.baselineStart} - ${task.baselineEnd}`}
        />
      )}
    />
  );
}
```

이 함수는 `baselineStart`를 가진 작업에만 호출돼요. 인자로는 `baselineLeft`와
`baselineWidth`가 이미 계산된 변환 작업을 받아요. 절대 위치 지정은 여전히 직접 해야 해요. 좌표 공간은
행이 제공하기 때문이에요. 기본 요소는 `aria-hidden="true"`지만 커스텀 요소는 그렇지 않아요. 필요한
라벨은 직접 붙여 주세요. 렌더러의 정확한 타입은 [Render prop 타입](ref/renderers.md)에 있어요.

## 예제로 따라가기

작업 네 개, 시각은 전부 UTC예요.

```ts
import type { Task } from '@jaeungkim/gantt-chart';

export const tasks: Task[] = [
  {
    id: 'a', name: 'Kickoff', parentId: null, sequence: '1',
    startDate: '2026-08-31T09:00:00Z', endDate: '2026-08-31T17:00:00Z',
  },
  {
    id: 'b', name: 'Content audit', parentId: null, sequence: '2',
    startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-04T17:00:00Z',
    dependencies: [{ targetId: 'a', type: 'FS' }],
  },
  {
    id: 'c', name: 'Visual design', parentId: null, sequence: '3',
    startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-02T17:00:00Z',
    dependencies: [{ targetId: 'a', type: 'FS' }],
  },
  {
    id: 'd', name: 'Build', parentId: null, sequence: '4',
    startDate: '2026-09-05T09:00:00Z', endDate: '2026-09-09T17:00:00Z',
    dependencies: [
      { targetId: 'b', type: 'FS' },
      { targetId: 'c', type: 'FS', lag: 1 },
    ],
  },
];
```

Content audit은 곧바로 Build로 넘어가요. 그래서 그 링크에는 빈틈이 없어요. Visual design은 하루 먼저
끝나고 그 링크에는 하루의 지연이 붙어 있어요. 그래서 Build는 그쪽으로 하루의 여유를 갖게 돼요.

**Content audit**을 사흘 뒤인 `09-04 09:00 - 09-07 17:00`로 끌어다 놓아 볼게요:

| `schedulingPolicy` | 그 뒤의 Build | 이유 |
|---|---|---|
| `"off"` | `09-05 09:00 - 09-09 17:00` | 그대로예요. 이제 선행 작업과 겹쳐요 |
| `"shift-on-overlap"` | `09-08 09:00 - 09-12 17:00` | 깨진 링크가 요구하는 사흘만큼 밀렸어요 |
| `"maintain-gap"` | `09-08 09:00 - 09-12 17:00` | 답이 같아요. 링크에 이미 빈틈이 없었기 때문이에요 |

이번엔 처음부터 다시 시작해서 **Content audit**을 이틀 앞인 `08-30 09:00 - 09-02 17:00`로 끌어 볼게요:

| `schedulingPolicy` | 그 뒤의 Build | 이유 |
|---|---|---|
| `"off"` | `09-05 09:00 - 09-09 17:00` | 그대로예요 |
| `"shift-on-overlap"` | `09-05 09:00 - 09-09 17:00` | 그대로예요. 깨진 게 없으니 당겨지지도 않아요 |
| `"maintain-gap"` | `09-04 09:00 - 09-08 17:00` | 이틀이 아니라 하루 당겨졌어요 |

이틀이 아니라 하루인 이유는 Build에 선행 작업이 둘이기 때문이에요. 하루가 지나면 Visual design에서
오는 지연 링크가 구속 조건이 되어 당김을 멈춰요. 두 드래그 어느 쪽에서도 Visual design 자체는 움직이지
않아요. 끌어당긴 막대의 아래쪽이 아니라서 엔진이 아예 보지 않아요.

`criticalPath`를 켜고 아무것도 끌지 않으면 Kickoff, Content audit, Build가 모두 `totalSlack: 0`을
보고하고 `critical` 클래스를 달아요. Visual design은 `totalSlack: 1`을 보고하고 회색으로 남아요.
`workingCalendar`를 켜면 토요일부터 수요일까지 이어지는 Build가 `4`가 아니라 `duration: 3`을
보고해요.

## 한계

엔진은 앞쪽으로만 전파해요. 선행 작업을 밀지 않고, 순환을 풀지 않고, 프로젝트 전체를 알아서 평준화하지도
않아요. 끌어당긴 막대에서 시작해 그 후행 작업을 따라 걸을 뿐이에요.

실행은 막대 드래그에서만 일어나요. 날짜나 링크를 바꾸는 나머지는 전부 직접 책임져야 해요. 작업을
가져오거나, 링크를 그리거나, 폼에서 날짜를 고친 뒤의 차트 날짜는 넣은 그대로예요. `scheduleTasks`가
바로 그런 경우를 위해 export돼 있고, 프로젝트 전체에 한 번에 돌릴 수 있어요.
[`scheduleTasks`](ref/core-scheduling.md)를 보세요.

검증은 없어요. `startDate`보다 이른 `endDate`, 파싱할 수 없는 날짜 문자열, 같은 쌍 사이의 의존성 두
개가 모두 그대로 통과해요. 오류 대신 잘못된 입력에 대한 산술 결과가 나와요.

여기 나오는 숫자는 전부 온전한 일수예요. `duration`과 두 여유 값은 한 날짜의 시작에서 다른 날짜의
시작까지로 재요. 그래서 같은 날짜에 시작하고 끝나는 작업은 몇 시간을 차지하든 `duration: 0`을
보고해요. 마일스톤도 `0`을 보고해요.

`criticalPath`는 일정을 다시 계산하지 않고, `schedulingPolicy`는 여유를 계산하지 않아요. 달력만 함께
쓸 뿐 서로 독립된 기능이에요. 임계 경로는 각 작업이 저장한 자기 날짜로 계산돼요. 그래서
[`hierarchy`](task-list.md)를 켜면 요약 행의 여유와 기간이 막대가 그려지는 구간과 어긋날 수 있어요.

베이스라인은 차트 입장에서 읽기 전용이에요. 차트는 `baselineStart` / `baselineEnd`를 그릴 뿐 그 이상은
하지 않아요. 계획을 스냅샷으로 남기고, 저장하고, 언제 다시 베이스라인을 잡을지 정하는 일은 모두 호스트
앱의 몫이에요.

이 페이지의 어떤 것에도 편집기는 없어요. 차트에서 `lag`를 바꿀 수 없고, 작업을 `manuallyScheduled`로
표시할 수 없고, 근무일 달력도 편집할 수 없어요. 셋 다 직접 넘기는 데이터예요.

다음: [행 재정렬](reordering.md) — 행을 옮기면 날짜가 아니라 작업 목록이 바뀌어요.
