네 개의 prop이 차트가 직접 그리는 마크업의 일부를 대체해요. `renderBar`, `renderTooltip`,
`renderHeaderCell`, `renderBaseline`이에요. 타입은 `@jaeungkim/gantt-chart`에서 가져와요. 다만
`renderBaseline`은 `GanttProps`에 인라인으로 선언돼 있어서 이름으로 export된 타입이 없어요.
동작과 실제 예제는 [커스텀 렌더링](../custom-rendering.md)에 있어요.

```ts
import type {
  GanttBarRenderer,
  GanttBarRenderProps,
  GanttTooltipRenderer,
  GanttTooltipRenderProps,
  GanttTooltipReason,
  GanttHeaderCellRenderer,
  GanttHeaderCellRenderProps,
} from '@jaeungkim/gantt-chart';
```

`TaskTransformed`는 [작업](task.md)에, `GanttScaleKey`는 [배율](scales.md)에 정리돼 있어요.
`Dayjs`는 `dayjs`에서 와요. `ReactNode`, `CSSProperties`, `PointerEventHandler`,
`MouseEventHandler`는 `react`에서 와요.

## GanttBarRenderer

```ts
/** `renderBar` 오버라이드에 전달되는 props */
export interface GanttBarRenderProps {
  task: TaskTransformed;
  /** 타임라인 원점에서 떨어진 왼쪽 오프셋(px), 드래그 중인 오프셋 포함 */
  left: number;
  /** 렌더링된 막대 너비(px), 드래그 중인 오프셋 포함 */
  width: number;
  /** 막대가 쓸 수 있는 행 높이(px) */
  height: number;
  /** 진행률 0-100, 값이 없는 작업이면 null */
  progress: number | null;
  scale: GanttScaleKey;
  isMilestone: boolean;
  isSummary: boolean;
  isDragging: boolean;
  isSelected: boolean;
  /**
   * 대체 노드의 루트에 spread 하세요
   *
   * 위치를 잡는 style과 드래그, 클릭, 더블클릭 핸들러를 담고 있어요. 그래서 커스텀
   * 막대도 기본 막대처럼 계속 동작해요.
   */
  barProps: {
    style: CSSProperties;
    onPointerDown: PointerEventHandler<HTMLDivElement>;
    onClick: MouseEventHandler<HTMLDivElement>;
    onDoubleClick: MouseEventHandler<HTMLDivElement>;
  };
}

export type GanttBarRenderer = (props: GanttBarRenderProps) => ReactNode;
```

### 필드

| 필드 | 타입 | 값 |
|---|---|---|
| `task` | `TaskTransformed` | 드래그 미리보기까지 반영된 현재 형태의 작업 |
| `left` | `number` | `task.barLeft`에 드래그 중인 오프셋을 더한 값. 타임라인 원점 기준 px |
| `width` | `number` | `task.barWidth`에 드래그 중인 오프셋을 더한 값. 최소 **14px**로 제한돼요 |
| `height` | `number` | 언제나 **19** — 38px 행의 절반이에요. JSDoc이 적은 행 높이가 아니라 막대 높이예요 |
| `progress` | `number \| null` | 진행률 핸들을 드래그하는 동안에는 실시간 값, 아니면 작업의 clamp된 `progress`. 값이 없는 작업이면 `null` |
| `scale` | `GanttScaleKey` | 현재 선택된 배율 |
| `isMilestone` | `boolean` | `task.type === 'milestone'` |
| `isSummary` | `boolean` | `Boolean(task.isSummary)` |
| `isDragging` | `boolean` | 이 막대가 진행 중인 제스처의 대상이면 `true` |
| `isSelected` | `boolean` | 이 작업이 선택된 작업이면 `true` |
| `barProps` | object | 아래 표를 보세요 |

### barProps

