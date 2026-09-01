import { DependencyType, Task, TaskDependency } from "types/task";

/** Which end of a bar a link gesture grabbed */
export type LinkAnchor = "start" | "end";

/** Why a proposed link cannot be created */
export type LinkRejection = "self" | "duplicate" | "cycle";

/** The minimum a task needs for the dependency math - TaskTransformed fits as-is */
type DependencyNode = Pick<Task, "id"> & { dependencies?: TaskDependency[] };

/**
 * Dependency type from the two ends a drag connected
 *
 * The bar the drag starts on is the predecessor and the bar it is dropped on the
 * successor, so the first letter is the predecessor's end and the second the
 * successor's: end -> start is FS, start -> start SS, end -> end FF, start -> end SF.
 */
export function linkTypeFromAnchors(
  from: LinkAnchor,
  to: LinkAnchor
): DependencyType {
  const letter = (anchor: LinkAnchor) => (anchor === "end" ? "F" : "S");
  return `${letter(from)}${letter(to)}` as DependencyType;
}

/**
 * Checks a proposed link before it is committed - null means it may be created
 *
 * `task.dependencies` lists that task's predecessors, so the new entry lands on the
 * successor and points at the predecessor.
 *
 * The cycle check walks the predecessor chain up from the proposed predecessor:
 * reaching the successor means the link would close a loop. Every node walked is
 * recorded, so a cycle already present in the data ends the walk instead of spinning
 * (the same guard `buildTaskTree` uses for the parentId chain).
 */
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

/** Human-readable reason, shown on the drag preview */
export const LINK_REJECTION_LABEL: Record<LinkRejection, string> = {
  self: "Cannot link a task to itself",
  duplicate: "These tasks are already linked",
  cycle: "That would create a circular dependency",
};

/**
 * The tasks with one dependency added to the successor
 * Returns the same array when the successor is not in the data
 */
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

/**
 * The tasks with one dependency removed from the successor
 * Returns the same array when there is nothing to remove
 */
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
