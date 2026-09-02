사용자가 막대 여섯 개를 연달아 끌고 나서 `Ctrl+Z`를 눌러요. 직접 만든 툴바의 "오늘" 버튼은 차트의 스크롤 위치를 옮겨야 해요. 누군가 "내보내기"를 누르면 화면에 보이는 그대로의 PNG를 기대해요. 이 중 어느 것도 prop이 아니에요. 전부 차트의 ref를 거쳐요.

## 핸들

`ReactGanttChart`는 `forwardRef`로 감싸져 있어요. `useRef<GanttHandle>`를 연결하면 마운트 이후 ref에 멤버 열 개가 담겨요.

```tsx
// src/ChartWithControls.tsx
import { useRef } from 'react';
import { ReactGanttChart, type GanttHandle, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

export function ChartWithControls({ tasks }: { tasks: Task[] }) {
  const ganttRef = useRef<GanttHandle>(null);

  return (
    <>
      <button onClick={() => ganttRef.current?.scrollToToday()}>Today</button>
      <ReactGanttChart ref={ganttRef} tasks={tasks} />
    </>
  );
}
```

`GanttHandle`은 인터페이스 세 개를 교차한 타입이고, 그 자체로 더하는 건 없어요.

| 멤버 | 시그니처 | 하는 일 |
|---|---|---|
| `scrollToDate` | `(date: string \| Date \| Dayjs, options?: GanttScrollOptions) => void` | 날짜 위치로 가로 스크롤해요 |
| `scrollToToday` | `(options?: GanttScrollOptions) => void` | `scrollToDate(dayjs())` |
| `scrollToTask` | `(taskId: string, options?: GanttScrollOptions) => void` | 작업의 막대로 스크롤해요. 행이 화면 밖이면 세로로도 움직여요 |
| `zoomToFit` | `() => void` | 모든 작업이 보이는 가장 촘촘한 배율을 골라 프로젝트 시작을 왼쪽 끝에 고정해요 |
| `getScrollElement` | `() => HTMLDivElement \| null` | 스크롤 컨테이너 DOM 노드를 돌려줘요 |
| `exportToPng` | `(options?: GanttExportOptions) => Promise<Blob>` | 차트를 래스터화해서 PNG blob으로 resolve해요 |
| `undo` | `() => void` | 가장 최근 제스처를 되돌려요 |
| `redo` | `() => void` | 가장 최근에 되돌린 제스처를 다시 실행해요 |
| `canUndo` | `boolean` | 되돌릴 제스처가 있는지 여부 |
| `canRedo` | `boolean` | 다시 실행할 제스처가 있는지 여부 |

인터페이스 세 개는 `GanttScrollApi`, `GanttExportApi`, `GanttHistoryApi`로 따로 export돼요. `GanttScrollApi`와 `GanttScrollOptions`, `GanttHandle` 자신은 [GanttHandle](ref/handle.md)에 선언돼 있어요. `GanttExportApi`는 [GanttExportApi](ref/export.md)에, `GanttHistoryApi`는 [GanttHistoryApi](ref/history.md)에 있어요.

`canUndo`와 `canRedo`는 핸들 위의 getter예요. 복사해 둔 boolean 값이 아니에요. 읽을 때마다 스토어를 조회해요. 구조 분해로 꺼내면 그 순간의 값이 고정돼 다시는 갱신되지 않아요.

## 스크롤

스크롤 메서드는 모두 같은 옵션 객체를 받아요.

| 옵션 | 값 | 기본값 | 규칙 |
|---|---|---|---|
| `smooth` | `boolean` | 애니메이션 적용 | 애니메이션은 리터럴 `false`일 때만 꺼져요. `undefined`는 애니메이션으로 움직여요 |
| `align` | `'start' \| 'center'` | `'center'` | 리터럴 `'start'`일 때만 start 분기를 타요 |