| 키 | 값 |
|---|---|
| `style` | `transform: translateX(${left}px)`, `width: ${width}px`, `height: 19`, `cursor`, 그리고 세 개의 `--gantt-*-color` 커스텀 속성. 단 `task.color`가 있을 때만이에요. 없으면 색상 키는 아예 붙지 않아요. 마일스톤이면 transform이 `translateX(${left - 11}px)`이고 `width` 키는 없어요 |
| `onPointerDown` | 이동, 리사이즈, 또는 막대를 들어 올리는 400ms 터치 롱프레스를 시작해요 |
| `onClick` | `onTaskClick`을 발생시킨 뒤 선택을 적용해요. 드래그를 끝내는 클릭은 삼켜요 |
| `onDoubleClick` | `onTaskDoubleClick`을 발생시켜요 |

마일스톤 오프셋은 `barProps.style`에만 적용돼요. `left` 필드는 그대로예요. 그래서 `left`로
스스로 위치를 잡는 대체 노드는 기본 다이아몬드보다 11px 오른쪽에 놓여요.

### 제약

대체 노드의 루트에 `barProps`를 spread 하세요. 키를 하나씩 빠뜨릴 때마다 아래 대가를 치러요.

| 빠뜨린 키 | 결과 |
|---|---|
| `style` | 막대의 위치가 잡히지 않고, 높이도 커서도 없어요. 작업별 색상 커스텀 속성도 잃어요 |
| `onPointerDown` | 이동도 리사이즈도 터치 롱프레스도 없어요. 막대를 드래그할 수 없어요 |
| `onClick` | `onTaskClick`이 발생하지 않고, 막대를 선택할 수도 없어요. 드래그를 끝내는 클릭도 더는 삼키지 않아요 |
| `onDoubleClick` | `onTaskDoubleClick`이 발생하지 않아요 |

`barProps`는 기본 노드의 나머지를 담고 있지 않아요. 아래 항목은 spread 여부와 상관없이
`renderBar`를 쓰는 순간 사라져요. 필요한 것은 대체 노드가 직접 다시 넣어야 해요.

- `id="task-<task.id>"` — 작업 목록의 모든 행이 `aria-owns`로 이걸 가리켜요. 그래서 treegrid의
  행-막대 소유 관계가 깨져요.
- `data-task-id`, `data-gantt-cell`, `tabIndex` — 키보드 내비게이션은 `data-gantt-cell`로 막대를
  찾아요. 그래서 로빙 tabindex가 막대까지 닿지 못해요.
- `role="gridcell"`과 `aria-label` — 스크린 리더 레이블이 사라져요.
- `ref`와 `onMouseMove` — 리사이즈 가장자리 커서가 사라져요.
- `onMouseEnter` / `onMouseLeave` — 호버 상태가 켜지지 않아요.
- 클래스 문자열: `gantt-task-bar`, `dragging`, `compact`, `summary`, `no-resize`, `critical`,
  `link-target valid|invalid`, `selected`, `reverting`, 그리고 작업 자신의 `className`. 스타일시트가
  전혀 적용되지 않고, `task.className`도 다시 붙지 않아요.
- 자식 요소: 진행률 채움과 그 핸들, 작업 이름, 마일스톤 다이아몬드, 커넥터 점 두 개(그래서
  의존성 그리기를 쓸 수 없어요), 그리고 툴팁.

`renderBar`가 설정돼 있으면 `renderTooltip`은 절대 호출되지 않아요. 툴팁도 대체 노드의 몫이에요.

## GanttTooltipRenderer

```ts
/** 툴팁이 보이는 이유 */
export type GanttTooltipReason = 'hover' | 'move' | 'resize' | 'progress';

/** `renderTooltip` 오버라이드에 전달되는 props */
export interface GanttTooltipRenderProps {
  task: TaskTransformed;
  reason: GanttTooltipReason;
  /** 미리보기 중인 시작 - 제스처가 진행 중이면 드래그 중인 값 */
  startDate: Dayjs;
  /** 미리보기 중인 종료 - 마일스톤이면 `startDate`와 같아요 */
  endDate: Dayjs;
  /** 종료에서 시작을 뺀 값, 밀리초 */
  durationMs: number;
  /** 진행률 0-100, 값이 없는 작업이면 null */
  progress: number | null;
  scale: GanttScaleKey;
}

export type GanttTooltipRenderer = (
  props: GanttTooltipRenderProps
) => ReactNode;
```

