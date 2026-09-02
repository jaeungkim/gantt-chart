`GanttMarker`는 날짜 하나에 세로선을 그려요. `GanttRangeBand`는 행 뒤쪽으로 날짜 구간을 음영 처리해요. `GanttDateRange`는 `onRangeChange`가 돌려주는 형태예요. 셋 다 패키지 루트에서 export돼요.

```tsx
// src/MarkerTypes.tsx
import type {
  GanttMarker,
  GanttRangeBand,
  GanttDateRange,
} from '@jaeungkim/gantt-chart';
```

이 세 타입은 `GanttProps`의 프롭 세 개로 차트에 전달돼요:

| 프롭 | 타입 | 기본값 |
|---|---|---|
| `markers` | `GanttMarker[]` | `[]` (모듈 레벨 상수라 리렌더 사이에도 동일해요) |
| `rangeBands` | `GanttRangeBand[]` | `[]` (모듈 레벨 상수라 리렌더 사이에도 동일해요) |
| `onRangeChange` | `(range: GanttDateRange) => void` | 없음 |

마커와 밴드를 어디에 쓰는지, 타임라인을 스크롤할 때 어떻게 움직이는지는 [타임라인](../timeline.md)에 있어요.

## 날짜 입력

이 타입들의 날짜 필드는 모두 같은 유니온을 받아요:

```ts
// src/types/gantt.ts
/** 마커/밴드 프롭이 날짜로 받아들이는 모든 값 */
export type GanttDateInput = string | Date | Dayjs;
```

`GanttDateInput`은 **패키지 루트에서 export되지 않아요**. import를 시도하지 마세요. 유니온을 직접 적거나 `GanttMarker['date']`를 쓰면 돼요.

각 값은 차트의 UTC `dayjs`로 그대로 넘어가요. 그래서 시간대가 없는 문자열(`'2025-06-01'`, `'2025-06-01T09:00'`)은 UTC 벽시계로 읽혀서 적힌 그대로의 위치에 놓여요. 작업 날짜와 같은 규칙이 적용돼요. [작업 데이터](../task-data.md)를 참고하세요.

## `GanttMarker`

```ts
// src/types/gantt.ts
/** 날짜 하나에 그리는 라벨 달린 세로선 - 마감일, 릴리스, 그리고 내장 오늘 선 */
export interface GanttMarker {
  /** React key (기본값: 해당 날짜) */
  id?: string;
  date: GanttDateInput;
  /** 선 위쪽에 표시할 텍스트 - 생략하면 선만 그려져요 */
  label?: string;
  /** 마커 엘리먼트에 추가할 클래스 */
  className?: string;
  /** 선 색상 - 모든 CSS 색상 가능, 클래스와 테마 기본값을 덮어써요 */
  color?: string;
  /**
   * 작업이 마커 날짜를 넘겨 끝나면 마커를 경고 상태(`data-warning="true"`)로 바꿔요
   *
   * 모든 작업을 검사하고, `taskIds`가 주어지면 그 작업들만 검사해요.
   */
  warnOnOverrun?: boolean;
  /** `warnOnOverrun` 검사를 이 작업들로 제한해요 */
  taskIds?: string[];
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `string` | 아니요 | `` `${String(date)}-${index}` `` | React key 전용이에요. DOM에는 절대 쓰이지 않아요. |
| `date` | `GanttDateInput` | 예 | — | 선이 그려지는 위치예요. 파싱할 수 없는 값이면 마커가 사라져요. |
| `label` | `string` | 아니요 | 없음 | `.gantt-marker-label`에 들어가는 텍스트예요. 생략하면 라벨 엘리먼트를 만들지 않아요. |
| `className` | `string` | 아니요 | 없음 | 선 엘리먼트에서 `gantt-marker` 뒤에 덧붙어요. |
| `color` | `string` | 아니요 | `var(--gantt-marker)` | 모든 CSS 색상을 쓸 수 있어요. `--gantt-marker-color`로 인라인에 적혀요. |
| `warnOnOverrun` | `boolean` | 아니요 | `false` | `=== true`로 비교해요. 감시 대상 작업이 `date` 이후에 끝나면 `data-warning="true"`를 붙여요. |
| `taskIds` | `string[]` | 아니요 | 모든 작업 | `warnOnOverrun` 검사를 이 작업 id들로 한정해요. |

### 기한 초과

차트는 변환을 마친 작업 전체를 기준으로 `warnOnOverrun`을 판정해요. 접혀 있는 행도 포함해서 검사해요. 비교는 초과(>)일 때만 참이에요:

```ts
// src/utils/timeline.ts
const overrun =
  marker.warnOnOverrun === true &&
  tasks.some(
    (task) =>
      (!marker.taskIds || marker.taskIds.includes(task.id)) &&
      dayjs(task.endDate).valueOf() > time
  );
