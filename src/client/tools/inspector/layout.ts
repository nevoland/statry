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

  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;

  const lane = laneOffsetFor(edge);
  const forward = targetX > sourceX;

  if (forward) {
    const startY = sourceY + lane;
    const endY = targetY + lane;
    const dx = Math.max(40, (targetX - sourceX) / 2);
    const cp1X = sourceX + dx;
    const cp2X = targetX - dx;
    const path = `M ${sourceX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${targetX} ${endY}`;
    const labelX = bezierMid(sourceX, cp1X, cp2X, targetX);
    const labelY = bezierMid(startY, startY, endY, endY);
    const layout: InspectorLayoutEdge = withMeta(edge, {
      eventType: edge.eventType,
      from: edge.from,
      geometry: {
        cp1: { x: cp1X, y: startY },
        cp2: { x: cp2X, y: endY },
        source: { x: sourceX, y: startY },
        target: { x: targetX, y: endY },
      },
      labelWidth,
      labelX,
      labelY,
      path,
      to: edge.to,
    });
    const bounds = {
      maxX: Math.max(sourceX, targetX, labelX + labelWidth / 2),
      maxY: Math.max(startY, endY, labelY + LABEL_HEIGHT / 2),
      minX: Math.min(sourceX, targetX, labelX - labelWidth / 2),
      minY: Math.min(startY, endY, labelY - LABEL_HEIGHT / 2),
    };
    return { bounds, layout };
  }

  // Backward edge — dip below both nodes. Stack the dip depth by lane index
  // so parallel back-edges get distinct labels; also fan the source/target X
  // by the signed lane so the curves themselves don't overlap.
  const backSourceX = source.x + source.width / 2 + lane * 4;
  const backTargetX = target.x + target.width / 2 + lane * 4;
  const backSourceY = source.y + source.height;
  const backTargetY = target.y + target.height;
  const dip = Math.max(backSourceY, backTargetY) + 60 + edge.laneIndex * 22;
  const path = `M ${backSourceX} ${backSourceY} C ${backSourceX} ${dip}, ${backTargetX} ${dip}, ${backTargetX} ${backTargetY}`;
  const labelX = (backSourceX + backTargetX) / 2;
  const labelY = dip - 4;
  const layout: InspectorLayoutEdge = withMeta(edge, {
    eventType: edge.eventType,
    from: edge.from,
    geometry: {
      cp1: { x: backSourceX, y: dip },
      cp2: { x: backTargetX, y: dip },
      source: { x: backSourceX, y: backSourceY },
      target: { x: backTargetX, y: backTargetY },
    },
    labelWidth,
    labelX,
    labelY,
    path,
    to: edge.to,
  });
  const bounds = {
    maxX: Math.max(backSourceX, backTargetX, labelX + labelWidth / 2),
    maxY: dip + LABEL_HEIGHT / 2,
    minX: Math.min(backSourceX, backTargetX, labelX - labelWidth / 2),
    minY: Math.min(backSourceY, backTargetY, labelY - LABEL_HEIGHT / 2),
  };
  return { bounds, layout };
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
  const path = `M ${startX} ${startY} C ${startX + 20} ${startY - arcHeight}, ${endX - 20} ${endY - arcHeight}, ${endX} ${endY}`;
  const labelX = node.x + node.width / 2;
  const labelY = startY - arcHeight + 4;
  const layout: InspectorLayoutEdge = withMeta(edge, {
    eventType: edge.eventType,
    from: edge.from,
    geometry: {
      cp1: { x: startX + 20, y: startY - arcHeight },
      cp2: { x: endX - 20, y: endY - arcHeight },
      source: { x: startX, y: startY },
      target: { x: endX, y: endY },
    },
    labelWidth,
    labelX,
    labelY,
    path,
    to: edge.to,
  });
  const bounds = {
    maxX: Math.max(startX, labelX + labelWidth / 2),
    maxY: Math.max(startY, labelY + LABEL_HEIGHT / 2),
    minX: Math.min(endX, labelX - labelWidth / 2),
    minY: Math.min(startY - arcHeight, labelY - LABEL_HEIGHT / 2),
  };
  return { bounds, layout };
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

function bezierMid(p0: number, p1: number, p2: number, p3: number): number {
  return 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3;
}
