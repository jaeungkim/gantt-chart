import { MIN_RESIZABLE_WIDTH } from "shared/constants";
import type { GanttLinkDraft } from "shared/store";
import { RenderedDependency, TaskTransformed } from "shared/task";
import { GanttGeometry, LinkAnchor } from "shared/types";
import { linkTypeFromAnchors } from "features/dependencies/utils/link";
import type { GanttVirtualization } from "features/timeline/types";

// Live offset of a task the running bar drag moves, a summary's subtree included (0 otherwise)
interface DragOffset {
  offsetX: number;
  offsetWidth: number;
}

interface Point {
  x: number;
  y: number;
}

const NO_OFFSET: DragOffset = { offsetX: 0, offsetWidth: 0 };

const STUB = 12;
const APPROACH = 12;
const RADIUS = 5;

// Predecessor end to successor end: FS right/left, SS left/left, FF right/right, SF left/right
const TYPE_ANCHORS = new Map<string, [LinkAnchor, LinkAnchor]>([
  ["FS", ["end", "start"]],
  ["SS", ["start", "start"]],
  ["FF", ["end", "end"]],
  ["SF", ["start", "end"]],
]);

const rowCenter = (task: TaskTransformed, { rowHeight }: GanttGeometry) =>
  (task.order - 1) * rowHeight + rowHeight / 2;

// Where one end of a bar sits, in content coordinates
export function anchorPoint(
  task: TaskTransformed,
  anchor: LinkAnchor,
  geometry: GanttGeometry,
  offset: DragOffset = NO_OFFSET,
  toward = 0
): Point {
  const left = task.barLeft + offset.offsetX;
  // GanttBar never draws a bar narrower than this, so milestones link at their visible edges
  const width = Math.max(
    task.barWidth + offset.offsetWidth,
    MIN_RESIZABLE_WIDTH
  );
  const height = task.isSummary
    ? geometry.summaryBarHeight
    : geometry.barHeight;

  return {
    x: anchor === "start" ? left : left + width,
    y: rowCenter(task, geometry) + (toward * height) / 4,
  };
}

// MS Project's routing: out of the predecessor's end, one vertical, then in through the
// successor's end from outside. When no single vertical fits, double back through the row gap.
function route(
  from: Point,
  out: 1 | -1,
  to: Point,
  into: 1 | -1,
  laneY: number
): Point[] {
  const stubX = from.x + out * STUB;
  const approachX = to.x - into * APPROACH;
  const sameRow = from.y === to.y;

  const elbowX =
    out * (approachX - stubX) >= 0 && (!sameRow || out === into)
      ? approachX
      : !sameRow && into * (to.x - stubX) >= APPROACH
        ? stubX
        : null;

  if (elbowX !== null) {
    return [from, { x: elbowX, y: from.y }, { x: elbowX, y: to.y }, to];
  }

  return [
    from,
    { x: stubX, y: from.y },
    { x: stubX, y: laneY },
    { x: approachX, y: laneY },
    { x: approachX, y: to.y },
    to,
  ];
}