```

`date`와 정확히 같은 시점에 끝나는 작업은 기한 초과가 아니에요.

### DOM

```html
<div class="gantt-marker <className>" style="left: <n>px; --gantt-marker-color: <color>"
     data-warning="true" aria-hidden="true">
  <span class="gantt-marker-label"><label></span>
</div>
```

`data-warning`은 초과 검사를 통과했을 때만 붙어요. 그 외에는 `"false"`가 아니라 속성 자체가 없어요. `--gantt-marker-color`는 `color`를 지정했을 때만 나타나요. 마커 엘리먼트는 `.gantt-content` 안에 형제로 놓이고, 감싸는 레이어는 없어요.

| 셀렉터 | 선언 |
|---|---|
| `.gantt-marker` | `position:absolute; top:0; bottom:0; width:2px; margin-left:-1px; background:var(--gantt-marker-color, var(--gantt-marker)); pointer-events:none; z-index:2` |
| `.gantt-marker[data-warning="true"]` | `--gantt-marker-color: var(--gantt-marker-warning)` |
| `.gantt-marker-label` | `position:absolute; top:2px; left:3px; padding:1px 5px; font-size:10px; font-weight:600; line-height:1.4; color:var(--gantt-marker-label); background:var(--gantt-marker-color, var(--gantt-marker)); border-radius:3px; white-space:nowrap` |
| `.gantt-today-marker` | `position:absolute; top:0; bottom:0; width:2px; margin-left:-1px; background:var(--gantt-today-marker); opacity:0.7; pointer-events:none; z-index:2` |

## 내장 오늘 마커

차트는 `markers`에 무엇이 담겨 있든 자기 마커 하나를 앞에 덧붙여요:

```ts
// src/pages/Gantt.tsx
{ id: "today", date: dayjs(), className: "gantt-today-marker" }
```

id는 `"today"`이고 클래스 목록은 `gantt-marker gantt-today-marker`예요. `label`도 `color`도 `warnOnOverrun`도 없어요. 이 마커를 숨기는 프롭은 없어요. `.gantt-today-marker { display: none }`이 유일한 스위치예요.

## `GanttRangeBand`

```ts
// src/types/gantt.ts
/** 날짜 구간을 덮는 음영 밴드 - 스프린트, 단계, 프리즈 */
export interface GanttRangeBand {
  /** React key (기본값: 시작 날짜) */
  id?: string;
  startDate: GanttDateInput;
  endDate: GanttDateInput;
  /** 밴드 위쪽에 표시할 텍스트 */
  label?: string;
  /** 밴드 엘리먼트에 추가할 클래스 */
  className?: string;
  /** 채움 색상 - 모든 CSS 색상 가능, 클래스와 테마 기본값을 덮어써요 */
  color?: string;
}
```

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|---|---|---|
| `id` | `string` | 아니요 | `` `${String(startDate)}-${index}` `` | React key 전용이에요. DOM에는 절대 쓰이지 않아요. |
| `startDate` | `GanttDateInput` | 예 | — | 왼쪽 끝이에요. 그 날짜에 시작하는 막대와 같은 방식으로 계산해요. |
| `endDate` | `GanttDateInput` | 예 | — | 오른쪽 끝이에요. 반드시 `startDate`보다 뒤여야 해요. |
| `label` | `string` | 아니요 | 없음 | `.gantt-range-band-label`에 들어가는 텍스트예요. 생략하면 라벨 엘리먼트를 만들지 않아요. |
| `className` | `string` | 아니요 | 없음 | 밴드 엘리먼트에서 `gantt-range-band` 뒤에 덧붙어요. |
| `color` | `string` | 아니요 | `var(--gantt-band-bg)` | 모든 CSS 색상을 쓸 수 있어요. `--gantt-band-color`로 인라인에 적혀요. |

### DOM

```html
<div class="gantt-range-band-layer" aria-hidden="true">
  <div class="gantt-range-band <className>"
       style="left: <n>px; width: <n>px; --gantt-band-color: <color>">
    <span class="gantt-range-band-label"><label></span>
  </div>