### 필드

| 필드 | 타입 | 값 |
|---|---|---|
| `task` | `TaskTransformed` | 툴팁이 속한 작업 |
| `reason` | `GanttTooltipReason` | 아래 표를 보세요 |
| `startDate` | `Dayjs` | 제스처가 진행 중이면 드래그 중인 시작, 아니면 `dayjs(task.startDate)` |
| `endDate` | `Dayjs` | 제스처가 진행 중이면 드래그 중인 종료, 아니면 `dayjs(task.endDate)`. 마일스톤이면 `startDate`와 같아요 |
| `durationMs` | `number` | `endDate.valueOf() - startDate.valueOf()`, 밀리초 단위. 마일스톤이면 `0` |
| `progress` | `number \| null` | 진행률 핸들을 드래그하는 동안에는 실시간 값, 아니면 작업의 clamp된 `progress`. 값이 없는 작업이면 `null` |
| `scale` | `GanttScaleKey` | 현재 선택된 배율 |

### reason

가장 구체적인 것부터 차례로 결정돼요.

| 값 | 조건 |
|---|---|
| `progress` | 진행률 핸들을 드래그하는 중 |
| `resize` | 막대 드래그가 `left` 또는 `right` 모드로 진행 중 |
| `move` | 막대 드래그가 `bar` 모드로 진행 중 |
| `hover` | 마우스가 막대 위에 있고 아무것도 드래그하지 않는 중 |

위 중 어느 것도 아니면 렌더러는 아예 호출되지 않아요. `showTooltip`이 `false`일 때도 호출되지
않아요.

### 제약

여기에는 props 묶음이 없어요. 그래서 spread 할 것도 없어요.

- `showTooltip`의 기본값은 `true`예요. `false`로 설정하면 호버 툴팁, 드래그 툴팁, `renderTooltip`이
  모두 함께 막혀요.
- 반환한 노드는 막대 노드의 마지막 자식으로 렌더링돼요. 위치는 `.gantt-bar-tooltip` 클래스가
  잡아요. 그래서 그 클래스를 쓰지 않는 대체 노드는 스스로 위치를 잡아야 해요.
- 기본 마크업은 제스처 중에는 `<div class="gantt-bar-tooltip" role="status" aria-live="polite">`,
  호버일 때는 `<div class="gantt-bar-tooltip gantt-bar-tooltip-detail" role="tooltip">`이에요. 이
  role이 없는 대체 노드는 실시간 안내를 잃어요.
- `renderBar`가 설정돼 있으면 이 렌더러에는 도달하지 못해요.

## GanttHeaderCellRenderer

```ts
/** `renderHeaderCell` 오버라이드에 전달되는 props */
export interface GanttHeaderCellRenderProps {
  /** `'top'`은 병합된 그룹 레이블, `'bottom'`은 시간 눈금 하나 */
  row: 'top' | 'bottom';
  date: Dayjs;
  /** 기본 헤더가 찍었을 레이블 */
  label: string;
  width: number;
  scale: GanttScaleKey;
  /** 헤더 레이아웃을 그대로 두려면 대체 노드의 루트에 spread 하세요 */
  cellProps: { className: string; style: CSSProperties };
}

export type GanttHeaderCellRenderer = (
  props: GanttHeaderCellRenderProps
) => ReactNode;
```

### 필드