export function roundedPath(points: Point[]): string {
  const corners = points.filter((point, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    if (!prev || !next) return true;

    return !(
      (prev.x === point.x && point.x === next.x) ||
      (prev.y === point.y && point.y === next.y)
    );
  });

  const length = (a: Point, b: Point) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const toward = (a: Point, b: Point, r: number) => ({
    x: a.x + Math.sign(b.x - a.x) * r,
    y: a.y + Math.sign(b.y - a.y) * r,
  });

  let d = `M ${corners[0].x} ${corners[0].y}`;
  for (let i = 1; i < corners.length - 1; i++) {
    const [prev, corner, next] = [corners[i - 1], corners[i], corners[i + 1]];
    const r = Math.min(
      RADIUS,
      length(prev, corner) / 2,
      length(corner, next) / 2
    );
    const a = toward(corner, prev, r);
    const b = toward(corner, next, r);
    d += ` L ${a.x} ${a.y} Q ${corner.x} ${corner.y} ${b.x} ${b.y}`;
  }

  const last = corners[corners.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

// null means an unknown type, arrow skipped
function arrowGeometry(
  predecessor: TaskTransformed,
  successor: TaskTransformed,
  predecessorOffset: DragOffset,
  successorOffset: DragOffset,
  depType: string,
  geometry: GanttGeometry
) {
  // Tasks are consumer-supplied data, so an unknown type can arrive at runtime
  const anchors = TYPE_ANCHORS.get(depType);
  if (!anchors) return null;

  const [fromAnchor, toAnchor] = anchors;
  // Each end takes the quarter of its bar facing the other row, so an arrow into an edge and one
  // out of it part ways instead of sharing a point; within one row both ends stay centred
  const toward = Math.sign(successor.order - predecessor.order);
  // Both ends have to apply their own drag offset for the arrow to follow the bars
  const from = anchorPoint(
    predecessor,
    fromAnchor,
    geometry,
    predecessorOffset,
    toward
  );
  const to = anchorPoint(successor, toAnchor, geometry, successorOffset, -toward);
  // Mid-gap between the bar's edge and the row rule; the bar sits centred above that 1px rule
  const { rowHeight, barHeight } = geometry;
  const barCenter = (predecessor.order - 1) * rowHeight + (rowHeight - 1) / 2;
  const laneY =
    barCenter + ((toward < 0 ? -1 : 1) * (rowHeight - 1 + barHeight)) / 4;

  return {
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    d: roundedPath(
      route(
        from,
        fromAnchor === "end" ? 1 : -1,
        to,
        toAnchor === "start" ? 1 : -1,
        laneY
      )
    ),
  };
}

// Over an armed edge the drag shows the very arrow a release commits; elsewhere a line to the cursor
export function linkPreview(
  draft: GanttLinkDraft,
  taskById: Map<string, TaskTransformed>,
  geometry: GanttGeometry
): { d: string; fromX: number; fromY: number } {
  const source = taskById.get(draft.fromTaskId);
  const target =
    draft.hoverTaskId !== null && !draft.rejection
      ? taskById.get(draft.hoverTaskId)
      : undefined;
  const routed =
    source &&
    target &&
    draft.hoverAnchor &&
    arrowGeometry(
      source,
      target,
      NO_OFFSET,
      NO_OFFSET,
      linkTypeFromAnchors(draft.fromAnchor, draft.hoverAnchor),
      geometry
    );

  // draft.fromX/fromY date from pointerdown; an infiniteScroll prepend may have moved the source
  const from = source
    ? anchorPoint(source, draft.fromAnchor, geometry)
    : { x: draft.fromX, y: draft.fromY };

  return (
    routed || {
      d: `M ${from.x} ${from.y} L ${draft.toX} ${draft.toY}`,
      fromX: from.x,
      fromY: from.y,
    }
  );
}

// Slack for arrow culling - the elbowed path runs a little past the endpoints (px)
const ARROW_BLEED = 32;

// Bounding box of both endpoints, so an arrow crossing the viewport with both ends off-screen draws
export function isArrowVisible(
  dep: Pick<RenderedDependency, "fromX" | "fromY" | "toX" | "toY">,
  viewport: Pick<GanttVirtualization, "rowStartPx" | "rowEndPx" | "isBarVisible">
): boolean {
  const top = Math.min(dep.fromY, dep.toY) - ARROW_BLEED;
  const bottom = Math.max(dep.fromY, dep.toY) + ARROW_BLEED;
  if (bottom < viewport.rowStartPx || top > viewport.rowEndPx) return false;

  const left = Math.min(dep.fromX, dep.toX) - ARROW_BLEED;
  const right = Math.max(dep.fromX, dep.toX) + ARROW_BLEED;
  return viewport.isBarVisible(left, right - left);
}

// The index doubles as the iteration source and the lookup table (insertion order = task order)
export function buildDependencies(
  taskById: Map<string, TaskTransformed>,
  liveOffsets: Record<string, DragOffset>,
  geometry: GanttGeometry
): RenderedDependency[] {
  const dependencies: RenderedDependency[] = [];

  for (const successor of taskById.values()) {
    const successorOffset = liveOffsets[successor.id] ?? NO_OFFSET;

    for (const dep of successor.dependencies ?? []) {
      const predecessor = taskById.get(dep.targetId);
      if (!predecessor) continue;

      const arrow = arrowGeometry(
        predecessor,
        successor,
        liveOffsets[predecessor.id] ?? NO_OFFSET,
        successorOffset,
        dep.type,
        geometry
      );
      if (!arrow) continue;

      dependencies.push({
        ...dep,
        sourceId: successor.id,
        ...arrow,
      });
    }
  }

  return dependencies;
}
