import { computeLayeredLayout } from "./sugiyama.js";
import type { SugiyamaEdge } from "./sugiyama.js";
import type {
  GuardCondition,
  InspectorLayoutEdge,
  InspectorLayoutResult,
  InspectorLearnedEdge,
  MachineDescription,
} from "./types.js";

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const COLUMN_GAP = 80;
const ROW_GAP = 40;
const MARGIN = 24;
const LABEL_HEIGHT = 18;
const BOUNDS_PADDING = 12;

type LogicalEdge = {
  from: string;
  to: string;
  eventType: string;
  branchIndex: number;
  branchTotal: number;
  laneIndex: number;
  laneTotal: number;
  guards: GuardCondition[];
  returnSource: string;
  isDynamic: boolean;
};

type EdgeRouting = {
  layout: InspectorLayoutEdge;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
};

type Rect = { x: number; y: number; width: number; height: number };

export function inspectorLayout(
  description: MachineDescription,
  initialState: string,
  dynamicEdges: InspectorLearnedEdge[] = [],
  overrides: Map<string, { x: number; y: number }> = new Map(),
): InspectorLayoutResult {
  const states = Object.keys(description.states);
  const logicalEdges = collectLogicalEdges(description, dynamicEdges);

  // Node positions come from an in-house Sugiyama-style layered layout: DFS
  // cycle removal, longest-path layer assignment, dummy insertion for long
  // edges, and barycenter sweep for crossing minimization. Self-loops don't
  // affect placement so we strip them, and unknown targets are dropped.
  const sugiyamaEdges: SugiyamaEdge[] = [];
  for (const stateType of states) {
    const stateDesc = description.states[stateType];
    if (stateDesc === undefined) continue;
    for (const transition of stateDesc.transitions) {
      for (const branch of transition.branches) {
        if (
          branch.kind === "transition" &&
          branch.targetStateType !== null &&
          stateType !== branch.targetStateType
        ) {
          sugiyamaEdges.push({
            from: stateType,
            to: branch.targetStateType,
          });
        }
      }
    }
  }

  const sugiyamaPositions = computeLayeredLayout(
    states,
    sugiyamaEdges,
    initialState,
    {
      direction: "right",
      layerGap: COLUMN_GAP,
      nodeGap: ROW_GAP,
      nodeHeight: NODE_HEIGHT,
      nodeWidth: NODE_WIDTH,
    },
  );

  const nodePositions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  for (const stateId of states) {
    const pos = sugiyamaPositions.get(stateId);
    if (pos === undefined) continue;
    nodePositions.set(stateId, {
      height: NODE_HEIGHT,
      width: NODE_WIDTH,
      x: MARGIN + pos.x,
      y: MARGIN + pos.y,
    });
  }

  // Apply user overrides on top of the computed grid positions.
  for (const [stateId, override] of overrides) {
    const existing = nodePositions.get(stateId);
    if (existing === undefined) continue;
    nodePositions.set(stateId, {
      ...existing,
      x: override.x,
      y: override.y,
    });
  }

  const layoutNodes = states
    .filter((id) => nodePositions.has(id))
    .map((id) => ({ id, ...nodePositions.get(id)! }));

  // Route edges one at a time and grow a list of already-placed label rects so
  // each subsequent edge's collision resolution treats prior labels as
  // obstacles too. This prevents parallel-edge labels (like the traffic
  // machine's `tick` / `emergency ELSE` / `pedestrian` between `green` and
  // `yellow`) from stacking on top of each other when the natural fan-out
  // spacing isn't wide enough for their pill widths.
  const placedLabelRects: Rect[] = [];
  const routedEdges: EdgeRouting[] = [];
  for (const edge of logicalEdges) {
    const routing = routeEdge(edge, nodePositions, placedLabelRects);
    if (routing === undefined) continue;
    routedEdges.push(routing);
    const layoutEdge = routing.layout;
    placedLabelRects.push({
      height: LABEL_HEIGHT,
      width: layoutEdge.labelWidth,
      x: layoutEdge.labelX - layoutEdge.labelWidth / 2,
      y: layoutEdge.labelY - LABEL_HEIGHT / 2,
    });
  }

  const layoutEdges = routedEdges.map((edge) => edge.layout);

  const bounds = computeContentBounds(layoutNodes, routedEdges);

  return {
    edges: layoutEdges,
    height: bounds.maxY - bounds.minY,
    minX: bounds.minX,
    minY: bounds.minY,
    nodes: layoutNodes,
    width: bounds.maxX - bounds.minX,
  };
}

