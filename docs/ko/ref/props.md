`GanttProps`는 `ReactGanttChart`가 받는 프로퍼티 전체예요. 이 타입과 아래 표에 나오는 모든 타입은
패키지 루트에서 내보내요. `Dayjs`, `ReactNode`, `React.MouseEvent`만 예외이고, 이 셋은 `dayjs`와
`react`에서 와요:

```tsx
import { ReactGanttChart, type GanttProps } from '@jaeungkim/gantt-chart';
```

모든 프로퍼티는 선택이에요. 기본값 열에는 컴포넌트가 실제로 사용하는 대체 값이 들어 있어요. `없음`은
대체 값이 없다는 뜻이고, 그 프로퍼티가 켜는 기능도 꺼진 채로 있어요.

## 데이터

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `tasks` | `Task[]` | `[]` | 작업 배열이에요. [작업 데이터](../task-data.md) 참고. |
| `onTasksChange` | `(updatedTasks: Task[]) => void` | 없음 | 편집이 확정될 때마다 배열 전체와 함께 호출돼요. [작업 편집](../editing.md) 참고. |

## 레이아웃과 크기

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `height` | `number \| string` | `600` | 차트 높이예요. px 숫자나 아무 CSS 길이나 받아요. [빠른 시작](../quick-start.md) 참고. |
| `width` | `number \| string` | `"100%"` | 차트 너비예요. px 숫자나 아무 CSS 길이나 받아요. [빠른 시작](../quick-start.md) 참고. |
| `className` | `string` | 없음 | 컨테이너의 `gantt-container` 클래스 뒤에 붙어요. [테마](../theming.md) 참고. |

## 작업 목록

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `showTaskList` | `boolean` | `columns !== undefined` | 왼쪽 패널을 보여줘요. [작업 목록과 계층](../task-list.md) 참고. |
| `columns` | `GanttColumn[]` | `DEFAULT_COLUMNS` — Name / Start / End | 패널의 열 정의예요. [작업 목록과 계층](../task-list.md)과 [GanttColumn](columns.md) 참고. |

## 계층과 그룹

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `hierarchy` | `boolean` | `false` | `parentId`로 깊이와 요약 행을 계산해요. [작업 목록과 계층](../task-list.md) 참고. |
| `collapsedIds` | `string[]` | 없음 — 차트가 자체 목록을 들고 있어요 | 제어 방식의 접힘 집합이에요. [작업 목록과 계층](../task-list.md) 참고. |
| `defaultCollapsedIds` | `string[]` | `[]` | 비제어 초기값이고, 마운트할 때 한 번만 읽어요. [작업 목록과 계층](../task-list.md) 참고. |
| `onCollapsedChange` | `(collapsedIds: string[]) => void` | 없음 | 제어 여부와 상관없이 접기 토글마다 호출돼요. [작업 목록과 계층](../task-list.md) 참고. |
| `groupBy` | `GanttGroupBy` | 없음 | 행을 스윔레인으로 묶어요. [그룹과 스윔레인](../grouping.md)과 [GanttGroupBy](grouping.md) 참고. |
| `ungroupedLabel` | `string` | `"Ungrouped"` | 그룹 값이 없는 작업의 헤더 라벨이에요. [그룹과 스윔레인](../grouping.md) 참고. |

## 타임라인과 범위

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `defaultScale` | `GanttScaleKey` | `"month"` — `storageKey`에 저장된 배율이 없을 때만 | 새 세션의 시작 배율이에요. [타임라인](../timeline.md) 참고. |
| `visibleStart` | `string` | 없음 — 범위가 작업에 맞춰져요 | 타임라인 시작을 이 ISO 날짜에 고정해요. [타임라인](../timeline.md) 참고. |
| `visibleEnd` | `string` | 없음 — 범위가 작업에 맞춰져요 | 타임라인 끝을 이 ISO 날짜에 고정해요. [타임라인](../timeline.md) 참고. |
| `showNonWorkingDays` | `boolean` | `true` | 주말과 휴일을 음영 처리해요. [타임라인](../timeline.md) 참고. |
| `holidays` | `string[]` | 없음 — 휴일로 처리하는 날짜가 없어요 | 비근무일로 음영 처리할 ISO 날짜 문자열이에요. [타임라인](../timeline.md) 참고. |
| `isNonWorkingDay` | `(date: Dayjs) => boolean` | 없음 — 주말과 `holidays` 검사를 써요 | 내장 비근무일 판정을 대신해요. [타임라인](../timeline.md) 참고. |
| `markers` | `GanttMarker[]` | `[]` | 지정한 날짜에 라벨이 붙은 세로선을 그려요. [타임라인](../timeline.md)과 [GanttMarker](markers.md) 참고. |
| `rangeBands` | `GanttRangeBand[]` | `[]` | 날짜 범위를 덮는 음영 띠예요. [타임라인](../timeline.md)과 [GanttRangeBand](markers.md) 참고. |
| `onRangeChange` | `(range: GanttDateRange) => void` | 없음 | 렌더링된 범위가 바뀔 때마다 호출돼요. [타임라인](../timeline.md) 참고. |

