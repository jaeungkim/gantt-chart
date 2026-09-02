작업 하나가 엉뚱한 단계 아래에 들어갔어요. 대부분의 차트에서는 다른 화면의 폼에서 `parentId`를 고치는 게
유일한 해결책이에요. 모든 앱이 이 기능을 손으로 다시 만들었어요. 이제는 작업 목록의 행을 집어서 놓을 수
있어요. 형제 사이에서 옮기고, 한 단계 안으로 밀어 넣고, 한 단계 밖으로 빼내고, 다른 행 위에 놓아 그 행의
자식으로 만들어요. 차트는 `parentId`와 영향받은 모든 `sequence`를 다시 써요. 그리고 저장할 배열 하나를
호스트 앱에 넘겨요.

## 켜기

행 드래그는 `allowRowReorder`를 설정하기 전까지 꺼져 있어요. 이 기능은 작업 목록 패널 안에서만 동작해요.
그 패널은 기본으로 꺼져 있어서 `showTaskList`(또는 `columns` 배열)도 함께 켜야 해요. 패널 자체는
[작업 목록과 계층](task-list.md)에서 다뤄요.

```tsx
// src/ProjectGantt.tsx
import { useState } from 'react';
import { ReactGanttChart, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const initial: Task[] = [
  { id: 'root', name: 'Release 1', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: null, sequence: '1' },
  { id: 'a', name: 'Design', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-13T00:00:00Z', parentId: 'root', sequence: '1.1' },
  { id: 'a1', name: 'Wireframes', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-06T00:00:00Z', parentId: 'a', sequence: '1.1.1' },
  { id: 'a2', name: 'Visual design', startDate: '2026-03-09T00:00:00Z', endDate: '2026-03-13T00:00:00Z', parentId: 'a', sequence: '1.1.2' },
  { id: 'b', name: 'Build', startDate: '2026-03-16T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: 'root', sequence: '1.2' },
  { id: 'other', name: 'Launch prep', startDate: '2026-03-23T00:00:00Z', endDate: '2026-03-27T00:00:00Z', parentId: null, sequence: '2' },
];

export function ProjectGantt() {
  const [tasks, setTasks] = useState<Task[]>(initial);
  return (
    <ReactGanttChart
      tasks={tasks}
      onTasksChange={setTasks}
      showTaskList
      hierarchy
      allowRowReorder
    />
  );
}
```

행은 막대 이동이 허용되는 곳에서만 드래그할 수 있어요. 차트는 막대 드래그 직전과 똑같은 권한
체인을 실행해서 `canMove`를 가져와요. 그래서 차트의 `readOnly`나 작업의 `allowMove: false`는 막대 드래그와
함께 행의 grab 커서도 없애요. 체인 자체는 [작업 편집](editing.md)과
[GanttInteractionConfig](ref/interaction-config.md)에 정리돼 있어요.

`hierarchy`는 필수가 아니에요. 어느 쪽이든 드롭은 `parentId`를 써요. 다만 `hierarchy`가 없으면 요약 행도
없고 접히는 것도 없어요.

## 제스처

행을 누르는 동작은 포인터가 어느 방향으로든 3px 움직이기 전까지는 아직 클릭이에요. 그 뒤부터는 행이 흐려지고
표시선이 포인터를 따라와요.

세로 이동이 대상 행을 정해요. 포인터가 그 행의 어디에 있는지가 옆에 끼워 넣을지 안에 넣을지를 결정해요. 행
높이는 38px이고, 행의 위아래 30%는 삽입 영역이에요.

| 행 안에서의 포인터 위치 | 행 위쪽 끝에서의 픽셀 | 결과 |
|---|---|---|
| 위 30% | 0 – 11.4 | 이 행 **위에** 삽입선 |
| 가운데 40% | 11.4 – 26.6 | 이 행 **안으로 드롭**, 이 행이 부모가 돼요 |
| 아래 30% | 26.6 – 38 | 이 행 **아래에** 삽입선 |

