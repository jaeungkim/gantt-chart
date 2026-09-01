import Gantt from "pages/Gantt";
import { useState } from "react";
import type { SchedulingPolicy } from "core";
import type { GanttColumn } from "types/gantt";
import type { Task } from "types/task";
import { schedulingTasks, sourceTasks } from "../db";

// Append ?locale=ko-KR or ?firstDayOfWeek=1 to preview the localized labels
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");

/** Dev playground - not part of the published bundle */
const POLICIES: SchedulingPolicy[] = ["off", "shift-on-overlap", "maintain-gap"];

const columns: GanttColumn[] = [
  { key: "name", header: "Name", width: 200 },
  { key: "sequence", header: "#", width: 44 },
  {
    key: "duration",
    header: "Span",
    width: 56,
    render: (task) => task.duration ?? "",
  },
  {
    key: "totalSlack",
    header: "Slack",
    width: 60,
    render: (task) => (task.totalSlack === undefined ? "" : task.totalSlack),
  },
  {
    key: "critical",
    header: "Crit",
    width: 50,
    render: (task) => (task.critical ? "yes" : ""),
  },
];

function App() {
  const [dataset, setDataset] = useState<"scheduling" | "full">("scheduling");
  const [tasks, setTasks] = useState<Task[]>(schedulingTasks);
  const [policy, setPolicy] = useState<SchedulingPolicy>("off");
  const [workingCalendar, setWorkingCalendar] = useState(false);
  const [criticalPath, setCriticalPath] = useState(false);
  const [cycle, setCycle] = useState<string[] | null>(null);

  const switchDataset = (next: "scheduling" | "full") => {
    setDataset(next);
    setTasks(next === "scheduling" ? schedulingTasks : sourceTasks);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100svh" }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: "8px 12px",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          flexWrap: "wrap",
        }}
      >
        <label>
          Data{" "}
          <select
            data-testid="dataset"
            value={dataset}
            onChange={(e) =>
              switchDataset(e.target.value as "scheduling" | "full")
            }
          >
            <option value="scheduling">scheduling demo</option>
            <option value="full">full demo</option>
          </select>
        </label>

        <label>
          Policy{" "}
          <select
            data-testid="policy"
            value={policy}
            onChange={(e) => setPolicy(e.target.value as SchedulingPolicy)}
          >
            {POLICIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label>
          <input
            data-testid="calendar"
            type="checkbox"
            checked={workingCalendar}
            onChange={(e) => setWorkingCalendar(e.target.checked)}
          />{" "}
          working-day calendar
        </label>

        <label>
          <input
            data-testid="critical"
            type="checkbox"
            checked={criticalPath}
            onChange={(e) => setCriticalPath(e.target.checked)}
          />{" "}
          critical path
        </label>

        <button type="button" onClick={() => switchDataset(dataset)}>
          Reset dates
        </button>

        {cycle && <span data-testid="cycle">cycle: {cycle.join(" -> ")}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Gantt
          tasks={tasks}
          onTasksChange={setTasks}
          height="100%"
          width="100%"
          showTaskList
          columns={columns}
          defaultScale="month"
          locale={locale}
          firstDayOfWeek={weekStart === null ? undefined : Number(weekStart)}
          hierarchy={dataset === "full"}
          allowRowReorder
          schedulingPolicy={policy}
          onSchedulingCycle={setCycle}
          workingCalendar={workingCalendar}
          criticalPath={criticalPath}
        />
      </div>
    </div>
  );
}

export default App;
