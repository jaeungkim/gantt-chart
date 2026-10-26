import { LINK_ANCHOR_ZONE, MIN_RESIZABLE_WIDTH } from "shared/constants";
import { DependencyType, Task, TaskTransformed } from "shared/task";
import { GanttGeometry, LinkAnchor, LinkRejection } from "shared/types";

export const LINK_TYPE_TITLE: Record<DependencyType, string> = {
  FS: "Finish to start",
  SS: "Start to start",
  FF: "Finish to finish",
  SF: "Start to finish",
};

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

// On a lane row the horizontally nearest bar wins. `LINK_ANCHOR_ZONE` is how far from the finish
// still counts as the finish, capped at a third of the bar; the rest is the start, so a loose drop
// from a finish dot makes FS.
export function resolveLinkTarget(
  rowTasks: TaskTransformed[],
  contentX: number,
  contentY: number,
  geometry: GanttGeometry
): LinkTarget | null {
  const rowIndex = Math.floor(contentY / geometry.rowHeight);

  let task: TaskTransformed | null = null;
  let bestDistance = Infinity;

  const drawnWidth = (candidate: TaskTransformed) =>
    Math.max(candidate.barWidth, MIN_RESIZABLE_WIDTH);

  for (const candidate of rowTasks) {
    // `order` is the task's row number, rewritten by the row model (1-based)
    if (candidate.order - 1 !== rowIndex) continue;

    const left = candidate.barLeft;
    const right = left + drawnWidth(candidate);
    const distance =
      contentX < left ? left - contentX : Math.max(0, contentX - right);

    if (distance < bestDistance) {
      bestDistance = distance;
      task = candidate;
    }
  }

  if (!task || bestDistance > LINK_ANCHOR_ZONE) return null;

  const left = task.barLeft;
  const width = drawnWidth(task);
  const edge = Math.min(LINK_ANCHOR_ZONE, width / 3);

  // Right of the bar is past `right - edge` too, so dropping beyond the finish is a finish
  return { task, anchor: contentX > left + width - edge ? "end" : "start" };
}

// null means the link may be created. `task.dependencies` lists predecessors, so the entry
// lands on the successor; the walk goes up the predecessor chain and `seen` keeps a cycle
// already in the data from spinning.
export function validateDependency(
  tasks: Task[],
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

// The tasks with one dependency added to the successor
export function addDependency(
  tasks: Task[],
  predecessorId: string,
  successorId: string,
  type: DependencyType
): Task[] {
  return tasks.map((task) =>
    task.id === successorId
      ? {
          ...task,
          dependencies: [
            ...(task.dependencies ?? []),
            { targetId: predecessorId, type },
          ],
        }
      : task
  );
}

// The tasks with every dependency on the predecessor removed from the successor
export function removeDependency(
  tasks: Task[],
  predecessorId: string,
  successorId: string
): Task[] {
  return tasks.map((task) =>
    task.id === successorId && task.dependencies
      ? {
          ...task,
          dependencies: task.dependencies.filter(
            (dep) => dep.targetId !== predecessorId
          ),
        }
      : task
  );
}
