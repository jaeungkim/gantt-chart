import { DependencyType, Task, TaskDependency, TaskTransformed } from "shared/task";

// Which end of a bar a link gesture grabbed
export type LinkAnchor = "start" | "end";

// Why a proposed link cannot be created
export type LinkRejection = "self" | "duplicate" | "cycle";

// The minimum a task needs for the dependency math - TaskTransformed fits as-is
type DependencyNode = Pick<Task, "id"> & { dependencies?: TaskDependency[] };

// Predecessor's end first, successor's second: end -> start is FS, start -> start SS,
// end -> end FF, start -> end SF
export function linkTypeFromAnchors(
  from: LinkAnchor,
  to: LinkAnchor
): DependencyType {
  const letter = (anchor: LinkAnchor) => (anchor === "end" ? "F" : "S");
  return `${letter(from)}${letter(to)}` as DependencyType;
}

// The task a link drag is over, and the end of it the link would land on
interface LinkTarget {
  task: TaskTransformed;
  anchor: LinkAnchor;
}

// The whole row band is the target, not just the bar; on a lane row the horizontally
// nearest bar wins. `zone` is how far from the finish still counts as the finish, capped
// at a third of the bar; the rest of the row is the start, so a loose drop makes FS.
export function resolveLinkTarget(
  rowTasks: TaskTransformed[],
  contentX: number,
  contentY: number,
  rowHeight: number,
  zone: number
): LinkTarget | null {
  if (rowHeight <= 0) return null;

  const rowIndex = Math.floor(contentY / rowHeight);
  if (rowIndex < 0) return null;

  let task: TaskTransformed | null = null;
  let bestDistance = Infinity;

  for (const candidate of rowTasks) {
    // `order` is the task's row number, rewritten by the row model (1-based)
    if (candidate.order - 1 !== rowIndex) continue;

    const left = candidate.barLeft ?? 0;
    const right = left + (candidate.barWidth ?? 0);
    const distance =
      contentX < left ? left - contentX : Math.max(0, contentX - right);

    if (distance < bestDistance) {
      bestDistance = distance;
      task = candidate;
    }
  }

  if (!task) return null;

  const left = task.barLeft ?? 0;
  const width = task.barWidth ?? 0;
  const edge = Math.min(zone, width / 3);

  // Right of the bar is past `right - edge` too, so dropping beyond the finish is a finish
  return { task, anchor: contentX > left + width - edge ? "end" : "start" };
}

// null means the link may be created. `task.dependencies` lists predecessors, so the entry
// lands on the successor; the walk goes up the predecessor chain and `seen` keeps a cycle
// already in the data from spinning.
export function validateDependency(
  tasks: DependencyNode[],
  predecessorId: string,
  successorId: string
): LinkRejection | null {
  if (predecessorId === successorId) return "self";

  const byId = new Map(tasks.map((task) => [task.id, task]));

  const existing = byId.get(successorId)?.dependencies;
  if (existing?.some((dep) => dep.targetId === predecessorId)) {
    return "duplicate";
  }

  const seen = new Set<string>([predecessorId]);
  const queue = [predecessorId];
  while (queue.length) {
    const current = byId.get(queue.pop() as string);

    for (const dep of current?.dependencies ?? []) {
      if (dep.targetId === successorId) return "cycle";
      if (seen.has(dep.targetId)) continue;

      seen.add(dep.targetId);
      queue.push(dep.targetId);
    }
  }

  return null;
}

// Human-readable reason, shown on the drag preview
export const LINK_REJECTION_LABEL: Record<LinkRejection, string> = {
  self: "Cannot link a task to itself",
  duplicate: "These tasks are already linked",
  cycle: "That would create a circular dependency",
};

// The tasks with one dependency added to the successor; the same array back when it is absent
export function addDependency(
  tasks: Task[],
  predecessorId: string,
  successorId: string,
  type: DependencyType
): Task[] {
  let changed = false;

  const next = tasks.map((task) => {
    if (task.id !== successorId) return task;

    changed = true;
    return {
      ...task,
      dependencies: [
        ...(task.dependencies ?? []),
        { targetId: predecessorId, type },
      ],
    };
  });

  return changed ? next : tasks;
}

// The tasks with one dependency removed from the successor; the same array back when there is none
export function removeDependency(
  tasks: Task[],
  predecessorId: string,
  successorId: string
): Task[] {
  let changed = false;

  const next = tasks.map((task) => {
    if (task.id !== successorId || !task.dependencies) return task;

    const kept = task.dependencies.filter(
      (dep) => dep.targetId !== predecessorId
    );
    if (kept.length === task.dependencies.length) return task;

    changed = true;
    return { ...task, dependencies: kept };
  });

  return changed ? next : tasks;
}
