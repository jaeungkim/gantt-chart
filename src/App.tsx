import Gantt from "pages/Gantt";
import { useEffect, useRef, useState } from "react";
import type { SchedulingPolicy } from "core";
import { GanttHandle } from "hooks/useGanttScrollApi";
import type {
  GanttBarRenderProps,
  GanttColumn,
  GanttMarker,
  GanttRangeBand,
} from "types/gantt";
import type { Task } from "types/task";
import { schedulingTasks, sourceTasks } from "../db";

// Dev playground only (not part of the published package) - append ?locale=ko-KR to
// preview the localized labels, ?readOnly=1 to freeze every gesture, and ?veto=1 to
// have the host reject what the link and draw gestures propose
const params = new URLSearchParams(window.location.search);
const locale = params.get("locale") ?? undefined;
const weekStart = params.get("firstDayOfWeek");
const readOnly = params.get("readOnly") === "1";
const veto = params.get("veto") === "1";
// ?veto=reject turns every change down half a second after the drop (?veto=3000 for a
// slower answer), ?renderBar=1 swaps in a custom bar - both there to exercise the drag
// paths by hand
const vetoParam = params.get("vetoDelay");
const vetoDelayMs = vetoParam === null ? null : Number(vetoParam) || 500;
const customBar = params.get("renderBar") === "1";

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const markers: GanttMarker[] = [
  { id: "release", date: day(9), label: "Release 1.0" },
  { id: "deadline", date: day(4), label: "Deadline", warnOnOverrun: true },
];

const rangeBands: GanttRangeBand[] = [
  { id: "sprint-1", startDate: day(-2), endDate: day(5), label: "Sprint 1" },
];

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
  const ref = useRef<GanttHandle>(null);
  const [dataset, setDataset] = useState<"scheduling" | "full">("scheduling");
  const [tasks, setTasks] = useState<Task[]>(schedulingTasks);
  const [policy, setPolicy] = useState<SchedulingPolicy>("off");
  const [workingCalendar, setWorkingCalendar] = useState(false);
  const [criticalPath, setCriticalPath] = useState(false);
  const [cycle, setCycle] = useState<string[] | null>(null);
  // Veto every change, so a cascade can be watched rolling back
  const [reject, setReject] = useState(false);
  const [lastChange, setLastChange] = useState<string>("");

  // Playground convenience - `gantt.current.scrollToToday()` from the devtools console.
  // The ref object itself, not its value: the handle behind it is rebuilt as data changes.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).gantt = ref;
  }, []);

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

        <label>
          <input
            data-testid="reject"
            type="checkbox"
            checked={reject}
            onChange={(e) => setReject(e.target.checked)}
          />{" "}
          reject changes
        </label>

        <span data-testid="last-change">{lastChange}</span>

        <button type="button" onClick={() => switchDataset(dataset)}>
          Reset dates
        </button>

        {cycle && <span data-testid="cycle">cycle: {cycle.join(" -> ")}</span>}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Gantt
          ref={ref}
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
          zoomOnWheel
          infiniteScroll
          markers={markers}
          rangeBands={rangeBands}
          onBeforeTaskChange={(change) => {
            setLastChange(
              `${change.type}:${change.changedTasks.map((t) => t.id).join(",")}`
            );
            // The checkbox answers straight away; ?vetoDelay=3000 stalls first, so a
            // pending answer can be watched holding the bar where it was dropped
            if (!reject) return undefined;
            return vetoDelayMs === null
              ? Promise.resolve(false)
              : new Promise<boolean>((r) =>
                  setTimeout(() => r(false), vetoDelayMs)
                );
          }}
          renderBar={
            customBar
              ? ({ task, barProps }: GanttBarRenderProps) => (
                  <div {...barProps} className="demo-bar" data-id={task.id}>
                    {task.name}
                  </div>
                )
              : undefined
          }
        />
      </div>
    </div>
  );
}

export default App;