대상 행 인덱스는 목록 범위로 잘려요. 그래서 첫 행보다 위로 끌면 그 위의 선으로 정해지고, 마지막 행보다 한참
아래로 끌면 그 아래의 선으로 정해져요.

### 들여쓰기와 내어쓰기

누른 뒤의 가로 이동량이 삽입선이 놓일 단계를 정해요. 한 단계는 `TREE_INDENT`, 즉 16px이에요. 이동량은 가장
가까운 단계로 반올림되니까 **한 단계의 임계값은 8px**이에요. 두 방향은 대칭이 아니에요. `+8px`이면 이미 한
단계 들어가지만, 내어쓰기는 왼쪽으로 8px보다 엄격히 더 움직여야 해요. JavaScript가 0.5를 올림하고
`Math.round(-0.5)`가 `-0`이기 때문이에요.

이렇게 나온 깊이는 다시 두 가지 아웃라이너 규칙으로 잘려요.

- 행이 놓일 수 있는 가장 깊은 위치는 삽입선 바로 위 행보다 한 단계 아래예요.
- 삽입선 아래 행보다 얕게는 놓일 수 없어요. 그렇게 되면 아래 행이 자식이 돼 버리니까요.

두 제한 모두 예외가 없어요. 들여쓰기 폭의 열 배만큼 오른쪽으로 끌어도 위 행보다 한 단계 아래에서 멈춰요.

깊이가 정해지면 새 부모는 삽입선 위 행의 조상 중 한 단계 위에 있는 행이 돼요. 깊이가 0이거나 선 위에 행이
아예 없으면 루트 단계예요. 새 형제 사이의 위치는 선 위에 보이는 가장 가까운 형제에서 가져와요. 그런 형제가
없으면 행은 맨 앞에 놓여요. 이 계산에서 드래그 중인 행은 자기 형제 목록에서 빠져요. 곧 지금 자리를 떠날
참이니까요.

### 행 위에 놓기

가운데 영역에 놓으면 그 행이 부모가 되고, 드래그한 행은 자식 중 **마지막**에 붙어요. 자식 개수는 화면이 아니라
실제 트리에서 세요. 그래서 접힌 부모 위에 놓으면 숨겨진 자식들 앞이 아니라 뒤에 붙어요.

### 잘못된 드롭

자기 서브트리 안으로 행을 넣는 드롭은 거부돼요. 막히는 대상은 드래그한 행과 그 모든 자손이에요. 그래서 행을
자기 자신 위에 놓는 것도 거부돼요. 가운데 영역에서 거부되면 대상 행의 색이 바뀌고 `no-drop` 커서가 붙어요.
거부된 삽입선은 색만 바뀌고 커서는 `grabbing` 그대로예요. 거기서 손을 떼도 아무 일도 일어나지 않아요. 커밋도
없고, `onTasksChange`도 없고, `onReorder`도 호출되지 않아요.

아무것도 커밋하지 않고 제스처가 끝나는 경우가 두 가지 더 있어요. `pointercancel`은 드래그를 되돌려요.
브라우저가 제스처를 스크롤로 가져가거나 두 번째 손가락이 닿을 때예요. 그리고 3px 임계값을 넘지 못한 드래그는
클릭으로 남아요.

## 무엇이 커밋되나요

손을 떼면 차트가 현재 작업 배열을 다시 읽고, 이동을 적용하고, 트리를 다시 써요. 결과가 시작할 때의 배열과
같으면, 즉 행이 원래 있던 자리에 놓였으면 아무 일도 일어나지 않아요.

그렇지 않으면 `onReorder`가 `GanttReorderChange`와 함께 호출돼요.

