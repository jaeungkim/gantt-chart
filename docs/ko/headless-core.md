한 주치 타임시트가 들어오면 야간 배치가 프로젝트를 다시 계획해요. 어떤 테스트는 작업 하나를 밀었을 때
세 개가 따라 움직이는지 검증해요. 어떤 API 엔드포인트는 누가 브라우저를 열기도 전에 종료일을 돌려줘요.
셋 다 React 트리도, 스타일시트도, DOM도 필요 없어요. 차트가 드롭할 때마다 돌리는 날짜 계산은 평범한
함수 묶음이고, 그 함수들은 밖으로 export돼 있어요.

## 코어는 React를 import하지 않고 DOM을 건드리지 않아요

`src/core/` 아래는 전부 데이터와 순수 함수예요. 런타임 의존성은 `dayjs`와 `utc` 플러그인뿐이에요. 이
디렉터리에서 `react`, `window`, `document`, `localStorage`, `navigator`, `requestAnimationFrame`을
grep하면 import도 전역도 하나도 안 나와요. 산문 주석 두 군데가 전부예요.

이 경계는 관례가 아니에요. `src/core/**/*.{ts,tsx}`에 걸린 eslint 블록이 `react`, `react-dom`,
`zustand`, `@tanstack/*`, 그리고 `components/`, `hooks/`, `pages/`, `stores/`, `constants/`,
`types/`, `utils/`, `assets/` 경로 그룹의 import를 막아요. 두 번째 규칙은 `window`, `document`,
`navigator`, `localStorage`, `sessionStorage`, `requestAnimationFrame` 전역을 금지해요. 규칙에
달린 메시지는 "src/core must stay free of React, the DOM and pixel math - keep render-side code in
src/utils or src/components"예요.

호스트 앱은 이 함수들을 패키지 루트에서 가져와요. 컴포넌트를 가져올 때와 같은 지정자예요.

```ts
import { scheduleTasks, computeCriticalPath, type Task } from '@jaeungkim/gantt-chart';
```

> [!IMPORTANT]
> `@jaeungkim/gantt-chart/core` 같은 서브패스는 없어요. `package.json`이 선언하는 건 `.`,
> `./style.css`, `./package.json` 셋뿐이에요. 번들 하나는 `src/index.tsx`에서 빌드되고, 거기에
> React 컴포넌트가 딸려 들어와요. `react`, `react-dom`, `react/jsx-runtime`은 빌드 시점에
> external로 표시돼요. 그래서 `scheduleTasks`만 import하는 Node 스크립트도 peer dependency
> (`react`와 `react-dom`, `^18.0.0 || ^19.0.0`)가 설치돼 있고 해석돼야 해요. 소스는 헤드리스예요.
> 배포되는 산출물은 파일 하나고요.

## 역할별 export 목록

코어에서 런타임 값 13개와 타입 10개가 나와요. 다섯 그룹으로 나뉘어요.

### 그래프 만들기

날짜가 아니라 프로젝트의 모양을 바꾸려 할 때 꺼내 쓰는 함수들이에요. `canLink`는 "이 새 의존성이
순환을 닫나"에 미리 답해 줘요. 폼이나 임포트 스크립트에 필요한 바로 그 검사예요. `buildTaskGraph`는
해석된 링크, 위상 정렬 순서, 정렬하지 못한 id를 돌려줘요. `findPath`는 두 작업 사이의 도달 가능성을
답해요. `linkKey`는 링크의 문자열 식별자를 만들어요. `criticalLinkIds`를 채우는 키와 같은 값이에요.

```ts
function buildTaskGraph(tasks: Task[]): TaskGraph;
function canLink(
  tasks: Task[],
  predecessorId: string,
  successorId: string
): { ok: boolean; cycle: string[] | null };
function findPath(tasks: Task[], fromId: string, toId: string): string[] | null;
function linkKey(link: SchedulingLink): string;
```

`canLink`가 막는 건 자기 자신으로의 링크와 순환뿐이에요. 같은 쌍에 똑같은 링크를 하나 더 걸어도
통과하고, 타입만 다른 두 번째 링크도 통과해요. 차트의 링크 드래그가 쓰는 중복 검사는 렌더 레이어에
있고 export되지 않아요. 전체 형태와 `TaskGraph.cycle`의 정확한 내용은
[작업 그래프 헬퍼](ref/core-graph.md)에 있어요. 링크 타입 네 가지의 뜻은 [의존성](dependencies.md)에
있고요.

### 트리 순회하기