## 확대와 스크롤

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `zoomOnWheel` | `boolean` | `false` | Ctrl/Cmd + 휠로 배율 단계를 오르내려요. [타임라인](../timeline.md) 참고. |
| `infiniteScroll` | `boolean` | `false` | 어느 쪽 끝에든 가까워지면 렌더링 범위를 늘려요. [타임라인](../timeline.md) 참고. |
| `initialScrollTo` | `"today" \| string` | 없음 | 타임라인이 처음 렌더링된 뒤 한 번만 스크롤해요. [명령형 API](../imperative-api.md) 참고. |
| `autoScrollOnDrag` | `boolean` | `true` | 뷰포트 가장자리에서 막대를 끌면 타임라인이 스크롤돼요. [작업 편집](../editing.md) 참고. |

## 편집 권한

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `readOnly` | `boolean` | `false` | 모든 작업의 이동, 크기 조절, 진행률 드래그를 막아요. [작업 편집](../editing.md) 참고. |
| `allowMove` | `boolean` | `!readOnly` | 막대 이동을 허용하고 `readOnly`보다 우선해요. [작업 편집](../editing.md) 참고. |
| `allowResize` | `boolean` | `!readOnly` | 막대 크기 조절을 허용하고 `readOnly`보다 우선해요. [작업 편집](../editing.md) 참고. |
| `allowProgressChange` | `boolean` | `!readOnly` | 진행률 핸들 드래그를 허용하고 `readOnly`보다 우선해요. [작업 편집](../editing.md) 참고. |
| `allowTaskCreate` | `boolean` | `!readOnly` | 빈 행 공간에 새 작업을 그리도록 허용해요. [작업 편집](../editing.md) 참고. |
| `allowRowReorder` | `boolean` | `false` | 작업 목록 행을 끌어 순서와 부모를 바꾸도록 허용해요. [행 순서 변경](../reordering.md) 참고. |
| `minDate` | `string` | 없음 | 막대를 끌어 놓을 수 있는 가장 이른 ISO 날짜예요. [작업 편집](../editing.md) 참고. |
| `maxDate` | `string` | 없음 | 막대를 끌어 놓을 수 있는 가장 늦은 ISO 날짜예요. [작업 편집](../editing.md) 참고. |

## 의존성

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `allowLinkCreate` | `boolean` | `!readOnly` | 막대 사이에 의존성을 그리도록 허용해요. [의존성](../dependencies.md) 참고. |
| `allowLinkDelete` | `boolean` | `!readOnly` | 의존성 화살표를 선택해 지우도록 허용해요. [의존성](../dependencies.md) 참고. |
| `onDependencyCreate` | `(change: GanttDependencyChange) => boolean \| void` | 없음 | 그린 링크가 적용되기 전에 실행돼요. `false`면 거부해요. [의존성](../dependencies.md) 참고. |
| `onDependencyDelete` | `(change: GanttDependencyChange) => boolean \| void` | 없음 | 화살표가 지워지기 전에 실행돼요. `false`면 그대로 둬요. [의존성](../dependencies.md) 참고. |

