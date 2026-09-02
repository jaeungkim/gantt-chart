# @jaeungkim/gantt-chart — 문서

처음이라면 순서대로 읽어요. 이미 알고 있다면 필요한 문서로 바로 가도 돼요.

## 가이드

| 문서 | 다루는 내용 |
|---|---|
| [소개](introduction.md) | 이 라이브러리가 무엇이고, 무엇을 하지 않는지 |
| [개념과 용어](concepts.md) | 나머지 문서가 쓰는 용어를 한 번에 정리 |
| [빠른 시작](quick-start.md) | 설치부터 편집 가능한 차트까지 |
| [작업 데이터](task-data.md) | `Task` 형태, 날짜 처리, `tasks` prop 비교 방식 |
| [작업 목록과 계층](task-list.md) | 왼쪽 패널, 컬럼, `parentId` 트리 |
| [그룹과 스윔레인](grouping.md) | `groupBy`, 그룹 헤더 행, 레인 |
| [타임라인](timeline.md) | 배율, 범위, 줌, 마커, 비근무일 |
| [작업 편집](editing.md) | 이동, 크기 조절, 진행률, 권한, 터치, 작업 그리기 |
| [의존성](dependencies.md) | 네 가지 링크 타입, 지연, 화살표 그리기 |
| [일정 계산](scheduling.md) | 자동 일정, 근무일 달력, 임계 경로, 베이스라인 |
| [행 재정렬](reordering.md) | 행을 끌어 순서와 부모를 바꾸기 |
| [이벤트와 변경 취소](events.md) | 콜백, 그리고 커밋 전에 편집을 되돌리기 |
| [커스텀 렌더링](custom-rendering.md) | 작업별 색상과 네 가지 render prop |
| [명령형 API](imperative-api.md) | `ref` 핸들: 스크롤, 줌, 실행 취소, PNG 내보내기 |
| [키보드와 스크린 리더](accessibility.md) | 키 맵, ARIA 트리, 그리고 빈틈 |
| [로케일과 날짜 형식](i18n.md) | `locale`, 배율별 재정의, 주 시작 요일 |
| [테마](theming.md) | theme prop과 CSS 커스텀 속성 |
| [헤드리스 코어](headless-core.md) | React와 DOM 없이 일정 계산하기 |

## 레퍼런스

| 문서 | 심볼 |
|---|---|
| [GanttProps](ref/props.md) | 컴포넌트가 받는 모든 prop |
| [Task와 작업 타입](ref/task.md) | `Task`, `TaskDependency`, `DependencyType`, `TaskType`, `TaskTransformed` |
| [GanttInteractionConfig](ref/interaction-config.md) | `GanttInteractionConfig`와 권한 결정 순서 |
| [GanttColumn](ref/columns.md) | `GanttColumn` |
| [그룹 타입](ref/grouping.md) | `GanttGroupBy`, `GanttRow`, `GanttRowGroup` |
| [마커와 범위 밴드](ref/markers.md) | `GanttMarker`, `GanttRangeBand`, `GanttDateRange` |
| [Render prop 타입](ref/renderers.md) | `GanttBarRenderer`, `GanttTooltipRenderer`, `GanttHeaderCellRenderer` |
| [변경과 초안 타입](ref/changes.md) | `GanttTaskChange`, `GanttReorderChange`, `GanttDependencyChange`, `GanttTaskDraft` |
| [GanttHandle](ref/handle.md) | `GanttHandle`, `GanttScrollApi`, `GanttScrollOptions`, `GanttZoomAnchor` |
| [GanttHistoryApi](ref/history.md) | `GanttHistoryApi` |
| [PNG 내보내기](ref/export.md) | `GanttExportApi`, `GanttExportOptions`, `GanttExportRange` |
| [배율과 테마 타입](ref/scales.md) | `GanttScaleKey`, `GanttScaleFormat`, `GanttFormatOverrides`, `GanttTheme` |
| [scheduleTasks](ref/core-scheduling.md) | `scheduleTasks`, `SchedulingPolicy`, `ScheduleOptions`, `ScheduleResult` |
| [작업 그래프 헬퍼](ref/core-graph.md) | `buildTaskGraph`, `canLink`, `findPath`, `linkKey`, `TaskGraph` |
| [트리 헬퍼](ref/core-tree.md) | `buildTaskTree`, `collectSubtreeIds`, `rollUpTasks`, `TaskTree` |
| [임계 경로](ref/core-critical-path.md) | `computeCriticalPath`, `forwardPass`, `backwardPass` |
| [근무일 달력](ref/core-calendar.md) | `createWorkingCalendar`, `CALENDAR_DAYS`, `WorkingCalendar` |

English documentation is at [../en/](../en/).