`buildTaskTree`와 `collectSubtreeIds`는 `parentId`만 읽어요. `rollUpTasks`는 자식의 날짜와 `type`,
`progress`까지 읽고요. 부모와 자식, 깊이를 한 번에 정규화하고 싶으면 `buildTaskTree`를 쓰세요. 한 행
아래 전부를 포함해야 하는 일괄 작업에는 `collectSubtreeIds`를 쓰고요. 차트가 그리는 요약 행 날짜를
리포트에도 그대로 써야 하면 `rollUpTasks`예요. 셋 다 순수 함수라, 서버도 브라우저가 보여 줄 구간을
그대로 만들어 낼 수 있어요.

```ts
type TaskNode = Pick<Task, 'id' | 'parentId'>;

function buildTaskTree(tasks: TaskNode[]): TaskTree;
function collectSubtreeIds(tasks: TaskNode[], rootId: string, tree?: TaskTree): string[];
function rollUpTasks(tasks: Task[], tree?: TaskTree): Task[];
```

`TaskNode`는 구조적 타입이고 그 자체로는 export되지 않아요. 위의 `Pick`을 직접 쓰거나 진짜 `Task`
객체를 넘기세요. 뒤의 두 함수에 있는 선택 인자 `tree`는 기본값이 새 `buildTaskTree(tasks)`예요.
반복문 안에서는 호출마다 다시 만들지 말고 미리 만든 트리를 넘기세요. 요약 행이 무엇을 덮어쓰는지는
[작업 목록과 계층](task-list.md)에, 전체 시그니처는 [트리 헬퍼](ref/core-tree.md)에 있어요.

### 일정 잡기

`scheduleTasks`는 차트가 드롭할 때 실행하는 함수예요. 끌어 놓은 막대 하나든 프로젝트 전체든 똑같이
받아요. 임포트 직후에, 폼 편집 직후에, 또는 밤사이 계획을 평준화하는 배치에서 돌리세요. 후행
작업(successor)이 옮겨진 새 배열과, 옮긴 id, 정렬하지 못한 id를 돌려줘요.

```ts
function scheduleTasks(tasks: Task[], options?: ScheduleOptions): ScheduleResult;
```

헤드리스로 부른다면 두 가지가 중요해요. `policy` 옵션의 기본값은 `'off'`이고, 이때는 그래프를 만들기
전에 반환해요. 아무것도 움직이지 않고, 순환이 있는 데이터에서도 `ScheduleResult.cycle`은 `null`로
돌아오고, `onCycle`은 한 번도 호출되지 않아요. 그리고 아무것도 움직이지 않았다면
`ScheduleResult.tasks`는 넘긴 것과 **같은 배열 인스턴스**예요. `===`로 비교해서 쓰기를 건너뛰세요.
정책 자체는 [스케줄링](scheduling.md)에서 설명하고, 옵션과 반환 필드는 하나도 빠짐없이
[scheduleTasks](ref/core-scheduling.md)에 정리돼 있어요.

### 임계 경로 계산하기

`computeCriticalPath`는 두 패스를 모두 돌려서 여유(slack), 이른 날짜와 늦은 날짜, 기간, 그리고 임계
경로(critical path)에 놓인 작업과 링크 집합을 돌려줘요. 상태 리포트나 "어느 작업이 밀리면 문제인가" 같은
질문에는 이것으로 답이 다 나와요. 가장 이른 날짜만 필요하거나 프로젝트 종료일을 직접 주고 싶을 때를
위해 `forwardPass`와 `backwardPass`도 따로 export돼 있어요.

```ts
function computeCriticalPath(
  tasks: Task[],
  options?: { calendar?: WorkingCalendar }
): CriticalPathResult;

function forwardPass(
  tasks: Task[],
  calendar?: WorkingCalendar,
  graph?: TaskGraph
): Map<string, EarlyDates>;

function backwardPass(
  tasks: Task[],
  early: Map<string, EarlyDates>,
  calendar?: WorkingCalendar,
  graph?: TaskGraph,
  projectFinish?: Dayjs
): Map<string, LateDates>;
```

`EarlyDates`와 `LateDates`는 패키지에서 export되지 않아요. 그래서 `backwardPass`의 두 번째 인자에는
타입 이름을 직접 붙일 수 없어요. 대신 구조적으로 이름을 붙이세요.

```ts
import { forwardPass, backwardPass } from '@jaeungkim/gantt-chart';

type Early = ReturnType<typeof forwardPass>;

const early: Early = forwardPass(tasks);
const late = backwardPass(tasks, early);
```

여유의 정의와, 진행률 100%인 작업은 절대 임계 경로에 오르지 않는다는 규칙은
[스케줄링](scheduling.md)이 다뤄요. 필드별 타입은 [임계 경로](ref/core-critical-path.md)에 있어요.