## 스케줄링

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `schedulingPolicy` | `SchedulingPolicy` | `"off"` | 이동이 후행 작업(successor)으로 어떻게 번지는지 정해요. [스케줄링](../scheduling.md) 참고. |
| `onSchedulingCycle` | `(taskIds: string[]) => void` | 없음 | 의존성 순환에 걸린 id와 함께 호출돼요. [스케줄링](../scheduling.md) 참고. |
| `workingCalendar` | `boolean` | `false` | 모든 날짜 계산을 근무일 캘린더로 처리해요. [스케줄링](../scheduling.md) 참고. |
| `criticalPath` | `boolean` | `false` | 임계 경로(critical path)를 계산하고 여유(slack) 필드를 채워요. [스케줄링](../scheduling.md) 참고. |

## 렌더링

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `renderBar` | `GanttBarRenderer` | 없음 — 내장 막대를 써요 | 막대 노드를 통째로 바꿔요. [커스텀 렌더링](../custom-rendering.md)과 [렌더러](renderers.md) 참고. |
| `renderTooltip` | `GanttTooltipRenderer` | 없음 — 내장 툴팁을 써요 | 호버와 드래그 툴팁 노드를 바꿔요. [커스텀 렌더링](../custom-rendering.md)과 [렌더러](renderers.md) 참고. |
| `renderHeaderCell` | `GanttHeaderCellRenderer` | 없음 — 내장 헤더 셀을 써요 | 타임라인 헤더 셀을 두 행 모두에서 바꿔요. [커스텀 렌더링](../custom-rendering.md)과 [렌더러](renderers.md) 참고. |
| `renderBaseline` | `(task: TaskTransformed) => ReactNode` | 없음 — 내장 기준선 막대를 써요 | `baselineStart`가 있는 작업의 기준선 막대를 바꿔요. [스케줄링](../scheduling.md) 참고. |
| `showTooltip` | `boolean` | `true` | 호버와 드래그 툴팁을 보여줘요. [커스텀 렌더링](../custom-rendering.md) 참고. |

## 이벤트

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `onTaskClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` | 없음 | 막대나 행을 클릭할 때 호출되고, 드래그 뒤에는 호출되지 않아요. [이벤트와 취소 가능한 변경](../events.md) 참고. |
| `onTaskDoubleClick` | `(task: TaskTransformed, event: React.MouseEvent) => void` | 없음 | 더블 클릭할 때 호출돼요. [이벤트와 취소 가능한 변경](../events.md) 참고. |
| `onTaskSelect` | `(task: TaskTransformed \| null) => void` | 없음 | 선택이 바뀔 때 호출되고, 빈 타임라인을 클릭하면 `null`이 와요. [이벤트와 취소 가능한 변경](../events.md) 참고. |
| `selectable` | `boolean` | `onTaskSelect !== undefined` | 클릭 선택과 그 강조 표시를 켜요. [이벤트와 취소 가능한 변경](../events.md) 참고. |
| `onBeforeTaskChange` | `GanttBeforeChangeHandler` | 없음 | 이동, 크기 조절, 진행률 변경이 기록되기 전에 실행되고 취소할 수 있어요. [이벤트와 취소 가능한 변경](../events.md)과 [변경](changes.md) 참고. |
| `onTaskCreate` | `(draft: GanttTaskDraft) => void` | 없음 | 빈 행 공간에 그린 범위와 함께 호출돼요. [작업 편집](../editing.md) 참고. |
| `onReorder` | `(change: GanttReorderChange) => void \| boolean` | 없음 | 행 드롭이 확정되기 전에 실행돼요. `false`면 취소해요. [행 순서 변경](../reordering.md) 참고. |

## 로케일과 테마

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `locale` | `string` | 없음 — 내장 영어 라벨을 써요 | 모든 날짜 라벨에 쓰는 BCP 47 태그예요. [로케일과 날짜 형식](../i18n.md) 참고. |
| `formats` | `GanttFormatOverrides` | 없음 — 로케일의 라벨을 써요 | 배율별 `tick` / `header` / `tooltip` 라벨을 덮어써요. [로케일과 날짜 형식](../i18n.md) 참고. |
| `firstDayOfWeek` | `number` | 없음 — 주 단위 묶음이 꺼져요 | `0` = 일요일 .. `6` = 토요일이고, week 배율의 상단 헤더를 묶어요. [로케일과 날짜 형식](../i18n.md) 참고. |
| `theme` | `GanttTheme` | 없음 — 테마 클래스를 붙이지 않아요 | `'light'`, `'dark'`, `'system'` 중 하나예요. [테마](../theming.md) 참고. |