`align: 'start'`는 대상을 타임라인 영역의 왼쪽 끝에 놓아요. `align: 'center'`는 타임라인 영역 안에서 가운데에 맞춰요. 이때 고정된 작업 목록 창의 너비를 뷰포트 너비에서 빼요. 두 경우 모두 `0`에서 잘려요. 그래서 범위 앞쪽에 가까운 날짜는 차트가 갈 수 있는 가장 왼쪽에 놓여요.

```ts
ganttRef.current?.scrollToDate('2026-09-01', { smooth: false, align: 'start' });
ganttRef.current?.scrollToToday();
ganttRef.current?.scrollToTask('task-42');
```

`scrollToDate`와 `scrollToToday`는 가로축만 움직여요. 둘 다 `scrollTop`은 건드리지 않아요.

`scrollToTask`는 두 축을 모두 움직여요. 가로로는 `align: 'start'`일 때 막대의 왼쪽 끝을, 그 외에는 막대의 중간 지점을 겨냥해요. 세로로는 행이 뷰포트 밖에 있을 때만 동작하고, 그때 행을 가운데로 맞춰요. `align`은 세로축에 아무 영향이 없어요.

이 메서드들은 하나같이 조용히 실패해요. 렌더링 범위 밖의 날짜, 알 수 없는 작업 id, 아직 마운트되지 않은 차트는 모두 조기 반환해요. 예외도 콘솔 출력도 없어요. 데이터를 불러오는 중에 호출해도 안전하도록 일부러 그렇게 뒀어요.

`scrollToTask`는 렌더링된 행만 뒤져요. 접힌 부모나 접힌 그룹 아래의 작업은 그 목록에 없어요. 그래서 호출해도 아무 일이 일어나지 않아요. 행을 먼저 펼쳐 주세요. 접힘 상태는 [작업 목록과 계층](task-list.md)에서 다뤄요.

## 줌

`zoomToFit()`는 렌더링된 작업 중 가장 이른 `startDate`와 가장 늦은 `endDate`를 읽어요. 그다음 배율 사다리를 촘촘한 쪽에서 성긴 쪽으로 훑어요. 순서는 `hour`, `day`, `week`, `month`, `quarter`, `year`예요. 전체 구간이 타임라인 너비에 들어가는 첫 배율을 골라요. 아무것도 맞지 않으면 `year`에 멈춰요. 가장 이른 날짜는 타임라인 왼쪽 끝에 고정돼요.

옵션은 받지 않아요. 결과 스크롤은 언제나 즉시 이뤄져요. 기준점을 `scrollTo({ behavior })`가 아니라 `scrollLeft`에 직접 대입해서 적용하기 때문이에요.

들어맞는지는 실제로 만들어질 눈금이 아니라, 배율별 평균 밀리초당 px 값으로 재요. 눈금 길이가 고정된 배율에서는 이 값이 정확해요. 반면 `quarter`와 `year`는 눈금이 28~31일짜리 달이라 근삿값이에요. 그래서 구간이 뷰포트 너비와 몇 퍼센트 차이로 갈리면 옆 배율이 뽑히기도 해요.

작업이 없을 때, 마운트된 스크롤 요소가 없을 때, 최소나 최대 날짜가 유한한 수가 아닐 때는 조용히 빠져나와요.

핸들에는 `setScale`, `zoomIn`, `zoomOut`이 없어요. 배율이 바뀌는 나머지 두 경로는 내장 선택기와 `Ctrl`/`Cmd` + 휠이에요. 둘 다 [타임라인](timeline.md)에서 설명해요.

`GanttZoomAnchor`는 패키지에서 export되지만, 핸들의 어느 멤버도 이 값을 받지 않아요. API 표면에서 눈에 띄는 타입일 뿐, 넘길 수 있는 값은 아니에요.

## 실행 취소와 다시 실행