### 캘린더 만들기

`scheduleTasks`, `computeCriticalPath`, `forwardPass`, `backwardPass`는 `WorkingCalendar`를 거쳐
날짜를 세요. 그래프와 트리 헬퍼는 캘린더를 받지 않고요. 기본값인 `CALENDAR_DAYS`는 이레를 모두 세기
때문에, 그대로 두면 평범한 달력 계산이 돼요. `createWorkingCalendar`는 주말과 공휴일을 건너뛰는
캘린더를 만들어요. 지연(lag) 2가 근무일 이틀을 뜻하게 되는 건 이 덕분이에요.

```ts
const CALENDAR_DAYS: WorkingCalendar;
function createWorkingCalendar(options?: WorkingCalendarOptions): WorkingCalendar;
```

반환되는 객체는 공개 API예요. `isWorkingDay`, `addDays`, `daysBetween`, `daysUntil`, `daysUpTo`,
`snapForward`와 `skipsNonWorkingDays` 플래그를 각각 따로 호출할 수 있어요. 호스트 앱이 자체 날짜
계산에 필요한 건 대개 이게 전부예요. 캘린더가 무엇을 바꾸고 무엇을 그대로 두는지는
[스케줄링](scheduling.md)에서 다뤄요. 옵션과 우선순위는 [근무일 달력](ref/core-calendar.md)에 있고요.

## 전체 스크립트

작업 다섯 개를 넣는데, 그중 둘은 링크가 허용하는 것보다 이른 자리에 앉아 있어요. 스크립트는 프로젝트 일정을
평준화하고, 임계 경로를 계산하고, 날짜와 여유를 출력해요.

```ts
// replan.ts
import {
  computeCriticalPath,
  scheduleTasks,
  type Task,
} from '@jaeungkim/gantt-chart';

const tasks: Task[] = [
  {
    id: 'A',
    name: 'Survey',
    startDate: '2025-06-02',
    endDate: '2025-06-05',
    parentId: null,
    sequence: '1',
  },
  {
    id: 'B',
    name: 'Frame',
    startDate: '2025-06-05',
    endDate: '2025-06-10',
    parentId: null,
    sequence: '2',
    dependencies: [{ targetId: 'A', type: 'FS' }],
  },
  {
    id: 'C',
    name: 'Wiring',
    startDate: '2025-06-05',
    endDate: '2025-06-07',
    parentId: null,
    sequence: '3',
    dependencies: [{ targetId: 'A', type: 'FS' }],
  },
  {
    id: 'D',
    name: 'Cladding',
    startDate: '2025-06-08',
    endDate: '2025-06-11',
    parentId: null,
    sequence: '4',
    dependencies: [
      { targetId: 'B', type: 'FS' },
      { targetId: 'C', type: 'FS' },
    ],
  },
  {
    id: 'E',
    name: 'Handover',
    startDate: '2025-06-11',
    endDate: '2025-06-14',
    parentId: null,
    sequence: '5',
    dependencies: [{ targetId: 'D', type: 'FS' }],
  },
];

const { tasks: scheduled, movedIds, cycle } = scheduleTasks(tasks, {
  policy: 'maintain-gap',
});

if (cycle) {
  throw new Error(`could not order: ${cycle.join(', ')}`);
}

const { metrics, criticalTaskIds, projectFinish } =
  computeCriticalPath(scheduled);

console.log('moved:', movedIds.join(', '));
console.log('project finish:', projectFinish);

for (const task of scheduled) {
  const slack = metrics.get(task.id)?.totalSlack;
  console.log(
    [
      task.id,
      task.startDate.slice(0, 10),
      task.endDate.slice(0, 10),
      `slack ${slack ?? '-'}`,
      criticalTaskIds.has(task.id) ? 'critical' : '',
    ].join('  ')
  );
}
```

출력은 이래요.

```text
moved: D, E
project finish: 2025-06-16T00:00:00.000Z
A  2025-06-02  2025-06-05  slack 0  critical
B  2025-06-05  2025-06-10  slack 0  critical
C  2025-06-05  2025-06-07  slack 3  
D  2025-06-10  2025-06-13  slack 0  critical
E  2025-06-13  2025-06-16  slack 0  critical
```