function computeContentBounds(
  nodes: Array<{ x: number; y: number; width: number; height: number }>,
  edges: EdgeRouting[],
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.x + node.width > maxX) maxX = node.x + node.width;
    if (node.y + node.height > maxY) maxY = node.y + node.height;
  }

  for (const edge of edges) {
    if (edge.bounds.minX < minX) minX = edge.bounds.minX;
    if (edge.bounds.minY < minY) minY = edge.bounds.minY;
    if (edge.bounds.maxX > maxX) maxX = edge.bounds.maxX;
    if (edge.bounds.maxY > maxY) maxY = edge.bounds.maxY;
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = NODE_WIDTH;
    maxY = NODE_HEIGHT;
  }

  return {
    maxX: maxX + BOUNDS_PADDING,
    maxY: maxY + BOUNDS_PADDING,
    minX: minX - BOUNDS_PADDING,
    minY: minY - BOUNDS_PADDING,
  };
}

function collectLogicalEdges(
  description: MachineDescription,
  dynamicEdges: InspectorLearnedEdge[],
): LogicalEdge[] {
  const edges: LogicalEdge[] = [];
  const stateSet = new Set(Object.keys(description.states));

  for (const state of Object.values(description.states)) {
    for (const transition of state.transitions) {
      const transitionBranches = transition.branches.filter(
        (branch) => branch.kind === "transition" && branch.targetStateType !== null,
      );
      const total = transitionBranches.length;
      transitionBranches.forEach((branch, index) => {
        if (!stateSet.has(branch.targetStateType!)) return;
        edges.push({
          branchIndex: index,
          branchTotal: total,
          eventType: transition.eventType,
          from: state.type,
          guards: branch.guards,
          isDynamic: false,
          laneIndex: 0,
          laneTotal: 1,
          returnSource: branch.returnSource,
          to: branch.targetStateType!,
        });
      });
    }
  }

  for (const dyn of dynamicEdges) {
    if (!stateSet.has(dyn.from) || !stateSet.has(dyn.to)) continue;
    const alreadyStatic = edges.some(
      (edge) =>
        edge.from === dyn.from &&
        edge.to === dyn.to &&
        edge.eventType === dyn.eventType,
    );
    if (alreadyStatic) continue;
    edges.push({
      branchIndex: 0,
      branchTotal: 1,
      eventType: dyn.eventType,
      from: dyn.from,
      guards: [],
      isDynamic: true,
      laneIndex: 0,
      laneTotal: 1,
      returnSource: "(observed at runtime; not resolved statically)",
      to: dyn.to,
    });
  }

  assignLanes(edges);
  return edges;
}