## 저장소

| 프로퍼티 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `storageKey` | `string` | `"gantt-scale"` | 배율 선택을 저장하는 sessionStorage 키예요. [타임라인](../timeline.md) 참고. |
| `historyLimit` | `number` | `100` | 유지할 실행 취소 단계 수예요. `0`이면 실행 취소가 꺼져요. [명령형 API](../imperative-api.md) 참고. |

## 보이는 것과 다른 기본값

- **`showTaskList`**에는 고정된 기본값이 없어요. 생략하면 `columns`를 준 경우에만 패널이 켜져요.
  `columns`만 넘겨도 패널이 켜지고, `showTaskList: true`만 넘기면 `DEFAULT_COLUMNS`로 패널이 보여요.
- **`selectable`**에도 고정된 기본값이 없어요. 생략하면 `onTaskSelect`를 준 경우에만 선택이 켜져요.
  콜백 없이 강조만 쓰려면 `true`, 아예 끄려면 `false`를 넘겨요.
- **`allowMove`, `allowResize`, `allowProgressChange`, `allowTaskCreate`, `allowLinkCreate`,
  `allowLinkDelete`**의 기본값은 `true`가 아니라 `!readOnly`예요. 같은 이름의 작업별 플래그가 차트
  쪽 설정보다 우선하고, 작업 자신의 `readOnly`는 그 둘 사이에 놓여요.
  [GanttInteractionConfig](interaction-config.md) 참고.
- **`allowTaskCreate`**만으로는 아무것도 그려지지 않아요. `onTaskCreate`도 함께 줘야 해요.
- **`defaultScale`**은 제어 값이 아니라 시작 값이에요. 사용자가 고른 배율은 sessionStorage의
  `storageKey`에 저장돼서 다시 마운트할 때 우선해요. 마운트한 뒤에 프로퍼티를 바꿔도 무시돼요.
- **`collapsedIds`**와 **`defaultCollapsedIds`**는 한 값의 제어 쪽과 비제어 쪽이에요. `collapsedIds`를
  넘기면 차트는 그 목록을 보여주고 자체 추적을 멈춰요. `onCollapsedChange`는 두 방식 모두에서 호출돼요.
- **`theme`**을 생략하면 테마 클래스가 전혀 붙지 않고, 호스트 앱이 정해요. `'system'`은 서버 렌더링과
  첫 하이드레이션 렌더에서 `null`로 풀리고, 그다음에 실제 설정으로 바뀌어요.
- **`historyLimit: 0`**은 무제한이라는 뜻이 아니에요. 스택을 비우고 실행 취소를 꺼요.
- **`storageKey`**는 페이지 전체에 하나뿐인 키예요. `"gantt-scale"`을 그대로 둔 차트 두 개는 배율을
  공유하고, 마지막에 바꾼 값이 둘 다에 적용돼요.
- **`visibleStart`**와 **`visibleEnd`**는 서로 독립이에요. 한쪽 끝을 고정하면 그쪽으로는
  `infiniteScroll`이 범위를 늘리지 못하고, 반대쪽은 계속 늘어나요.
- **`workingCalendar`**는 `holidays`와 `isNonWorkingDay`로 캘린더를 만들어요. `showNonWorkingDays`
  음영을 결정하는 설정과 같아요.

## 참고

- `DEFAULT_COLUMNS`는 내부 상수이고 공개 export가 아니에요. 위 표에서 대체 열의 이름을 가리키지만
  패키지에서 import할 수는 없어요. 대신 직접 만든 `columns` 배열을 넘기면 돼요.
  [작업 목록과 계층](../task-list.md) 참고.
- `Dayjs`는 `dayjs` 패키지에서 오고, `ReactNode`와 `React.MouseEvent`는 `react`에서 와요.
  셋 다 이 패키지에서 다시 내보내지 않아요.
- `ReactGanttChart`는 스크롤, 확대, 실행 취소/다시 실행, PNG 내보내기를 위한 `GanttHandle` 타입 `ref`도
  받아요. `GanttProps`의 일부는 아니에요 — [GanttHandle](handle.md) 참고.