`D`는 `B` 링크에 밀려 이틀 늦어졌고, `E`는 같은 패스에서 뒤따라갔어요. `C`는 후행 작업에 필요한 시점보다
사흘 먼저 끝나요. 그래서 여유 사흘을 안고 임계 경로에서는 빠져요. 반복문의 `.slice(0, 10)`은
빈말이 아니라 실제로 일을 해요. `A`, `B`, `C`는 한 번도 움직이지 않아서 넘긴 객체 그대로고 짧은
문자열을 그대로 갖고 있어요. 반면 `D`와 `E`는 다시 쓰여서 완전한 ISO 문자열로 돌아와요.

## 코어가 하지 않는 일

**렌더링하지 않아요.** 막대 좌표도, 화살표 경로도, 눈금도, 음영도, 색도 없어요. 막대 위치는 렌더
레이어가 원본 날짜에서 계산하고, 그 코드는 여기에 하나도 없어요.

**저장도 메모이제이션도 하지 않아요.** `scheduleTasks`와 `computeCriticalPath`는 호출할 때마다
그래프를 처음부터 다시 만들고, `findPath`도 호출마다 다시 만들어요. 그래서 `findPath`를 부르는
`canLink`는 후보 링크 하나당 그래프를 통째로 짓고, 임포트를 한 행씩 검증하면 제곱이 돼요. 캐싱은
호스트 앱의 몫이에요.

**포맷하지 않아요.** 로케일도 없고 `Intl`도 없어요. 날짜는 문자열로 들어가서 문자열로 나와요. 읽는
사람이 보는 건 전부 차트가 만들거나 호스트 앱이 직접 만들어요. [로케일과 날짜 형식](i18n.md)을
보세요.

**검증하지 않아요.** `startDate`보다 앞선 `endDate`, 파싱되지 않는 날짜 문자열, 같은 쌍에 걸린 똑같은
링크 두 개. 어느 것도 검사하거나 거부하지 않아요. 델타가 유한하지 않게 나오는 링크는 조용히
건너뛰어요. 그래서 읽을 수 없는 날짜를 가진 작업은 움직이지도, 오류를 내지도 않아요. 넘기기 전에
데이터를 확인하세요. 음수 `lag`은 잘못된 입력이 아니에요. 리드(lead)이고, 엔진이 그대로 적용해요.

**순환을 풀어 주지 않아요.** 찾아내고, 알려 주고, 나머지를 그 주변에 배치할 뿐이에요.
`ScheduleResult.cycle`과 `CriticalPathResult.cycle`은 위상 정렬을 하지 못한 id를 전부 나열해요.
여기에는 순환의 하류에 있을 뿐인 작업도 들어가고, 그런 작업은 임계 경로 지표를 아예 받지 못해요.

**링크 두 개가 키 하나에서 겹칠 수 있어요.** `linkKey`는 id 둘과 타입으로 만들어지고 `lag`은
무시해요. 그래서 중복된 의존성은 `criticalLinkIds`에 두 개가 아니라 하나로 들어가요.

**캘린더가 망가져도 실패하는 대신 슬그머니 어긋나요.** 모든 날을 비근무일로 표시하는
`isNonWorkingDay` 술어를 주면, `addDays`는 평범한 달력 날짜로 되돌아가고 `snapForward`는 입력을
그대로 돌려줘요. 숫자는 틀리게 나오지만 아무것도 던지지 않아요.

**일부 헬퍼는 내부용이에요.** `getVisibleTasks`, `linkDelta`, `shiftTask`, `taskStart`, `taskEnd`,
`isMilestoneTask`, `normalizeProgress`와 UTC `dayjs` 인스턴스는 `src/core`에 있지만 패키지 밖으로
다시 export되지 않아요. `EarlyDates`, `LateDates`, `CriticalPathOptions` 타입도 마찬가지예요.
이것들을 import하는 걸 전제로 설계하지 마세요.

**모든 날짜는 UTC예요.** 코어는 `dayjs.utc`로 파싱해요. 그래서 타임존이 없는 문자열(`'2025-06-02'`,
`'2025-06-02T09:00'`)은 서버의 로컬 시간이 아니라 UTC 벽시계예요. Asia/Seoul에서
오프셋 없이 로컬 타임스탬프를 쓰는 프로세스는 의도한 자리에서 아홉 시간 어긋나게 일정을 잡아요.
`holidays` 항목이 UTC `YYYY-MM-DD`와 대조되는 것도 같은 이유예요. 엔진이 옮긴 작업은
`toISOString()` 문자열로 돌아와요. 옮기지 않은 작업은 넘긴 문자열 그대로, 손대지 않고 돌려줘요.
날짜 계약 전체는 [작업 데이터](task-data.md)에 있어요.

다음: [scheduleTasks](ref/core-scheduling.md). 스케줄링 진입점의 옵션과 반환 필드가 하나도 빠짐없이
정리돼 있어요.