사용자 제스처 하나가 단계 하나예요. 행 스무 개를 옮긴 하위 트리 드래그도 한 번 누르면 되돌아가요. 제스처 전체가 한 번에 커밋되기 때문이에요.

단계를 기록하는 제스처는 이것들이에요.

| 제스처 | 기록 |
|---|---|
| 막대 이동이나 크기 조절. 연쇄 일정 재계산과 하위 트리 전체 드래그 포함 | 단계 하나 |
| 진행률 핸들 드래그 | 단계 하나 |
| 작업 목록에서 행 순서 변경이나 부모 변경 | 단계 하나 |
| 의존성 연결 그리기 | 단계 하나 |
| 의존성 화살표 삭제 | 단계 하나 |
| 키보드 미세 이동, 키보드 진행률 `+`/`-` | 각각 단계 하나 |

키보드 `Delete`는 같은 커밋 경로를 타지만 단계를 기록하지 않아요. 행을 지우는데 패치 모델은 그걸 되돌릴 수 없어요. 그래서 대신 히스토리를 비워요.

단계는 작업 배열의 사본이 아니라 달라진 필드만 저장해요. 아무것도 바꾸지 않은 제스처는 단계가 아니에요. 새 단계를 넣으면 다시 실행 스택이 비워져요.

실행 취소와 다시 실행은 드래그 커밋과 똑같이 `onTasksChange`로 결과를 알려요. `onUndo`도, `onRedo`도, `onHistoryChange`도 없어요. 두 동작은 `onBeforeTaskChange`를 다시 거치지 않아서 거부할 수 없어요. 그래서 [이벤트와 취소 가능한 변경](events.md)에서 설명하는 관문은 이 둘을 영영 보지 못해요.

### 키보드 단축키

차트의 루트 요소는 히스토리 전용 키 핸들러를 직접 들고 있어요.

| 키 | 동작 |
|---|---|
| `Ctrl+Z`, `Cmd+Z` | 실행 취소 |
| `Ctrl+Shift+Z`, `Cmd+Shift+Z`, `Ctrl+Y`, `Cmd+Y` | 다시 실행 |
| 위 조합에 `Alt`/`Option`을 함께 누른 경우 | 무시 |

두 플랫폼의 관례를 모든 플랫폼에서 받아들여요. 이벤트 대상이 `INPUT`, `TEXTAREA`, `SELECT`, `contenteditable` 요소면 키 입력을 무시해요. 덕분에 텍스트 필드는 자기 실행 취소를 그대로 써요.

루트 요소는 `tabIndex={-1}`이에요. 차트를 클릭하면 포커스가 잡히지만 탭 순서에는 들어가지 않아요. 그래서 페이지의 다른 곳에서 누른 `Ctrl+Z`는 아무 일도 하지 않아요. 그리드의 방향키와 `Home`, `End`는 별도 핸들러예요. [키보드와 스크린 리더](accessibility.md)에 정리돼 있어요.

### `historyLimit`

`historyLimit`은 보관할 단계 수예요. 기본값은 `100`이에요. 이 prop은 이펙트에서 적용돼요. 그래서 값을 바꾼 렌더 다음의 커밋 한 번이 지나야 반영돼요.

`0`은 "기록 일시 정지"가 아니에요. 두 스택을 비우고 기록을 멈춰요. 나중에 한도를 올려도 되돌아오는 건 없어요. 음수도 똑같이 동작해요.

한도를 낮추면 실행 취소 스택에서 가장 오래된 단계부터 버려요. 다시 실행 스택은 건드리지 않아요. 다섯 단계를 되돌린 뒤 `historyLimit={2}`로 바꿔도 다섯 개 모두 다시 실행할 수 있어요.

### 스택을 비우는 것