| 필드 | 타입 | 값 |
|---|---|---|
| `row` | `'top' \| 'bottom'` | 병합된 그룹 레이블이면 `'top'`, 눈금 하나면 `'bottom'` |
| `date` | `Dayjs` | 셀의 UTC 시작 — `'top'`이면 병합된 그룹의 시작, `'bottom'`이면 눈금의 시작 |
| `label` | `string` | 기본 헤더가 찍었을 문자열 그대로예요. locale과 `formats` 오버라이드가 이미 반영돼 있어요 |
| `width` | `number` | 셀의 너비(px) — `'top'`이면 병합된 그룹 너비, `'bottom'`이면 가상화된 눈금 크기 |
| `scale` | `GanttScaleKey` | 현재 선택된 배율 |
| `cellProps` | object | 아래 표를 보세요 |

### cellProps

| `row` | `cellProps.className` | `cellProps.style` |
|---|---|---|
| `'top'` | `"gantt-top-group"` | `{ width: '<group width>px' }` |
| `'bottom'` | `"gantt-bottom-cell"` | `{ width: '<tick width>px' }` |

### 제약

대체 노드의 루트에 `cellProps`를 spread 하세요.

- 헤더 두 행이 같은 렌더러를 거쳐요. 그래서 대체 노드는 `row`로 분기해야 해요.
- `cellProps.style`이 없으면 셀에 명시적인 너비가 없어요. 두 행 모두 flex 행이고, 아래 행은 왼쪽에서
  건너뛴 가상화 셀만큼의 spacer로 시작해요. 그래서 크기가 자동인 셀 하나가 뒤의 모든 셀을 밀어내고,
  헤더가 막대와 어긋나요.
- `cellProps.className`이 없으면 셀은 스타일시트가 주던 테두리와 타이포그래피를 잃어요.
- 결과는 차트가 key를 붙인 `Fragment`로 감싸요. 그래서 렌더러는 key를 넘기지 않아요.
- 기본 자식은 딸려오지 않아요. 위 행의 `<p class="gantt-top-group-label">{label}</p>`와 아래 셀의
  눈금 레이블 텍스트요.

## renderBaseline

`GanttProps`에 인라인으로 선언돼 있어요. export된 렌더러 타입이 없어서 이름으로 import할 수 없어요.

```ts
/**
 * 기본 베이스라인 막대를 대체해요
 *
 * `baselineStart`를 가진 작업에만 호출돼요. 무엇을 반환하든 상관없어요 - 요소의
 * 위치는 렌더러가 아니라 행이 잡아요.
 */
renderBaseline?: (task: TaskTransformed) => ReactNode;
```

이 prop이 대체하는 기본값이에요.

```tsx
<div
  className={`gantt-baseline${isMilestoneTask(task) ? " milestone" : ""}`}
  style={{
    left: `${task.baselineLeft}px`,
    width: isMilestoneTask(task) ? undefined : `${task.baselineWidth}px`,
  }}
  aria-hidden="true"
/>
```

### 제약

props 묶음도 없고 `left` / `width` 인자도 없어요. 그래서 spread 할 것은 없지만, 가로 위치도 아무도
잡아 주지 않아요.

- 렌더러는 `task.baselineLeft !== undefined`일 때만 실행돼요. JSDoc은 `baselineStart`라고 적어
  뒀지만, 코드는 파생된 지오메트리 필드를 읽어요. 그 필드는 지금은 `baselineStart`가 있을 때만
  채워져요.
- `task.baselineLeft`와 `task.baselineWidth`는 작업에서 직접 읽으세요. 둘 다 `TaskTransformed`에서
  `number | undefined`예요.
- 노드는 막대 래퍼 안에 렌더링돼요. 래퍼는 세로 배치만 잡아 줘요. 가로 배치는 렌더러의 몫이에요.
- `null`이나 `undefined`를 반환하면 아무것도 안 그려지는 게 아니라 **기본** 베이스라인 요소가
  렌더링돼요. 이 prop으로 베이스라인을 숨길 방법은 없어요.
- 뷰포트에서 걸러진 막대는 베이스라인도 함께 데려가요. 그래서 화면 밖 행에는 렌더러가 호출되지
  않아요.

베이스라인 자체는 [스케줄링](../scheduling.md)에서 다뤄요. 여기 나온 모든 prop은
[Props](props.md)에 정리돼 있어요.
