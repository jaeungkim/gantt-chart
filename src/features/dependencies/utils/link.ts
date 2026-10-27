import { LINK_ANCHOR_ZONE, MIN_RESIZABLE_WIDTH } from "shared/constants";
import { DependencyType, Task, TaskTransformed } from "shared/task";
import { GanttGeometry, LinkAnchor, LinkRejection } from "shared/types";

export const LINK_TYPE_TITLE: Record<DependencyType, string> = {
  FS: "Finish to start",
  SS: "Start to start",
  FF: "Finish to finish",
  SF: "Start to finish",
};

export function linkTypeFromAnchors(
  from: LinkAnchor,
  to: LinkAnchor
): DependencyType {
  const letter = (anchor: LinkAnchor) => (anchor === "end" ? "F" : "S");
  return `${letter(from)}${letter(to)}` as DependencyType;
}

interface LinkTarget {
  task: TaskTransformed;
  anchor: LinkAnchor;
}

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

  return { task, anchor: contentX > left + width - edge ? "end" : "start" };
}

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

export const LINK_REJECTION_LABEL: Record<LinkRejection, string> = {
  self: "Cannot link a task to itself",
  duplicate: "These tasks are already linked",
  cycle: "That would create a circular dependency",
};

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
