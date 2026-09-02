`GanttHandle`은 차트에 건 `ref`가 받는 객체예요. 스크롤, 줌, 내보내기, 실행 취소/다시 실행 메서드를
담고 있고, `GanttScrollApi`, `GanttExportApi`, `GanttHistoryApi` 세 인터페이스를 합쳐서 만들어요.
이 페이지의 네 타입은 모두 패키지의 타입 전용 export예요.

```ts
import type {
  GanttHandle,
  GanttScrollApi,
  GanttScrollOptions,
  GanttZoomAnchor,
} from '@jaeungkim/gantt-chart';
```

## `GanttHandle`

```ts
/** ref로 노출되는 명령형 API */
export interface GanttHandle
  extends GanttScrollApi,
    GanttExportApi,
    GanttHistoryApi {}
```

자체 멤버는 하나도 선언하지 않아요. `GanttExportApi`는 [내보내기](export.md)에,
`GanttHistoryApi`는 [히스토리](history.md)에 정리돼 있어요.

### 멤버

| 멤버 | 시그니처 | 동작 |
|---|---|---|
| `scrollToDate` | `(date: string \| Date \| Dayjs, options?: GanttScrollOptions) => void` | 요청한 위치에 그 날짜가 오도록 가로로 스크롤해요. 날짜가 렌더링된 타임라인 밖이면 아무 일도 일어나지 않아요. |
| `scrollToToday` | `(options?: GanttScrollOptions) => void` | 현재 시각으로 호출하는 `scrollToDate`예요. |
| `scrollToTask` | `(taskId: string, options?: GanttScrollOptions) => void` | 작업의 막대로 가로 스크롤하고, 그 행이 화면 밖일 때만 세로로도 움직여요. 렌더링된 행에 없는 id면 아무 일도 일어나지 않아요. |
| `zoomToFit` | `() => void` | 프로젝트 전체가 타임라인 너비에 들어가는 가장 촘촘한 배율로 바꾸고, 가장 이른 작업 날짜를 왼쪽 가장자리에 고정해요. |
| `getScrollElement` | `() => HTMLDivElement \| null` | 차트의 스크롤 컨테이너 엘리먼트를 반환해요. 차트가 마운트되지 않았으면 `null`이에요. |
| `exportToPng` | `(options?: GanttExportOptions) => Promise<Blob>` | 차트를 래스터화해서 PNG blob으로 resolve해요. 다운로드는 일으키지 않아요. [내보내기](export.md)를 보세요. |
| `undo` | `() => void` | 가장 최근에 커밋된 제스처를 되돌리고 `onTasksChange`를 발생시켜요. [히스토리](history.md)를 보세요. |
| `redo` | `() => void` | 가장 최근에 취소된 제스처를 다시 실행하고 `onTasksChange`를 발생시켜요. [히스토리](history.md)를 보세요. |
| `canUndo` | `boolean` | 실행 취소할 제스처가 있는지 여부예요. getter로 읽으니 접근할 때마다 최신 값이에요. |
| `canRedo` | `boolean` | 다시 실행할 취소된 제스처가 있는지 여부예요. getter로 읽으니 접근할 때마다 최신 값이에요. |

`undo`와 `redo`는 `void`를 반환해요. 결과 작업 배열은 반환값이 아니라 `onTasksChange`로 전달돼요.

## `GanttScrollApi`

```ts
/** 명령형 스크롤·줌 API */
export interface GanttScrollApi {
  /** 지정한 날짜로 가로 스크롤 */
  scrollToDate: (date: string | Date | Dayjs, options?: GanttScrollOptions) => void;
  /** 오늘로 가로 스크롤 */
  scrollToToday: (options?: GanttScrollOptions) => void;
  /** 지정한 작업으로 가로·세로 스크롤 */
  scrollToTask: (taskId: string, options?: GanttScrollOptions) => void;
  /**
   * 프로젝트 전체가 뷰포트 너비에 들어가는 가장 촘촘한 배율로 전환
   *
   * 프로젝트가 보이도록 스크롤도 해요. 작업이 없는 동안에는 아무 일도 하지 않아요.
   */
  zoomToFit: () => void;
  /** 스크롤 컨테이너 DOM 노드 (없으면 null) */
  getScrollElement: () => HTMLDivElement | null;
}
```

`Dayjs`는 `dayjs`의 객체 타입이에요. 패키지가 이를 다시 export하지 않으니 `dayjs`에서 직접
import하세요. 평범한 문자열이나 `Date`도 받고 UTC로 파싱해요 — [작업 데이터](../task-data.md)를
보세요.

## `GanttScrollOptions`

```ts
/** scrollTo* 메서드의 옵션 */
export interface GanttScrollOptions {
  /** 스크롤에 애니메이션을 줄지 여부 (기본값 true) */
  smooth?: boolean;
  /** 대상이 뷰포트 안 어디에 놓일지 (기본값 'center') */
  align?: "start" | "center";
}
```

| 필드 | 타입 | 기본값 | 동작 |
|---|---|---|---|
| `smooth` | `boolean` | `true` | `false`면 `behavior: "auto"`로 스크롤해요. `undefined`를 포함한 다른 값은 모두 `behavior: "smooth"`로 애니메이션해요. |
| `align` | `"start" \| "center"` | `"center"` | `"start"`는 대상을 타임라인 영역 왼쪽 가장자리에 둬요. `"center"`는 타임라인 영역 안에서 가운데에 두는데, 작업 목록 창을 뺀 나머지 너비를 기준으로 계산해요. |

