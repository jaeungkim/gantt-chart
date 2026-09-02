`buildTaskTree`, `collectSubtreeIds` and `rollUpTasks` are the headless helpers behind the
`parentId` hierarchy: they normalize the parent links, walk a subtree, and recompute every parent
as a summary row. `TaskTree` is the normalized shape they pass between each other. All four come
from the package root and touch neither React nor the DOM.

```ts
import {
  buildTaskTree,
  collectSubtreeIds,
  rollUpTasks,
  type TaskTree,
} from '@jaeungkim/gantt-chart';
```

For what the chart does with the hierarchy on screen, see
[Task list and hierarchy](../task-list.md); for running these outside React, see
[Headless core](../headless-core.md).

## TaskTree

```ts
/**
 * A normalized tree built from parentId
 *
 * Orphans (a parent id that is not in the data), self-references and cyclic chains all get
 * their parent link cut and become roots. The parentOf/childIds that come out are therefore
 * always acyclic, so the functions below - and the render - can walk up or down without
 * risking an infinite loop.
 */
export interface TaskTree {
  /** parent id -> child ids (in input order) */
  childIds: Map<string, string[]>;
  /** task id -> normalized parent id (null for a root, an orphan or a cycle) */
  parentOf: Map<string, string | null>;
  /** task id -> depth from the root */
  depthOf: Map<string, number>;
  /** Root ids, in input order - the sibling list childIds has no key for */
  rootIds: string[];
}
```

| Field | Type | Contents |
|---|---|---|
| `childIds` | `Map<string, string[]>` | Parent id to its child ids, in input array order. A key exists only for a parent that has at least one child — `childIds.has(leafId)` is `false`. There is no `null` key; depth-0 siblings live in `rootIds`. |
| `parentOf` | `Map<string, string \| null>` | One entry for **every** input task. `null` means root, orphan, self-reference, or a member of a cycle. |
| `depthOf` | `Map<string, number>` | Steps from the root. A root is `0`. No cap. |
| `rootIds` | `string[]` | Every id whose `parentOf` is `null`, in input array order. |

Nothing is sorted: `childIds.get(parent)` and `rootIds` follow the order of the array passed in.

## buildTaskTree

```ts
export function buildTaskTree(tasks: TaskNode[]): TaskTree
```

`TaskNode` is `Pick<Task, "id" | "parentId">`. It is structural, so any object with
`{ id: string; parentId: string | null }` satisfies it — a `Task` and a `TaskTransformed` both fit
as they are. See [Task](task.md).

### Parent resolution

Each task's `parentId` is resolved to either a parent id or `null`.

| Input condition | Resolved parent |
|---|---|
| `parentId` is `null`, `undefined` or `""` | `null` — the task is a root |
| `parentId === task.id` (self-reference) | `null` — the task is a root |
| `parentId` names an id that is not in `tasks` (orphan) | `null` — the task is a root |
| Walking the raw `parentId` chain up from that parent revisits an id already seen (cycle) | `null` — the task is a root |
| Anything else | `parentId` |

Nothing is reported when a link is cut: there is no callback, no console warning and no field on
`TaskTree` marking the task. The cycle walk records every id it passes, so it terminates within
*n* steps for any input.

The cycle check reads the raw `parentId` of each ancestor, not the already-resolved `parentOf`.
A task whose ancestor chain passes through a cycle is therefore rooted too: with `a` and `b`
pointing at each other and `c` pointing at `a`, all three end up with `parentOf === null` and
`depth 0`.

`parentId` is required and nullable on `Task` — `string | null`, not optional.

### Duplicate ids

An id that appears twice in `tasks` is not deduplicated and not reported. The internal lookup keeps
the last occurrence, while the per-task passes run once per array element, so the id is written to
`parentOf` and `depthOf` twice and pushed into `childIds` or `rootIds` twice.

## collectSubtreeIds

```ts
/**
 * The subtree's ids including the root itself (breadth first)
 * An id that is not in the tree yields an empty array
 */
export function collectSubtreeIds(
  tasks: TaskNode[],
  rootId: string,
  tree: TaskTree = buildTaskTree(tasks)
): string[]
```

| Parameter | Type | Default | Meaning |
|---|---|---|---|
| `tasks` | `TaskNode[]` | — | Read only when `tree` is omitted. |
| `rootId` | `string` | — | The id whose subtree is collected. |
| `tree` | `TaskTree` | `buildTaskTree(tasks)` | A prebuilt tree. Supplying one skips the O(n) build; there is no overload that drops `tasks`. |

| Case | Result |
|---|---|
| `rootId` is in `tree.parentOf` | `[rootId, ...descendants]`, breadth first |
| `rootId` is not in `tree.parentOf` | `[]` |
| `rootId` is on a cut cycle | `[rootId]` — its children were rooted away |

Order is breadth first, not depth first. For `root → (a → a1, a2), b`:

```ts
collectSubtreeIds(tasks, 'root'); // ['root', 'a', 'b', 'a1', 'a2']
collectSubtreeIds(tasks, 'a');    // ['a', 'a1', 'a2']
collectSubtreeIds(tasks, 'a1');   // ['a1']
```