| 필드 | 타입 | 담고 있는 값 |
|---|---|---|
| `task` | `Task` | 이동한 작업이에요. 새 `parentId`와 `sequence`를 이미 갖고 있어요 |
| `parentId` | `string \| null` | 새 부모예요. `null`은 루트 단계예요 |
| `previousParentId` | `string \| null` | 들어온 데이터에서 작업이 갖고 있던 부모예요. 정규화를 거치지 않은 값이에요 |
| `index` | `number` | 새 부모의 자식 사이에서 0부터 세는 위치예요 |
| `sequence` | `string` | 이동한 작업의 새 점 표기 sequence예요 |
| `tasks` | `Task[]` | 갱신된 배열 전체예요. `onTasksChange`가 받는 것과 같은 배열이에요 |

전체 타입은 [GanttReorderChange](ref/changes.md)에 있어요.

`previousParentId`는 정규화된 트리가 아니라 드래그 전 데이터에서 읽어요. 그래서 존재하지 않는 작업을 가리키던
`parentId`도 저장된 모습 그대로 여기에 나와요.

핸들러가 취소하지 않으면 차트는 한 번 커밋하고 `onTasksChange`를 한 번 호출해요. `change.tasks`가 담고 있던
것과 같은 배열 객체를 넘겨요. 그래서 몇 개의 행에 번호를 다시 매겼든 재정렬 하나는 실행 취소 한 단계예요.
실행 취소와 다시 실행은 [명령형 API](imperative-api.md)에서 다뤄요.

### sequence를 다시 쓰는 방식

행 순서는 점 표기 `sequence`에서 나오고 중첩은 `parentId`에서 나와요. 두 필드는 서로 독립적이에요.
`sequence` 자체는 [작업 데이터](task-data.md)에 설명돼 있어요. `parentId`만 바꾼 드롭은 다음 정렬에서 원래
자리로 되돌아가요. 그래서 차트는 결과 트리를 기준으로 배열 전체의 `sequence`를 다시 매겨요. 형제 사이의
위치에 부모의 sequence를 앞에 붙이는 방식이에요. `1`, `1.1`, `1.2`, `2` 같은 모양이에요.

위 예제의 작업 여섯 개를 놓고 `a1`을 `Design` 밖으로 끌어내 루트 단계로 옮겨 볼게요. `Launch prep` 바로 위
선에 놓는 거예요. 그러면 `parentId: null`, `index: 1`이 돼요.

이전:

| id | `parentId` | `sequence` |
|---|---|---|
| `root` | `null` | `1` |
| `a` | `root` | `1.1` |
| `a1` | `a` | `1.1.1` |
| `a2` | `a` | `1.1.2` |
| `b` | `root` | `1.2` |
| `other` | `null` | `2` |

이후:

| id | `parentId` | `sequence` |
|---|---|---|
| `root` | `null` | `1` |
| `a` | `root` | `1.1` |
| `a2` | `a` | `1.1.1` |
| `b` | `root` | `1.2` |
| `a1` | `null` | `2` |
| `other` | `null` | `3` |

세 행의 `sequence`가 새로 바뀌었는데 드래그한 건 하나뿐이에요. `a2`는 `a1`이 비운 자리로 올라왔어요. 그리고
`other`는 앞에 들어온 행 때문에 아래로 밀렸어요.

배열의 나머지를 어긋나지 않게 지키는 규칙이 두 가지 있어요. `parentId`는 이동한 작업에**만** 써요. 그래서
다른 행은 원래의 연결을 그대로 유지해요. 그리고 `parentId`와 `sequence`가 바뀌지 않은 행은 객체 동일성을
유지해요. 그래서 아래쪽의 `React.memo`는 그 행들을 변경되지 않은 것으로 계속 봐요.

없는 작업을 가리키는 `parentId`나 조상 순환은 절대 고쳐 주지 않아요. 행은 그 연결을 그대로 두고, 차트가 이미
그리고 있는 대로 루트에 맞춰 번호가 매겨져요.

> [!WARNING]
> `onReorder`에서 `false`를 반환하면 드롭이 취소돼요. 차트에는 아무것도 쓰이지 않고, 실행 취소 단계도 남지
> 않고, `onTasksChange`도 발생하지 않아요. 반환값은 동기적으로 읽어요. `async onReorder`는 `Promise`를
> 반환해요. `Promise`는 절대 `=== false`가 아니라서, 핸들러가 완료되기 전에 재정렬이 커밋돼요. 거부는 이미
> 갖고 있는 데이터만으로 판단할 수 있어야 해요.