가로 목표값은 `Math.max(0, …)`로 잘려요. 그래서 타임라인 원점보다 왼쪽에 있는 목표는 `0`으로
스크롤해요.

`align`은 가로 축에만 적용돼요. `scrollToTask`는 세로로 움직일 때면 언제나 행을 가운데에 맞춰요.

## `GanttZoomAnchor`

```ts
/** 타임라인의 보이는 왼쪽 가장자리에서 일정한 거리에 고정되는 날짜 */
export interface GanttZoomAnchor {
  date: Dayjs;
  /** 타임라인 영역 왼쪽 가장자리로부터의 px (작업 목록 창 제외) */
  viewportX: number;
}
```

이 타입은 패키지가 export하지만, `GanttHandle`의 어떤 멤버도 이를 받지 않아요. 배율이 바뀌는
동안 차트가 고정해 두는 앵커를 나타내요 — `zoomToFit`과 휠 줌 뒤에 있는 동작이죠. 공개 API 중
이를 쓰는 곳이 없으니 넘겨줄 대상도 없어요.

## ref 연결하기

```tsx
// TimelinePane.tsx
import { useRef } from 'react';
import { ReactGanttChart } from '@jaeungkim/gantt-chart';
import type { GanttHandle, Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

const tasks: Task[] = [
  {
    id: '1', name: 'Design', parentId: null, sequence: '1',
    startDate: '2025-06-01', endDate: '2025-06-10',
  },
  {
    id: '2', name: 'Build', parentId: null, sequence: '2',
    startDate: '2025-06-11', endDate: '2025-06-30',
  },
];

export function TimelinePane() {
  const chart = useRef<GanttHandle>(null);

  return (
    <>
      <button onClick={() => chart.current?.scrollToToday({ align: 'start' })}>
        Today
      </button>
      <button onClick={() => chart.current?.zoomToFit()}>Fit</button>
      <ReactGanttChart ref={chart} tasks={tasks} height={400} />
    </>
  );
}
```

## 마운트 전, 그리고 너무 이른 호출

React가 차트를 커밋하기 전까지 `ref.current`는 `null`이고, 언마운트된 뒤에도 다시 `null`이에요.
부모의 렌더 도중에 읽으면 `null`이 보여요. 부모의 `useEffect`나 `useLayoutEffect`가 실행될 때는
핸들이 자리를 잡은 뒤예요. `!` 대신 `?.`로 막아 주세요.

핸들이 생긴 뒤에는 필요한 데이터가 아직 없어도 메서드를 호출할 수 있어요. 아래 각 경우는 예외를
던지지도 않고 콘솔 경고도 남기지 않은 채 그냥 반환해요.

| 호출 | 조건 | 결과 |
|---|---|---|
| `scrollToDate` | 타임라인에 눈금이 없거나, 날짜가 첫 눈금보다 앞이거나 마지막 눈금의 끝을 지날 때 | 스크롤 없음 |
| `scrollToToday` | 오늘이 렌더링된 범위 밖일 때 | 스크롤 없음 |
| `scrollToTask` | id가 현재 렌더링된 행에 없을 때 — 모르는 id이거나, 접힌 부모나 접힌 그룹 아래에 숨어 있을 때 | 스크롤 없음 |
| `zoomToFit` | `tasks`가 비었거나 스크롤 컨테이너가 마운트되지 않았을 때 | 배율 변화 없음, 스크롤 없음 |
| `getScrollElement` | 차트가 마운트되지 않았을 때 | `null` |
| `undo` / `redo` | 해당 스택이 비었을 때 | 변화 없음, `onTasksChange` 없음 |

`exportToPng`는 예외예요. 아무 일도 하지 않는 대신 reject해요. 전체 에러 목록은
[내보내기](export.md)에 있어요.

## 참고

- 바탕이 되는 스크롤, 내보내기, 히스토리 API의 참조가 바뀔 때마다 핸들 객체도 다시 만들어져요.
  `canUndo`와 `canRedo`는 그 위의 getter라서, 앞서 잡아 둔 핸들 참조에서도 현재 값을 알려줘요.
- `scrollToDate`와 `scrollToToday`는 `scrollTop`을 건드리지 않아요. 세로로 스크롤하는 건
  `scrollToTask`뿐이고, 대상 행이 뷰포트 밖일 때만 그래요.
- `zoomToFit`은 `GanttScrollOptions`를 받지 않아요. 이 스크롤은 언제나 즉시 일어나고 애니메이션은
  없어요.
- `zoomToFit`은 여섯 배율을 `hour`, `day`, `week`, `month`, `quarter`, `year` 순으로 고르고,
  어디에도 들어가지 않으면 `year`로 물러나요 — [타임라인](../timeline.md)을 보세요.
- 세로 `scrollToTask` 계산에 쓰는 행 높이는 38 px 고정이에요.
- 동작과 실제 예제, 그리고 이 메서드들의 배경은 [명령형 API](../imperative-api.md)에 있어요.