| 조건 | 결과 |
|---|---|
| 차트가 들고 있는 것과 내용이 다른 `tasks` prop | 두 스택 모두 비워짐 |
| 마지막 커밋과 바이트 단위로 똑같은 `tasks` prop | 아무 일 없음. 히스토리 유지 |
| 행을 추가하거나 제거하거나 id를 교체하는 커밋 | 두 스택 모두 비워지고, 그 커밋 자체도 되돌릴 수 없음 |
| `historyLimit`이 `0` 이하 | 두 스택 모두 비워짐 |
| 배율 변경, 줌, 스크롤, 접기, 선택 | 아무 일 없음 |
| 언마운트 | 스토어가 컴포넌트와 함께 사라짐 |

같은 데이터인지 판단하는 검사는 `JSON.stringify(state.rawTasks) === JSON.stringify(raw)`예요. 날짜를 다시 직렬화했거나, 선택 키를 하나 더 넣었거나, 키 순서만 달라도 "호스트 앱이 데이터를 교체했다"로 읽혀요. `onTasksChange`가 건넨 배열을 그대로 돌려주세요. 그러지 않으면 제스처마다 방금 기록한 히스토리를 지워요.

> [!WARNING]
> 포커스된 막대에서 `Delete`나 `Backspace`를 누르면 그 작업과 하위 트리 전체가 사라져요. 행 개수가 바뀌었으니 어떤 필드 패치로도 되돌릴 수 없어요. 삭제는 그대로 반영되고, 히스토리 전체가 비워지고, 삭제 자체는 되돌릴 수 없어요. 행 추가와 제거는 애초에 패치 모델 밖이에요. 실행 취소는 이미 있던 행의 필드 변경만 표현해요.

## PNG 내보내기

`exportToPng()`는 MIME 타입이 `image/png`인 `Blob`으로 resolve해요. data URL도 아니고 다운로드도 아니에요. 그 blob을 어떻게 할지는 호스트 앱이 정해요.

| 옵션 | 타입 | 기본값 |
|---|---|---|
| `pixelRatio` | `number` | `2` |
| `background` | `string`, 모든 CSS 색상 | `.gantt-container`의 계산된 `background-color`. 비었거나 투명하면 `#ffffff` |
| `range` | `{ from, to }`, 각 값은 `string \| Date \| Dayjs` | 타임라인 전체 |

배경은 이미지를 그리기 전에 칠해요. `foreignObject` 렌더는 아무것도 칠하지 않은 곳이 투명해요. 그래서 이 채움이 없으면 다크 테마 내보내기가 투명한 채로 나와요.

`range`는 가로 방향을 잘라요. `from`과 `to`는 순서를 바꿔 넣어도 되고, 구간은 알아서 정규화돼요. 타임라인보다 이른 날짜는 왼쪽 끝에, 타임라인을 지난 날짜는 오른쪽 끝에 맞춰져요. 타임라인 밖에 완전히 벗어난 범위는 예외를 던져요. 타임라인 폭이 1픽셀도 안 되게 계산된 범위도 마찬가지예요. `year` 배율에서는 약 여섯 시간보다 짧은 구간이 여기 해당해요.

해상도는 캔버스가 감당할 수 있는 값으로 제한돼요. 한 변 16384px, 면적 268,435,456px이에요. 요청한 `pixelRatio`는 여기에 맞게 낮춰져요. 그래서 아주 넓은 차트는 잘리는 대신 축소돼서 나와요. `pixelRatio`가 `0`이거나 음수이거나 `NaN`이면 `1`로 대체된 뒤 다른 값과 똑같이 제한돼요. 원래 밀도로 일부만 담고 싶으면 `range`를 쓰세요.

### 무엇이 담기나

캡처 대상은 차트 스크롤 컨테이너의 복제본이에요. 캡처하는 동안 행과 헤더 열 양쪽의 가상화가 꺼져요. 그래서 화면에 보이던 것만이 아니라 모든 행과 모든 헤더 셀이 이미지에 들어가요. 캡처가 성공하든 예외를 던지든 스크롤 위치는 나중에 원래대로 돌아와요.