## onReorder를 서버에 연결하기

거부가 동기라서 서버 호출로는 드롭을 막을 수 없어요. 쓸 만한 형태는 낙관적 방식이에요. 로컬에서 판단할 수
있는 것은 로컬에서 거부하고, 나머지는 통과시키고, 쓰기가 실패하면 되돌려요. `onReorder`는 커밋 전에 실행되니까
그 안에서 잡아 둔 상태는 아직 이동 전 배열이에요.

```tsx
// src/ProjectGantt.tsx
import { useState } from 'react';
import {
  ReactGanttChart,
  type GanttReorderChange,
  type Task,
} from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

/** 백엔드가 새 자식을 받아 주지 않는 단계들이에요. */
const FROZEN_PARENTS = new Set(['released']);

export function ProjectGantt({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [error, setError] = useState<string | null>(null);

  // useCallback으로 감싸지 않았어요. 되돌리려면 현재 `tasks`를 읽어야 하니까요.
  function handleReorder(change: GanttReorderChange): boolean | void {
    if (change.parentId !== null && FROZEN_PARENTS.has(change.parentId)) {
      setError('That phase is released and cannot take new children.');
      return false;
    }

    const rollback = tasks;
    setError(null);

    // 이동 뒤에는 모든 행이 새 sequence를 가지므로 배열 전체를 보내요.
    fetch('/api/tasks/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movedId: change.task.id,
        parentId: change.parentId,
        index: change.index,
        order: change.tasks.map((task) => ({
          id: task.id,
          parentId: task.parentId,
          sequence: task.sequence,
        })),
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
      })
      .catch(() => {
        setTasks(rollback);
        setError('Could not save the new order.');
      });
  }

  return (
    <>
      {error !== null && <p role="alert">{error}</p>}
      <ReactGanttChart
        tasks={tasks}
        onTasksChange={setTasks}
        showTaskList
        hierarchy
        allowRowReorder
        onReorder={handleReorder}
      />
    </>
  );
}
```

`change.task`만 저장하면 이동이 사라져요. 새 순서를 담고 있는 건 그 주변에서 번호가 다시 매겨진 행들이에요.
그래서 데이터베이스까지 가야 하는 것은 `change.tasks`의 배열이에요.

## 재정렬이 스스로 꺼지는 경우

아무 경고도 없고, 어떤 행에도 grab 커서가 나타나지 않아요. 아래 조건은 각각 단독으로 드래그를 꺼요.

| 조건 | 범위 |
|---|---|
| `allowRowReorder`가 기본값 `false` 그대로예요 | 차트 전체 |
| 작업 목록 패널이 렌더링되지 않아요. `showTaskList`도 `columns`도 넘기지 않았거나 `showTaskList={false}`예요 | 차트 전체 |
| 툴바 토글로 패널을 접었어요 | 다시 열 때까지 |
| `groupBy`가 설정돼 행 목록에 그룹 헤더가 섞여요 | 차트 전체 |
| 두 작업이 시간이 겹치지 않은 채 `lane`을 공유해 한 행에 묶여요 | 차트 전체 |
| 작업의 최종 `canMove`가 false예요. `readOnly`이거나 `allowMove: false`인 경우예요 | 그 행 |
| 접기 토글 같은 `<button>` 위를 눌렀어요 | 그 누름 |
| 주 포인터의 왼쪽 버튼이 아니에요 | 그 누름 |

`groupBy`와 `lane`이 뜻밖의 경우예요. 검사는 **전체** 행 목록을 대상으로 해요. 그래서 그룹 헤더 하나나 묶인
lane 행 하나만 있어도 해당 행뿐 아니라 차트의 모든 행에서 행 드래그가 꺼져요. 행 id는 모든 행이 정확히 작업
하나일 때만 작업 id예요. 그리고 재정렬에는 움직일 작업 하나가 필요해요. 두 기능 모두
[그룹과 스윔레인](grouping.md)에 설명돼 있어요.

