import Gantt from "pages/Gantt";
import { useState } from "react";
import type { Task } from "types/task";
import { sourceTasks } from "../db";

// Dev playground only (not part of the published package) - append ?locale=ko-KR to
// preview the localized labels, ?readOnly=1 to freeze every gesture, and ?veto=1 to
// have the host reject what the link and draw gestures propose
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");
const readOnly = params.get("readOnly") === "1";
const veto = params.get("veto") === "1";

function App() {
  const [tasks, setTasks] = useState<Task[]>(sourceTasks);

  return (
    <Gantt
      tasks={tasks}
      onTasksChange={(updated) => {
        console.info("[gantt] onTasksChange", updated.length);
        setTasks(updated);
      }}
      onDependencyCreate={(change) => {
        console.info("[gantt] onDependencyCreate", JSON.stringify(change));
        if (veto) return false;
      }}
      onDependencyDelete={(change) => {
        console.info("[gantt] onDependencyDelete", JSON.stringify(change));
        if (veto) return false;
      }}
      onTaskCreate={(draft) => {
        console.info("[gantt] onTaskCreate", JSON.stringify(draft));
        if (veto) return;

        // The chart adds nothing itself - the host decides, here by appending a row
        setTasks((current) => [
          ...current,
          {
            id: `new-${current.length + 1}`,
            name: "New task",
            startDate: draft.startDate,
            endDate: draft.endDate,
            parentId: null,
            sequence: `${current.length + 1}`,
          },
        ]);
      }}
      readOnly={readOnly}
      height="100svh"
      width="100%"
      locale={locale}
      firstDayOfWeek={weekStart === null ? undefined : Number(weekStart)}
      showTaskList
      hierarchy
      allowRowReorder
    />
  );
}

export default App;