## rollUpTasks

```ts
/**
 * The tasks with every parent recomputed as a summary row
 *
 * Start and end always come from the children, never from what the data says
 * (min(child start)..max(child end); a milestone child counts at its startDate alone).
 * Deepest first, so a grandchild's move travels up through the parent and the grandparent.
 * An explicit progress is left alone; only a missing one is rolled up from the children.
 */
export function rollUpTasks(
  tasks: Task[],
  tree: TaskTree = buildTaskTree(tasks)
): Task[]
```

Input is the full `Task`, not `TaskNode` — `startDate`, `endDate`, `type` and `progress` are read.

### What a parent gets

| Field | Value on the returned parent |
|---|---|
| `startDate` | `min(child startDate)`, always. The parent's own value is discarded. |
| `endDate` | `max(child endDate)`, always — except a child with `type: 'milestone'`, which contributes its `startDate` instead. |
| `progress` | `parent.progress ?? rollUpProgress(children)`. An explicit value survives, including `0`, and is not clamped. |
| everything else | Spread through unchanged. |

Both dates are re-serialized with `dayjs(ms).toISOString()`, so `'2025-03-04'` on a child comes
back as `'2025-03-04T00:00:00.000Z'` on the parent.

Parents are processed deepest first, and each parent reads the already-rewritten version of its
children, so a grandchild's dates reach the grandparent in one call.

A parent whose children all have unparseable dates is left exactly as it was.

### Rolled-up progress

Used only when the parent has no `progress`. Children are weighted by duration in milliseconds,
`max(0, endDate - startDate)`, computed from the child's raw `endDate` — the milestone exception
above applies to the span, not to this weight.

| Rule | Value |
|---|---|
| Child `progress` | Clamped to `0`–`100` before weighting. |
| Child with a missing or non-numeric `progress` | Counts as `0`, and does not count as a reported value. |
| No child reports a `progress` | Returns `undefined`; the parent keeps `progress: undefined`. |
| Every child has zero duration | Falls back to a plain mean over the child count. |
| Result | `Math.round`ed to an integer percent. |

Ten days at 100% plus thirty days at 0% gives `25`. Two zero-duration children at 100% and 0% give
`50`.

### Return identity

| Case | Returned array |
|---|---|
| `tree.childIds` is empty (no parents at all) | The same array instance that was passed in |
| No parent was rewritten | The same array instance that was passed in |
| Otherwise | A new array; rewritten parents are new objects, every other element keeps its identity, order is preserved |

## Example

```ts
import { buildTaskTree, collectSubtreeIds, rollUpTasks } from '@jaeungkim/gantt-chart';
import type { Task } from '@jaeungkim/gantt-chart';

const tasks: Task[] = [
  {
    id: 'p', name: 'Phase 1', parentId: null, sequence: '1',
    startDate: '2025-03-01', endDate: '2025-03-02',
  },
  {
    id: 'c1', name: 'Design', parentId: 'p', sequence: '1.1',
    startDate: '2025-01-01', endDate: '2025-01-11', progress: 100,
  },
  {
    id: 'c2', name: 'Build', parentId: 'p', sequence: '1.2',
    startDate: '2025-01-11', endDate: '2025-02-10', progress: 0,
  },
];

const tree = buildTaskTree(tasks);
tree.depthOf.get('c1');              // 1
tree.childIds.get('p');              // ['c1', 'c2']
tree.rootIds;                        // ['p']
collectSubtreeIds(tasks, 'p', tree); // ['p', 'c1', 'c2']

const rolled = rollUpTasks(tasks, tree);
rolled[0].startDate;                 // '2025-01-01T00:00:00.000Z'
rolled[0].endDate;                   // '2025-02-10T00:00:00.000Z'
rolled[0].progress;                  // 25
```

## Notes

- `getVisibleTasks` — the collapse filter that drops any task with a collapsed ancestor — lives in
  the same core module and is exported from the internal `src/core` barrel, but it is **not**
  exported from the package root. It cannot be imported from `@jaeungkim/gantt-chart`. The chart
  calls it internally; a host drives the same behaviour through the `collapsedIds` and
  `defaultCollapsedIds` props, described in [Task list and hierarchy](../task-list.md).
- `TaskNode` and `rollUpProgress` are internal. Neither is exported from the package root; the
  page names them only to describe the signatures above.
- All three functions are pure and never mutate their input. `buildTaskTree` returns a fresh
  `TaskTree` and `collectSubtreeIds` a fresh array on every call; only `rollUpTasks` can hand back
  the array instance it was given.
- None of them order rows. Row order comes from `sequence`; `parentId` sets depth only. Nothing
  validates that the two agree — see [Task data](../task-data.md).
- The scheduler pins summary rows from the raw `parentId` values rather than from a `TaskTree`, so
  ids in a cut cycle or self-reference are pinned there while this module treats them as roots. See
  [Scheduling](../scheduling.md).