기다리는 행 수는 렌더링된 행 수예요. 접힌 부모나 접힌 그룹 아래에 숨은 행은 렌더링되지 않아요. 그래서 접힌 차트는 접힌 채로 내보내져요. 툴바와 배율 선택기는 스크롤 컨테이너 밖에 있어서 이미지에 들어가지 않아요.

네트워크에서 가져오는 건 없어요. 내보내기는 메모리에서 SVG `data:` URL을 만들어 캔버스에 그려요. 쓰는 건 `cloneNode`, `getComputedStyle`, `XMLSerializer`, `Image`, `<canvas>`, `requestAnimationFrame`뿐이에요. 네트워크 요청도 없고, 패키지가 끌어오는 래스터화 의존성도 없어요. 런타임 의존성은 `@tanstack/react-virtual`, `dayjs`, `zustand`가 전부예요.

### 오류

모든 reject는 메시지 앞에 `exportToPng: `가 붙은 평범한 `Error`예요.

| 메시지 | 조건 |
|---|---|
| `no Gantt chart is mounted.` | ref에 스크롤 요소가 없음 |
| `the chart container is not in the DOM.` | `.gantt-container` 조상이 없음 |
| `the chart has no timeline to export (no tasks).` | 타임라인 셀이 없거나 전체 너비가 1px 미만 |
| `the requested range does not overlap the chart's timeline.` | 계산된 범위의 너비가 1px 미만 |
| `timed out waiting for all N rows to render.` | 전체 행 수가 차기 전에 애니메이션 프레임 60번이 지남 |
| `the chart has no content to export (no timeline is rendered).` | 복제 원본에 `.gantt-content`가 없음 |
| `the chart has no content to export.` | 측정된 너비나 높이가 1px 미만 |
| `the browser refused to rasterize the chart. …` | SVG data URL을 이미지로 불러오지 못함 |
| `could not get a 2D canvas context.` | `getContext('2d')`가 null을 반환 |
| `the canvas produced no PNG data.` | `toBlob`이 null로 콜백 |
| `the canvas is tainted, so it cannot be read back. …` | 교차 출처 이미지나 폰트가 차트에 들어옴 |

범위는 차트가 내보내기 모드로 들어가기 전에 계산돼요. 그래서 잘못된 범위는 사용자가 보고 있는 화면을 흔들지 않고 reject돼요.

## ref에 연결한 툴바

버튼이 다시 렌더링되는 건 `onTasksChange`가 모든 제스처, 모든 실행 취소, 모든 다시 실행에서 호출되기 때문이에요. 차트가 `canUndo`와 `canRedo`를 바꿀 때는 언제나 그 호출이 함께 와요. 그래서 렌더 중에 getter를 읽는 게 맞아요.

```tsx
// src/GanttToolbar.tsx
import { useRef, useState } from 'react';
import { ReactGanttChart, type GanttHandle, type Task } from '@jaeungkim/gantt-chart';
import '@jaeungkim/gantt-chart/style.css';

export function GanttToolbar({ initialTasks }: { initialTasks: Task[] }) {
  const ganttRef = useRef<GanttHandle>(null);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [exportError, setExportError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    setExportError(null);
    try {
      const blob = await ganttRef.current!.exportToPng({ pixelRatio: 2 });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gantt.png';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div>
        {/* getter는 여기서 읽어요. `const { canUndo } = ganttRef.current`는 절대 안 돼요 */}
        <button onClick={() => ganttRef.current?.undo()} disabled={!ganttRef.current?.canUndo}>
          Undo
        </button>
        <button onClick={() => ganttRef.current?.redo()} disabled={!ganttRef.current?.canRedo}>
          Redo
        </button>
        <button onClick={handleExport} disabled={busy}>
          {busy ? 'Exporting…' : 'Export PNG'}
        </button>
        {exportError && <span role="alert">{exportError}</span>}
      </div>

      {/* setTasks가 차트에서 건네받은 배열을 그대로 저장해서 히스토리가 살아남아요 */}
      <ReactGanttChart
        ref={ganttRef}
        tasks={tasks}
        onTasksChange={setTasks}
        historyLimit={50}
      />
    </>
  );
}
```

