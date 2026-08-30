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

export function inspectorLayout(
  description: MachineDescription,
  initialState: string,
  dynamicEdges: InspectorLearnedEdge[] = [],
  overrides: Map<string, { x: number; y: number }> = new Map(),
): InspectorLayoutResult {
  const states = Object.keys(description.states);
  const logicalEdges = collectLogicalEdges(description, dynamicEdges);

  const outgoing = new Map<string, LogicalEdge[]>();
  for (const edge of logicalEdges) {
    const list = outgoing.get(edge.from);
    if (list === undefined) outgoing.set(edge.from, [edge]);
    else list.push(edge);
  }

  const ranks = assignRanks(states, outgoing, initialState);
  const columns = groupByRank(states, ranks);

  const nodePositions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  columns.forEach((column, rankIndex) => {
    column.forEach((stateId, rowIndex) => {
      const x = MARGIN + rankIndex * (NODE_WIDTH + COLUMN_GAP);
      const y = MARGIN + rowIndex * (NODE_HEIGHT + ROW_GAP);
      nodePositions.set(stateId, {
        height: NODE_HEIGHT,
        width: NODE_WIDTH,
        x,
        y,
      });
    });
  });

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

  const routedEdges = logicalEdges
    .map((edge) => routeEdge(edge, nodePositions))
    .filter((edge): edge is EdgeRouting => edge !== undefined);

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

function assignRanks(
  states: string[],
  outgoing: Map<string, LogicalEdge[]>,
  initialState: string,
): Map<string, number> {
  const ranks = new Map<string, number>();
  if (states.includes(initialState)) {
    ranks.set(initialState, 0);
  }

  const queue: string[] = [initialState];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentRank = ranks.get(current);
    if (currentRank === undefined) continue;
    for (const edge of outgoing.get(current) ?? []) {
      if (ranks.has(edge.to)) continue;
      ranks.set(edge.to, currentRank + 1);
      queue.push(edge.to);
    }
  }

  let orphanRank = 0;
  for (const rank of ranks.values()) {
    if (rank > orphanRank) orphanRank = rank;
  }
  orphanRank += 1;

  for (const state of states) {
    if (!ranks.has(state)) {
      ranks.set(state, orphanRank);
    }
  }

  return ranks;
}

function groupByRank(
  states: string[],
  ranks: Map<string, number>,
): string[][] {
  const columns: string[][] = [];
  for (const state of states) {
    const rank = ranks.get(state);
    if (rank === undefined) continue;
    while (columns.length <= rank) columns.push([]);
    columns[rank]!.push(state);
  }
  return columns;
}

const CORNER_RADIUS = 8;

function routeEdge(
  edge: LogicalEdge,
  positions: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >,
): EdgeRouting | undefined {
  const source = positions.get(edge.from);
  const target = positions.get(edge.to);
  if (source === undefined || target === undefined) return undefined;

  const labelWidth = estimateLabelWidth(edge);

  if (edge.from === edge.to) {
    return selfLoop(edge, source, labelWidth);
  }

  const lane = laneOffsetFor(edge);
  const forward = target.x > source.x + source.width;

  if (forward) {
    return routeForward(edge, source, target, lane, labelWidth);
  }
  return routeBack(edge, source, target, lane, labelWidth);
}

function routeForward(
  edge: LogicalEdge,
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
  lane: number,
  labelWidth: number,
): EdgeRouting {
  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2 + lane;
  const targetX = target.x;
  const targetY = target.y + target.height / 2 + lane;

  let waypoints: Array<{ x: number; y: number }>;
  let labelX: number;
  let labelY: number;

  if (Math.abs(sourceY - targetY) < 1) {
    // Straight horizontal — one segment.
    waypoints = [
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
    ];
    labelX = (sourceX + targetX) / 2;
    labelY = sourceY;
  } else {
    // Z-shape with two turns. Offset the mid-column X by lane so parallel Zs
    // don't overlap their vertical segments.
    const midX = (sourceX + targetX) / 2 + lane;
    waypoints = [
      { x: sourceX, y: sourceY },
      { x: midX, y: sourceY },
      { x: midX, y: targetY },
      { x: targetX, y: targetY },
    ];
    labelX = midX;
    labelY = (sourceY + targetY) / 2;
  }

  const path = orthogonalPath(waypoints);
  return buildEdgeRouting(edge, waypoints, path, labelX, labelY, labelWidth);
}

function routeBack(
  edge: LogicalEdge,
  source: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
  lane: number,
  labelWidth: number,
): EdgeRouting {
  // Backward edge — U-shape dipping below both nodes. Stack the dip depth by
  // lane index so parallel back-edges get distinct labels; also fan the
  // source/target X by the signed lane so the curves themselves don't overlap.
  const backSourceX = source.x + source.width / 2 + lane * 4;
  const backTargetX = target.x + target.width / 2 + lane * 4;
  const backSourceY = source.y + source.height;
  const backTargetY = target.y + target.height;
  const dip = Math.max(backSourceY, backTargetY) + 60 + edge.laneIndex * 22;
  const waypoints = [
    { x: backSourceX, y: backSourceY },
    { x: backSourceX, y: dip },
    { x: backTargetX, y: dip },
    { x: backTargetX, y: backTargetY },
  ];
  const path = orthogonalPath(waypoints);
  const labelX = (backSourceX + backTargetX) / 2;
  const labelY = dip;
  return buildEdgeRouting(edge, waypoints, path, labelX, labelY, labelWidth);
}

function laneOffsetFor(edge: LogicalEdge): number {
  if (edge.laneTotal <= 1) return 0;
  const centered = edge.laneIndex - (edge.laneTotal - 1) / 2;
  return centered * 22;
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

