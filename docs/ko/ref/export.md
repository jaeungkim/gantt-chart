`exportToPng`은 차트를 래스터화해서 PNG `Blob`을 돌려줘요. ref 핸들에 붙어 있는 메서드라, 아래 세
타입이 그 옵션과 날짜 범위를 설명해요. 패키지 루트에서 import 해요.

```tsx
import type {
  GanttExportApi,
  GanttExportOptions,
  GanttExportRange,
} from '@jaeungkim/gantt-chart';
```

`GanttExportApi`는 [`GanttHandle`](handle.md)이 확장하는 세 인터페이스 중 하나예요. 그래서 이 메서드는
`ref`로 호출해요. 호출 방식은 [명령형 API](../imperative-api.md)를 참고하세요.

## GanttExportApi

```ts
/** 명령형 내보내기 API */
export interface GanttExportApi {
  /**
   * 차트 전체를 PNG로 렌더링하고 blob으로 resolve 해요
   *
   * 다운로드는 일어나지 않아요 - blob을 어떻게 쓸지는 호출한 쪽이 정해요
   * (저장하거나, 업로드하거나, PDF에 넣거나).
   */
  exportToPng: (options?: GanttExportOptions) => Promise<Blob>;
}
```

### 반환값

`Promise<Blob>`이에요. blob의 MIME 타입은 `image/png`이고, `canvas.toBlob(cb, 'image/png')`이 만들어요.
데이터 URL도, `<img>`도, 다운로드도 아니에요. 디스크에 쓰는 것도 없고 앵커를 클릭하지도 않아요.

실패하면 프로미스는 평범한 `Error`로 reject 돼요. 메시지 앞에는 항상 `exportToPng: `가 붙어요.

| 메시지 | 조건 |
|---|---|
| `no Gantt chart is mounted.` | 차트의 스크롤 엘리먼트가 ref에 없을 때 |
| `the chart container is not in the DOM.` | 스크롤 엘리먼트에 `.gantt-container` 조상이 없을 때 |
| `the chart has no timeline to export (no tasks).` | 헤더 셀이 없거나, 타임라인이 1px보다 좁을 때 |
| `the requested range does not overlap the chart's timeline.` | 해석된 `range`가 1px보다 좁을 때 |
| `timed out waiting for all N rows to render.` | 애니메이션 프레임 60번이 지나도 모든 행이 DOM에 없을 때 |
| `the chart has no content to export (no timeline is rendered).` | 복제할 `.gantt-content` 엘리먼트가 없을 때 |
| `the chart has no content to export.` | 측정한 복제본의 너비나 높이가 1px보다 작을 때 |
| `the browser refused to rasterize the chart. This usually means the chart contains a resource the SVG renderer cannot inline.` | 직렬화한 SVG를 이미지로 불러오지 못했을 때 |
| `could not get a 2D canvas context.` | `getContext('2d')`가 `null`을 반환했을 때 |
| `the canvas produced no PNG data.` | `toBlob`이 `null`로 콜백했을 때 |
| `the canvas is tainted, so it cannot be read back. A cross-origin image or font reached the chart. (<error>)` | `toBlob`이 예외를 던졌을 때. 교차 출처 이미지나 폰트가 차트에 들어와 있어요. 던져진 값이 괄호 안에 덧붙어요 |

범위는 차트가 내보내기 모드로 들어가기 전에 해석돼요. 그래서 잘못된 `range`는 화면을 건드리지 않고
reject 돼요. 캡처가 성공하든 실패하든 스크롤 위치와 가상화는 원래대로 돌아와요.

## GanttExportOptions

```ts
/** `GanttHandle.exportToPng`의 옵션 */
export interface GanttExportOptions {
  /**
   * 결과물의 픽셀 밀도 (기본값 2)
   *
   * 캔버스가 브라우저 한계를 넘을 것 같으면 자동으로 낮춰요 - 아주 넓은
   * 타임라인은 실패하는 대신 축소돼요.
   */
  pixelRatio?: number;
  /** 배경색 (임의의 CSS 색상). 기본값은 해석된 테마 배경색이에요. */
  background?: string;
  /**
   * 내보낼 날짜 범위를 잘라내요
   *
   * 타임라인 밖의 날짜는 양 끝으로 맞춰져요. 생략하면 타임라인 전체를
   * 내보내요.
   */
  range?: GanttExportRange;
}
```

| 옵션 | 타입 | 단위 | 기본값 | 의미 |
|---|---|---|---|---|
| `pixelRatio` | `number` | CSS 픽셀당 디바이스 픽셀 | `2` | 출력 밀도예요. 캔버스가 브라우저 한계를 넘을 것 같으면 낮춰서 맞춰요. `0`, 음수, 유한하지 않은 값은 `1`로 대체돼요. |
| `background` | `string` | 임의의 CSS 색상 | `.gantt-container`의 계산된 `background-color`. 그 값이 비었거나 `transparent`, `rgba(0, 0, 0, 0)`이면 `#ffffff` | 차트를 그리기 전에 아래에 칠해요. |
| `range` | `GanttExportRange` | — | 타임라인 전체 | 출력을 날짜 범위로 잘라내요. |

기본 배경색은 컨테이너의 `--gantt-background`에서 와요. 이 변수는 [테마](../theming.md)에서 다뤄요.