</div>
```

밴드는 data 속성을 하나도 만들지 않아요. 배치 후 남는 밴드가 없으면 레이어 엘리먼트 자체가 사라져요.

| 셀렉터 | 선언 |
|---|---|
| `.gantt-range-band-layer` | `position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0` |
| `.gantt-range-band` | `position:absolute; top:0; bottom:0; background:var(--gantt-band-color, var(--gantt-band-bg))` |
| `.gantt-range-band-label` | `position:absolute; top:2px; left:4px; font-size:10px; font-weight:600; color:var(--gantt-muted-foreground); white-space:nowrap` |

## `GanttDateRange`

```ts
// src/types/gantt.ts
/** `onRangeChange`가 알려 주는, 실제로 렌더링된 타임라인 범위 */
export interface GanttDateRange {
  start: Dayjs;
  end: Dayjs;
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `start` | `Dayjs` | 타임라인 첫 눈금의 시작 날짜예요. 이 값은 포함이에요. |
| `end` | `Dayjs` | 마지막 눈금의 시작 날짜에 눈금 단위 하나를 더한 값이에요. **이 값은 미포함이에요.** |

두 값 모두 UTC `dayjs` 객체예요. 패키지는 `dayjs`도 `Dayjs` 타입도 다시 export하지 않아요. `dayjs`에서 직접 import하세요.

## 배치 규칙

| 입력 | 결과 |
|---|---|
| 마커 `date`를 파싱할 수 없음 | 마커가 사라지고, 에러는 없어요 |
| 마커 `date`가 렌더링된 범위 밖 | 마커가 사라지고, 에러는 없어요 |
| 밴드 `startDate` 또는 `endDate`를 파싱할 수 없음 | 밴드가 사라지고, 에러는 없어요 |
| 밴드 `endDate <= startDate` | 밴드가 사라지고, 에러는 없어요 |
| 밴드가 렌더링된 범위보다 완전히 앞이거나 뒤 | 밴드가 사라지고, 에러는 없어요 |
| 밴드가 범위의 한쪽 끝과 걸침 | 보이는 부분까지만 잘려요 |
| 현재 배율에서 밴드 너비가 1px 미만 | 1px 너비로 그려져요 |

## 제약

- 마커와 밴드는 장식이에요. 둘 다 `aria-hidden="true"`에 `pointer-events: none`이에요. 그래서 클릭·호버·툴팁·포커스 API가 없고, 스크린 리더가 읽을 텍스트도 없어요.
- 마커는 스크롤되는 콘텐츠 안, 고정 헤더 아래에 렌더링돼요. 마커 선이 헤더 행을 가로지르는 일은 없어요.
- 오늘 마커의 `dayjs()`는 마커 메모가 다시 계산될 때 읽혀요. 자정에 선을 옮겨 주는 타이머는 없어요.
- 호스트 앱이 `id: "today"`인 마커를 넣으면 내장 마커와 충돌해서 React key 중복 경고가 떠요.
- `color`가 `warnOnOverrun`보다 우선해요. 둘 다 `--gantt-marker-color`에 쓰는데 `color`는 인라인으로 쓰기 때문이에요. 그래서 둘을 함께 준 마커는 지정한 색을 유지하고 경고색으로 바뀌지 않아요. `data-warning`은 DOM에 그대로 나타나요.
- 호스트 마커에 `className: "gantt-today-marker"`를 주면 선에서는 `color`를 덮어쓰지만 라벨에서는 그렇지 않아요. 그 규칙이 `background`를 직접 지정하기 때문이에요.
- 렌더링된 범위는 작업들의 구간에 고정 버퍼를 더한 값이에요. `visibleStart`, `visibleEnd`, `infiniteScroll`이 이 범위를 넓힐 수 있어요. 마지막 작업보다 한참 뒤에 있는 마커는 그려지지 않아요. [타임라인](../timeline.md)을 참고하세요.
- `GanttDateInput`, `PositionedMarker`, `PositionedBand`, `computeMarkerOffsets`, `computeBandRects`는 내부 전용이에요. 패키지에서 import할 수 있는 건 `GanttMarker`, `GanttRangeBand`, `GanttDateRange`뿐이에요.
- `id`의 JSDoc은 key 기본값이 날짜라고 적어 두었어요. 실제 코드는 여기에 배열 인덱스를 덧붙여요. 두 값 모두 DOM까지 가지 않아요.

## 관련 문서

- [타임라인](../timeline.md) — 마커와 밴드가 언제 그려지는지, 렌더링된 범위가 어디까지인지.
- [테마](../theming.md) — `--gantt-marker`, `--gantt-marker-warning`, `--gantt-marker-label`, `--gantt-today-marker`, `--gantt-band-bg`를 비롯한 커스텀 프로퍼티 표 전체.
- [프롭](props.md) — `GanttProps` 전체 목록.
