import Gantt from "pages/Gantt";
import { sourceTasks } from "../db";
import type { Task } from "types/task";

// Dev playground only (not part of the published package) - append ?locale=ko-KR to
// preview the localized labels, ?groupBy=1 for swimlanes, ?lanes=1 to share rows,
// ?readOnly=1 to check that the keyboard cannot edit a frozen chart
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");
const grouped = params.get("groupBy") !== null;
const lanes = params.get("lanes") !== null;
const readOnly = params.get("readOnly") !== null;

const status = (task: Task) =>
  task.progress === 100
    ? "Done"
    : (task.progress ?? 0) > 0
      ? "In progress"
      : "Not started";

// Two tasks that overlap plus one that does not, so the packing is visible
const withLanes: Task[] = sourceTasks.map((task, index) =>
  index < 3 ? { ...task, lane: "Shared" } : task
);

function App() {
  return (
    <Gantt
      tasks={lanes ? withLanes : sourceTasks}
      height="100svh"
      width="100%"
      locale={locale}
      firstDayOfWeek={weekStart === null ? undefined : Number(weekStart)}
      showTaskList
      hierarchy
      groupBy={grouped ? status : undefined}
      readOnly={readOnly}
      onTasksChange={(tasks) => {
        // Lets the browser checks count how often a keyboard edit commits
        const scope = window as unknown as Record<string, unknown>;
        scope.__ganttChanges = ((scope.__ganttChanges as number) ?? 0) + 1;
        scope.__ganttLastTasks = tasks;
      }}
    />
  );
}

export default App;