최종 캔버스 크기는 디바이스 픽셀 기준으로
`max(1, round(width × scale))` × `max(1, round(height × scale))`이에요.
여기서 `scale`은 조정을 거친 `pixelRatio`예요.

## GanttExportRange

```ts
/** 내보내기를 잘라낼 날짜 범위 */
export interface GanttExportRange {
  from: string | Date | Dayjs;
  to: string | Date | Dayjs;
}
```

두 필드 모두 필수예요. 각 값은 `dayjs()`를 거치니까 `Dayjs`, `Date`, 그리고 `dayjs`가 파싱하는 문자열이면
다 받아요. `Dayjs`는 dayjs 자체 타입이에요. 이 패키지가 다시 export 하지는 않으니, 이름이 필요하면
`dayjs`에서 import 하세요.

| 경우 | 결과 |
|---|---|
| `range`를 생략 | 타임라인 전체를 내보내요 |
| `from`이 `to`보다 뒤 | 받아들여요. 범위를 정규화해서 이른 날짜가 시작이 돼요 |
| `from`이 타임라인 시작보다 앞 | 타임라인 왼쪽 끝으로 맞춰요 |
| `to`가 타임라인 끝보다 뒤 | 타임라인 오른쪽 끝으로 맞춰요 |
| 범위가 타임라인 바깥으로 완전히 벗어남 | `does not overlap the chart's timeline.`으로 reject 해요 |
| 타임라인에 헤더 셀이 없는데 `range`를 지정 | 무시해요. 타임라인 전체를 내보내요 |

겹침 검사는 날짜가 아니라 픽셀로 해요. 타임라인에서 1px 미만으로 계산되는 범위는 날짜가 차트 안에
있더라도 겹치지 않는 것으로 보고 거절해요. `year` 배율에서 30분짜리 범위가 그런 경우예요.

## 제약

캡처는 차트에서 떼어낸 복제본을 SVG `foreignObject`로 직렬화한 뒤, 그것을 캔버스에 그려요. 아래 한계는
이 방식에서 나와요.

- 화이트리스트에 있는 스타일만 복제본으로 넘어가요. `getComputedStyle`에서 HTML 속성 67개와 SVG 속성
  15개를 복사해요. 목록 밖의 값은 PNG에 없어요. `background-position`, `background-size`,
  `background-repeat`, `text-decoration`, `filter`, `clip-path`, `outline`이 여기에 해당해요.
  `background-image`는 복사하지만, 짝이 되는 속성이 없어서 초기 위치와 크기, 반복으로 그려져요. 이
  화이트리스트 덕분에 직렬화한 마크업이 전체 계산 스타일 덤프보다 한 자릿수 작아요.
- `display`는 SVG 목록에서 일부러 뺐어요. `<defs>` 안의 `<marker>`에 강제로 붙으면 의존성 화살촉이
  사라질 수 있기 때문이에요.
- 가상 요소는 캡처하지 않아요. 실제 엘리먼트만 순회하기 때문에 `::before`와 `::after`는 나오지 않아요.
- 브라우저가 이미 가진 폰트만 그려져요. `foreignObject` 래스터화는 웹폰트를 가져올 수 없어요. 텍스트는
  브라우저가 로컬에서 찾을 수 있는 폰트로 대체돼요.
- 교차 출처 이미지나 폰트는 캔버스를 오염시켜요. 그러면 `toBlob`이 예외를 던지고, 프로미스는 오염
  에러로 reject 돼요. 번들된 스타일시트는 원격 리소스를 불러오지 않아요. 그래서 오염은 호스트 앱의
  콘텐츠에서 와요. `renderBar`의 아바타, 커스텀 컬럼의 로고 같은 것들이에요.
- 큰 차트는 잘라내지 않고 축소해요. 캔버스는 한 변 16384px, 면적 268,435,456px가 상한이에요. 둘 중
  하나라도 넘으면 브라우저는 에러 없이 빈 캔버스를 내놔요. 내보내기는 두 한계 아래에 머물도록
  `pixelRatio`를 낮춰요. 아주 넓은 차트를 원래 밀도로 잘라 받고 싶다면, `pixelRatio`를 올리지 말고
  `range`를 넘기세요.
- 스크롤 컨테이너만 캡처해요. 툴바와 배율 선택기, `aria-live` 영역은 그 바깥에 있어서 이미지에 담기지
  않아요.
- 차트는 지금 상태 그대로 나가요. 캡처 동안 가상화는 꺼지니까 모든 행과 헤더 셀이 래스터화돼요. 접힘
  상태는 그렇지 않아요. 접힌 부모나 접힌 그룹 아래 숨은 행은 렌더링되지 않아서, 접힌 차트는 접힌 채로
  나와요.
- 캡처는 차트 전체를 DOM에 올려 둬요. 걸리는 몇 프레임 동안 모든 행과 헤더 셀이 살아 있고, 그 서브트리의
  전체 복제본까지 함께 있어요. 행을 기다리는 로직은 애니메이션 프레임 60번이면 포기해요.
- 네트워크 요청은 없어요. SVG는 메모리에서 만든 `data:` URL이고, 내보내기 때문에 추가되는 의존성도
  없어요. `cloneNode`, `getComputedStyle`, `XMLSerializer`, `Image`, `<canvas>`,
  `requestAnimationFrame`이 전부 처리해요.