접힌 서브트리 안의 행은 아예 렌더링되지 않아서 누를 행이 없어요. 부모를 먼저 펼쳐야 해요.

## 한계

- **재정렬은 날짜를 절대 건드리지 않아요.** `parentId`와 `sequence`만 써요. 요약 행의 날짜와 진행률은
  자식에서 파생되니까, 부모를 바꾸면 무엇이 어디로 집계되는지가 달라져요.
  [작업 목록과 계층](task-list.md)을 보세요.
- **키보드로 하는 방법은 없어요.** 이동, 크기 조절, 진행률에는 모두 있지만 재정렬에는 없어요. 키 맵은
  [키보드와 스크린 리더](accessibility.md)에 있어요.
- **행 재정렬은 `onBeforeTaskChange`를 거치지 않아요.** 그 관문은 이동, 크기 조절, 진행률만 다루고, 여기서는
  `onReorder`가 유일한 훅이에요. [이벤트와 취소 가능한 변경](events.md)을 보세요.
- **드래그는 패널을 스크롤하지 않아요.** 뷰포트 가장자리에서 자동 스크롤이 없어요. 그래서 드래그를 시작하기
  전에 대상 행을 화면 안으로 스크롤해 둬야 해요.
- **터치는 믿기 어려워요.** 그리드 행에는 `touch-action`이 설정돼 있지 않아요. 그래서 세로 스와이프를
  브라우저가 스크롤로 가져갈 수 있고, 그러면 `pointercancel`이 발생해 드래그가 되돌아가요.
- **시작한 행에서 손을 떼면 그 행의 클릭이 그대로 발생해요.** 막대는 드래그를 끝내는 클릭을 삼키지만 그리드
  행은 삼키지 않아요. 그래서 들여쓰기나 내어쓰기만 해도 선택이 함께 움직여요. (다른 행 위에서 손을 떼면
  클릭은 행 컨테이너에서 발생하고, 행 핸들러는 실행되지 않아요.) `onTaskClick`과 `onTaskSelect`는
  [이벤트와 취소 가능한 변경](events.md)에 있어요.
- **한 번에 한 행이에요.** 다중 선택 드래그는 없어요. 드래그한 행은 언제나 서브트리 전체를 데려가고, 여러
  작업이 함께 움직이는 건 그것뿐이에요.
- **트리는 `pointerdown` 시점에 스냅샷으로 잡혀요.** 드래그 도중에 `tasks` prop을 바꿔도 드롭은 누르기
  시작할 때의 트리를 기준으로 결정돼요.
- **막대는 행 사이로 드래그할 수 없어요.** 세로 막대 드래그는 존재하지 않아요. 타임라인 패널은 막대를 시간
  축에서만 옮겨요. [작업 편집](editing.md)에 나와 있어요.
- **저장은 호스트 앱의 몫이에요.** 차트는 자기 순서를 따로 갖고 있지 않아요. `onTasksChange`가 배열을
  넘겨주고, 그 배열이 `tasks` prop으로 돌아오기를 기대해요.
- **깨진 부모 연결도 호스트 앱의 몫이에요.** 고아이거나 순환하는 `parentId`는 재정렬을 거쳐도 그대로
  보존되고, 고쳐지지도 보고되지도 않아요.
- **첫 드래그가 아무도 끌지 않은 행을 옮길 수 있어요.** 들어온 `sequence`와 `parentId`가 서로 어긋나 있었다면
  번호를 다시 매기면서 트리를 기준으로 정리해요. 그래서 상관없던 행들이 `parentId`가 처음부터 가리키던
  자리로 붙어요.

다음: [이벤트와 취소 가능한 변경](events.md)에서 차트의 나머지 부분이 발생시키는 콜백과, 쓰기가 반영되기 전에
막을 수 있는 유일한 관문을 다뤄요.
