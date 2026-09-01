import Gantt from "pages/Gantt";
import { sourceTasks } from "../db";

// Dev playground only (not part of the published package) - append ?locale=ko-KR to
// preview the localized labels
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");

function App() {
  return (
    <Gantt
      tasks={sourceTasks}
      height="100svh"
      width="100%"
      locale={locale}
      firstDayOfWeek={weekStart === null ? undefined : Number(weekStart)}
      showTaskList
      hierarchy
    />
  );
}

export default App;