## 한계

- **히스토리는 들여다볼 수도, 비울 수도, 묶을 수도 없어요.** `clearHistory`도, 트랜잭션 API도, 스택을 읽는 방법도 없어요. 관찰할 수 있는 상태는 `canUndo`와 `canRedo`뿐이에요.
- **행 추가와 제거는 되돌릴 수 없어요.** 패치 모델은 이미 있는 행의 필드 변경을 표현해요. 그 밖의 변경은 단계를 기록하는 대신 스택을 비워요.
- **아무것도 저장되지 않아요.** 히스토리는 언마운트에서, 페이지 새로고침에서, 호스트 앱이 `tasks`를 교체할 때 사라져요. `sessionStorage`에 적히는 건 선택된 배율뿐이에요.
- **`canUndo`와 `canRedo`는 아무것도 구독하지 않아요.** 다시 렌더링될 이유가 따로 없는 툴바는 낡은 활성 상태를 보여줘요. `onTasksChange`에서 다시 렌더링하세요.
- **`exportToPng`는 동시에 실행하면 안전하지 않아요.** 내보내기 모드는 boolean 하나예요. 첫 호출의 정리 작업이 이 값을 끄는 동안 두 번째 호출이 아직 캡처 중일 수 있어요. 다음 내보내기를 시작하기 전에 앞의 것을 await 하세요.
- **내보내기에는 진행률 콜백도, 취소도, 타임아웃 옵션도 없어요.** 애니메이션 프레임 60번 안에 렌더링하기엔 너무 큰 차트는 reject되고, 이 60은 올릴 수 없어요.
- **복제본에는 화이트리스트에 든 계산 스타일만 넘어가요**: HTML 속성 67개와 SVG 페인트 속성 15개예요. `filter`, `clip-path`, `background-size`, `background-position`, `background-repeat`, `text-decoration`, `outline`은 버려지는 쪽이에요. 그래서 커스텀 스타일시트는 PNG와 화면에서 다르게 보일 수 있어요.
- **의사 요소는 아예 캡처되지 않아요.** `::before`와 `::after`의 내용은 이미지에 없어요.
- **래스터화 중에 웹폰트를 내려받지 않아요.** 브라우저가 이미 갖고 있는 폰트만 그려져요. 교차 출처 폰트나 이미지는 캔버스를 오염시키고, 내보내기는 reject돼요.
- **캡처 프레임의 크기는 타임라인 너비만으로 정해지고**, 작업 목록 창이 결과물에 어떻게 나오는지는 어떤 테스트도 다루지 않아요. `showTaskList`를 켠 채 PNG를 내보낼 거라면 직접 짠 레이아웃으로 결과를 먼저 확인하세요.
- **내보내기 형식은 PNG뿐이에요.** SVG도, PDF도, CSV도, 클립보드 출력도 없어요. 형식이나 품질 옵션, 파일 이름, DPI 메타데이터, 세로 행 범위 자르기도 없어요. PDF는 blob을 감싸는 호스트 앱 쪽 코드예요.
- **세로 스크롤 API는 없어요.** `scrollToRow`도, 스크롤 위치를 읽는 getter도 없어요. `getScrollElement()`가 원본 DOM 노드를 돌려주니 직접 다뤄야 해요.
- **스크롤과 줌 메서드는 실패를 알리지 않아요.** 범위 밖 날짜와 알 수 없는 id는 바깥에서 보면 성공과 똑같아요.

다음: [키보드와 스크린 리더](accessibility.md) — treegrid 구조와 그리드가 처리하는 모든 키.