function assignLanes(edges: LogicalEdge[]): void {
  const laneTotals = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    laneTotals.set(key, (laneTotals.get(key) ?? 0) + 1);
  }
  const laneCounters = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.from}->${edge.to}`;
    const index = laneCounters.get(key) ?? 0;
    edge.laneIndex = index;
    edge.laneTotal = laneTotals.get(key)!;
    laneCounters.set(key, index + 1);
  }
}

const CORNER_RADIUS = 8;
/** Vertical spacing between fanned-out labels on a horizontal spine. */
const LABEL_FAN_SPACING_V = 26;
/** Horizontal spacing between fanned-out labels on a vertical spine. */
const LABEL_FAN_SPACING_H = 140;

function routeEdge(
  edge: LogicalEdge,
  positions: Map<string, Rect>,
  placedLabelRects: readonly Rect[],
): EdgeRouting | undefined {
  const source = positions.get(edge.from);
  const target = positions.get(edge.to);
  if (source === undefined || target === undefined) return undefined;

  const labelWidth = estimateLabelWidth(edge);

  if (edge.from === edge.to) {
    return selfLoop(edge, source, labelWidth);
  }

  // Pick the routing axis by comparing center-to-center vectors. This gives
  // the closest-edge dock: if target is mostly to the right, exit right; if
  // mostly below, exit bottom; etc.
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return routeHorizontal(
      edge,
      source,
      target,
      dx > 0,
      labelWidth,
      positions,
      placedLabelRects,
    );
  }
  return routeVertical(
    edge,
    source,
    target,
    dy > 0,
    labelWidth,
    positions,
    placedLabelRects,
  );
}

function routeHorizontal(
  edge: LogicalEdge,
  source: Rect,
  target: Rect,
  forward: boolean,
  labelWidth: number,
  positions: Map<string, Rect>,
  placedLabelRects: readonly Rect[],
): EdgeRouting {
  // Docks converge at the middle of the facing edge on each node. Labels are
  // pass-through pills — the line enters the side facing the source, exits
  // the opposite side. Parallel-edge labels fan out vertically.
  const sourceX = forward ? source.x + source.width : source.x;
  const sourceY = source.y + source.height / 2;
  const targetX = forward ? target.x : target.x + target.width;
  const targetY = target.y + target.height / 2;

  const naturalLabelX = (sourceX + targetX) / 2;
  const naturalLabelY = (sourceY + targetY) / 2;
  const laneOffset =
    edge.laneTotal <= 1
      ? 0
      : (edge.laneIndex - (edge.laneTotal - 1) / 2) * LABEL_FAN_SPACING_V;
  const resolved = resolveLabelAgainstObstacles(
    naturalLabelX,
    naturalLabelY + laneOffset,
    labelWidth,
    [...positions.values(), ...placedLabelRects],
    "vertical", // horizontal flow → escape vertically when a node blocks
  );
  const labelX = resolved.labelX;
  const labelY = resolved.labelY;
  const labelSourceSideX = forward
    ? labelX - labelWidth / 2
    : labelX + labelWidth / 2;
  const labelTargetSideX = forward
    ? labelX + labelWidth / 2
    : labelX - labelWidth / 2;

  const waypoints = simplifyWaypoints([
    { x: sourceX, y: sourceY },
    { x: labelSourceSideX, y: sourceY },
    { x: labelSourceSideX, y: labelY },
    { x: labelTargetSideX, y: labelY },
    { x: labelTargetSideX, y: targetY },
    { x: targetX, y: targetY },
  ]);
  const path = orthogonalPath(waypoints);
  return buildEdgeRouting(edge, waypoints, path, labelX, labelY, labelWidth);
}

function routeVertical(
  edge: LogicalEdge,
  source: Rect,
  target: Rect,
  downward: boolean,
  labelWidth: number,
  positions: Map<string, Rect>,
  placedLabelRects: readonly Rect[],
): EdgeRouting {
  const sourceX = source.x + source.width / 2;
  const sourceY = downward ? source.y + source.height : source.y;
  const targetX = target.x + target.width / 2;
  const targetY = downward ? target.y : target.y + target.height;

  const naturalLabelY = (sourceY + targetY) / 2;
  const naturalLabelX = (sourceX + targetX) / 2;
  const laneOffset =
    edge.laneTotal <= 1
      ? 0
      : (edge.laneIndex - (edge.laneTotal - 1) / 2) * LABEL_FAN_SPACING_H;
  const resolved = resolveLabelAgainstObstacles(
    naturalLabelX + laneOffset,
    naturalLabelY,
    labelWidth,
    [...positions.values(), ...placedLabelRects],
    "horizontal", // vertical flow → escape horizontally when a node blocks
  );
  const labelX = resolved.labelX;
  const labelY = resolved.labelY;
  const labelSourceSideY = downward
    ? labelY - LABEL_HEIGHT / 2
    : labelY + LABEL_HEIGHT / 2;
  const labelTargetSideY = downward
    ? labelY + LABEL_HEIGHT / 2
    : labelY - LABEL_HEIGHT / 2;

  const waypoints = simplifyWaypoints([
    { x: sourceX, y: sourceY },
    { x: sourceX, y: labelSourceSideY },
    { x: labelX, y: labelSourceSideY },
    { x: labelX, y: labelTargetSideY },
    { x: targetX, y: labelTargetSideY },
    { x: targetX, y: targetY },
  ]);
  const path = orthogonalPath(waypoints);
  return buildEdgeRouting(edge, waypoints, path, labelX, labelY, labelWidth);
}

/**
 * Public helper: given a proposed label center position, shift it out of every
 * obstacle rect (state boxes, other labels, whatever the caller lists). Used
 * both by the auto-router (before baking the label into the layout) and by
 * the interactive drag handler.
 */
export function clampLabelOutOfObstacles(
  labelX: number,
  labelY: number,
  labelWidth: number,
  obstacles: readonly Rect[],
  preferredAxis: "horizontal" | "vertical" | "shortest" = "vertical",
): { labelX: number; labelY: number } {
  return resolveLabelAgainstObstacles(
    labelX,
    labelY,
    labelWidth,
    obstacles,
    preferredAxis,
  );
}

/**
 * Public helper: shift a top-left node rect out of every overlapping obstacle
 * using the shortest escape direction. Used by the node-drag handler to
 * prevent two state boxes from ever occupying the same space.
 */
export function clampNodeOutOfObstacles(
  x: number,
  y: number,
  width: number,
  height: number,
  obstacles: readonly Rect[],
): { x: number; y: number } {
  return pushRectOutOfObstacles({ height, width, x, y }, obstacles, "shortest");
}

/**
 * Backward-compat shim for the earlier label-only helper.
 * @deprecated Use `clampLabelOutOfObstacles`.
 */
export function clampLabelOutOfNodes(
  labelX: number,
  labelY: number,
  labelWidth: number,
  nodes: readonly Rect[],
): { labelX: number; labelY: number } {
  return clampLabelOutOfObstacles(labelX, labelY, labelWidth, nodes, "vertical");
}

function resolveLabelAgainstObstacles(
  labelX: number,
  labelY: number,
  labelWidth: number,
  obstacles: readonly Rect[],
  preferredAxis: "horizontal" | "vertical" | "shortest",
): { labelX: number; labelY: number } {
  const result = pushRectOutOfObstacles(
    {
      height: LABEL_HEIGHT,
      width: labelWidth,
      x: labelX - labelWidth / 2,
      y: labelY - LABEL_HEIGHT / 2,
    },
    obstacles,
    preferredAxis,
  );
  return {
    labelX: result.x + labelWidth / 2,
    labelY: result.y + LABEL_HEIGHT / 2,
  };
}

/**
 * Iterative "push out" collision resolver. Given a top-left rect and a list of
 * top-left obstacle rects, shift the rect along the caller's preferred axis
 * (or the shortest escape direction) until it no longer overlaps any
 * obstacle. Bounded number of passes since one shift can move the rect into a
 * different obstacle.
 */
function pushRectOutOfObstacles(
  rect: Rect,
  obstacles: readonly Rect[],
  preferredAxis: "horizontal" | "vertical" | "shortest",
): { x: number; y: number } {
  const margin = 6;
  let x = rect.x;
  let y = rect.y;
  const w = rect.width;
  const h = rect.height;
  for (let iter = 0; iter < 16; iter++) {
    let overlapped = false;
    for (const o of obstacles) {
      const right = x + w;
      const bottom = y + h;
      const oRight = o.x + o.width;
      const oBottom = o.y + o.height;
      if (right <= o.x || x >= oRight || bottom <= o.y || y >= oBottom) {
        continue;
      }
      overlapped = true;
      const escapeLeft = right - o.x + margin;
      const escapeRight = oRight - x + margin;
      const escapeUp = bottom - o.y + margin;
      const escapeDown = oBottom - y + margin;
      if (preferredAxis === "horizontal") {
        if (escapeLeft <= escapeRight) x -= escapeLeft;
        else x += escapeRight;
      } else if (preferredAxis === "vertical") {
        if (escapeUp <= escapeDown) y -= escapeUp;
        else y += escapeDown;
      } else {
        const minEscape = Math.min(
          escapeLeft,
          escapeRight,
          escapeUp,
          escapeDown,
        );
        if (minEscape === escapeLeft) x -= escapeLeft;
        else if (minEscape === escapeRight) x += escapeRight;
        else if (minEscape === escapeUp) y -= escapeUp;
        else y += escapeDown;
      }
    }
    if (!overlapped) break;
  }
  return { x, y };
}

function selfLoop(
  edge: LogicalEdge,
  node: { x: number; y: number; width: number; height: number },
  labelWidth: number,
): EdgeRouting {
  const startX = node.x + node.width * 0.7;
  const startY = node.y;
  const endX = node.x + node.width * 0.3;
  const endY = node.y;
  const arcHeight = 36 + edge.laneIndex * 22;
  const top = startY - arcHeight;
  const waypoints = [
    { x: startX, y: startY },
    { x: startX, y: top },
    { x: endX, y: top },
    { x: endX, y: endY },
  ];
  const path = orthogonalPath(waypoints);
  const labelX = node.x + node.width / 2;
  const labelY = top;
  return buildEdgeRouting(edge, waypoints, path, labelX, labelY, labelWidth);
}

function buildEdgeRouting(
  edge: LogicalEdge,
  waypoints: Array<{ x: number; y: number }>,
  path: string,
  labelX: number,
  labelY: number,
  labelWidth: number,
): EdgeRouting {
  const layout: InspectorLayoutEdge = withMeta(edge, {
    eventType: edge.eventType,
    from: edge.from,
    geometry: { waypoints },
    labelWidth,
    labelX,
    labelY,
    path,
    to: edge.to,
  });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of waypoints) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  const bounds = {
    maxX: Math.max(maxX, labelX + labelWidth / 2),
    maxY: Math.max(maxY, labelY + LABEL_HEIGHT / 2),
    minX: Math.min(minX, labelX - labelWidth / 2),
    minY: Math.min(minY, labelY - LABEL_HEIGHT / 2),
  };
  return { bounds, layout };
}

/**
 * Collapse duplicate and collinear consecutive waypoints so a naive stair like
 * `[A, (mid, A.y), (mid, A.y), B]` becomes `[A, B]` when segments are trivial.
 * Keeps interior corners intact when they actually change direction.
 */
export function simplifyWaypoints(
  points: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  const kept: Array<{ x: number; y: number }> = [];
  for (const point of points) {
    if (kept.length === 0) {
      kept.push(point);
      continue;
    }
    const last = kept[kept.length - 1]!;
    if (last.x === point.x && last.y === point.y) continue;
    if (kept.length >= 2) {
      const prev = kept[kept.length - 2]!;
      const sameX = prev.x === last.x && last.x === point.x;
      const sameY = prev.y === last.y && last.y === point.y;
      if (sameX || sameY) {
        kept[kept.length - 1] = point;
        continue;
      }
    }
    kept.push(point);
  }
  return kept;
}

/**
 * Emit an SVG path for an orthogonal polyline with rounded corners of radius
 * `CORNER_RADIUS` at each interior waypoint. Consecutive waypoints must define
 * axis-aligned segments (i.e. share either an x or a y coordinate).
 */
export function orthogonalPath(
  waypoints: Array<{ x: number; y: number }>,
): string {
  if (waypoints.length < 2) return "";
  const first = waypoints[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1]!;
    const curr = waypoints[i]!;
    const next = waypoints[i + 1]!;
    const inLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const outLen = Math.hypot(next.x - curr.x, next.y - curr.y);
    if (inLen === 0 || outLen === 0) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const r = Math.min(CORNER_RADIUS, inLen / 2, outLen / 2);
    const inX = (curr.x - prev.x) / inLen;
    const inY = (curr.y - prev.y) / inLen;
    const outX = (next.x - curr.x) / outLen;
    const outY = (next.y - curr.y) / outLen;
    const preX = curr.x - inX * r;
    const preY = curr.y - inY * r;
    const postX = curr.x + outX * r;
    const postY = curr.y + outY * r;
    d += ` L ${preX} ${preY} Q ${curr.x} ${curr.y} ${postX} ${postY}`;
  }
  const last = waypoints[waypoints.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function withMeta(
  edge: LogicalEdge,
  base: Omit<
    InspectorLayoutEdge,
    | "branchIndex"
    | "branchTotal"
    | "laneIndex"
    | "laneTotal"
    | "guards"
    | "isDynamic"
    | "returnSource"
  > & { geometry: InspectorLayoutEdge["geometry"] },
): InspectorLayoutEdge {
  return {
    ...base,
    branchIndex: edge.branchIndex,
    branchTotal: edge.branchTotal,
    guards: edge.guards,
    isDynamic: edge.isDynamic,
    laneIndex: edge.laneIndex,
    laneTotal: edge.laneTotal,
    returnSource: edge.returnSource,
  };
}

function estimateLabelWidth(edge: LogicalEdge): number {
  const label = formatEdgeLabel(edge);
  const diamondPadding = edge.branchTotal > 1 ? 18 : 0;
  return Math.max(28, label.length * 7 + 16 + diamondPadding);
}

export function formatEdgeLabel(edge: {
  eventType: string;
  guards: GuardCondition[];
}): string {
  const { eventType, guards } = edge;
  if (guards.length === 0) return eventType;
  if (guards.every((g) => g.negated)) return `${eventType} ELSE`;
  const parts = guards.map((g) =>
    g.negated ? `!(${g.source})` : g.source,
  );
  const joined = parts.join(" ∧ ");
  const truncated = joined.length > 22 ? joined.slice(0, 20) + "…" : joined;
  return `${eventType} IF ${truncated}`;
}

