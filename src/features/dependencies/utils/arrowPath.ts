import { MIN_RESIZABLE_WIDTH } from "shared/constants";
import type { GanttLinkDraft } from "shared/store";
import { RenderedDependency, TaskTransformed } from "shared/task";
import { GanttGeometry, LinkAnchor } from "shared/types";
import { linkTypeFromAnchors } from "features/dependencies/utils/link";
import type { GanttVirtualization } from "features/timeline/types";

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

const TYPE_ANCHORS = new Map<string, [LinkAnchor, LinkAnchor]>([
  ["FS", ["end", "start"]],
  ["SS", ["start", "start"]],
  ["FF", ["end", "end"]],
  ["SF", ["start", "end"]],
]);

const rowCenter = (task: TaskTransformed, { rowHeight }: GanttGeometry) =>
  (task.order - 1) * rowHeight + rowHeight / 2;

export function anchorPoint(
  task: TaskTransformed,
  anchor: LinkAnchor,
  geometry: GanttGeometry,
  offset: DragOffset = NO_OFFSET,
  toward = 0
): Point {
  const left = task.barLeft + offset.offsetX;
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

function arrowGeometry(
  predecessor: TaskTransformed,
  successor: TaskTransformed,
  predecessorOffset: DragOffset,
  successorOffset: DragOffset,
  depType: string,
  geometry: GanttGeometry
) {
  const anchors = TYPE_ANCHORS.get(depType);
  if (!anchors) return null;

  const [fromAnchor, toAnchor] = anchors;
  const toward = Math.sign(successor.order - predecessor.order);
  const from = anchorPoint(
    predecessor,
    fromAnchor,
    geometry,
    predecessorOffset,
    toward
  );
  const to = anchorPoint(successor, toAnchor, geometry, successorOffset, -toward);
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

const ARROW_BLEED = 32;

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
