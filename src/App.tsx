import Gantt from "pages/Gantt";
import { useEffect, useRef } from "react";
import { GanttHandle } from "hooks/useGanttScrollApi";
import { GanttMarker, GanttRangeBand } from "types/gantt";
import { sourceTasks } from "../db";

// Dev playground only (not part of the published package) - append ?locale=ko-KR to
// preview the localized labels
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const markers: GanttMarker[] = [
  { id: "release", date: day(9), label: "Release 1.0" },
  { id: "deadline", date: day(4), label: "Deadline", warnOnOverrun: true },
];

const rangeBands: GanttRangeBand[] = [
  { id: "sprint-1", startDate: day(-2), endDate: day(5), label: "Sprint 1" },
];

function App() {
  const ref = useRef<GanttHandle>(null);

  // Playground convenience - `gantt.current.scrollToToday()` from the devtools console.
  // The ref object itself, not its value: the handle behind it is rebuilt as data changes.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).gantt = ref;
  }, []);

  return (
    <Gantt
      ref={ref}
      tasks={sourceTasks}
      height="100svh"
      width="100%"
      locale={locale}
      firstDayOfWeek={weekStart === null ? undefined : Number(weekStart)}
      showTaskList
      hierarchy
      zoomOnWheel
      infiniteScroll
      markers={markers}
      rangeBands={rangeBands}
      allowRowReorder
    />
  );
}

export default App;
