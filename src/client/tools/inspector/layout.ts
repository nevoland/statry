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

type LogicalEdge = {
  from: string;
  to: string;
  eventType: string;
  branchIndex: number;
  branchTotal: number;
  guards: GuardCondition[];
  isDynamic: boolean;
};

export function inspectorLayout(
  description: MachineDescription,
  initialState: string,
  dynamicEdges: InspectorLearnedEdge[] = [],
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
  let maxRow = 0;
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
      if (rowIndex > maxRow) maxRow = rowIndex;
    });
  });

  const layoutNodes = states
    .filter((id) => nodePositions.has(id))
    .map((id) => ({ id, ...nodePositions.get(id)! }));

  const layoutEdges: InspectorLayoutEdge[] = logicalEdges
    .map((edge) => routeEdge(edge, nodePositions))
    .filter((edge): edge is InspectorLayoutEdge => edge !== undefined);

  const width =
    MARGIN * 2 + columns.length * NODE_WIDTH + (columns.length - 1) * COLUMN_GAP;
  const height = MARGIN * 2 + (maxRow + 1) * NODE_HEIGHT + maxRow * ROW_GAP;

  return { edges: layoutEdges, height, nodes: layoutNodes, width };
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
      to: dyn.to,
    });
  }

  return edges;
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
): InspectorLayoutEdge | undefined {
  const source = positions.get(edge.from);
  const target = positions.get(edge.to);
  if (source === undefined || target === undefined) return undefined;

  if (edge.from === edge.to) {
    return withEdgeMeta(edge, selfLoop(edge, source));
  }

  const sourceX = source.x + source.width;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x;
  const targetY = target.y + target.height / 2;

  const forward = targetX > sourceX;

  // If the source state has multiple branches on the same event, fan out
  // the vertical starting points so parallel edges don't overlap.
  const laneOffset = laneOffsetFor(edge);

  if (forward) {
    const startY = sourceY + laneOffset;
    const endY = targetY + laneOffset;
    const dx = Math.max(40, (targetX - sourceX) / 2);
    const cp1X = sourceX + dx;
    const cp2X = targetX - dx;
    const path = `M ${sourceX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${targetX} ${endY}`;
    const labelX = bezierMid(sourceX, cp1X, cp2X, targetX);
    const labelY = bezierMid(startY, startY, endY, endY);
    return withEdgeMeta(edge, {
      eventType: edge.eventType,
      from: edge.from,
      labelX,
      labelY,
      path,
      to: edge.to,
    });
  }

  const backSourceX = source.x + source.width / 2 + laneOffset * 4;
  const backTargetX = target.x + target.width / 2 + laneOffset * 4;
  const backSourceY = source.y + source.height;
  const backTargetY = target.y + target.height;
  const dip = Math.max(backSourceY, backTargetY) + 60 + Math.abs(laneOffset) * 6;
  const path = `M ${backSourceX} ${backSourceY} C ${backSourceX} ${dip}, ${backTargetX} ${dip}, ${backTargetX} ${backTargetY}`;
  const labelX = (backSourceX + backTargetX) / 2;
  const labelY = dip - 4;
  return withEdgeMeta(edge, {
    eventType: edge.eventType,
    from: edge.from,
    labelX,
    labelY,
    path,
    to: edge.to,
  });
}

function laneOffsetFor(edge: LogicalEdge): number {
  if (edge.branchTotal <= 1) return 0;
  const centered = edge.branchIndex - (edge.branchTotal - 1) / 2;
  return centered * 12;
}

function selfLoop(
  edge: LogicalEdge,
  node: { x: number; y: number; width: number; height: number },
): Omit<InspectorLayoutEdge, "branchIndex" | "branchTotal" | "guards" | "isDynamic"> {
  const startX = node.x + node.width * 0.7;
  const startY = node.y;
  const endX = node.x + node.width * 0.3;
  const endY = node.y;
  const arcHeight = 36;
  const path = `M ${startX} ${startY} C ${startX + 20} ${startY - arcHeight}, ${endX - 20} ${endY - arcHeight}, ${endX} ${endY}`;
  return {
    eventType: edge.eventType,
    from: edge.from,
    labelX: node.x + node.width / 2,
    labelY: startY - arcHeight + 4,
    path,
    to: edge.to,
  };
}

function withEdgeMeta(
  edge: LogicalEdge,
  base: Omit<
    InspectorLayoutEdge,
    "branchIndex" | "branchTotal" | "guards" | "isDynamic"
  >,
): InspectorLayoutEdge {
  return {
    ...base,
    branchIndex: edge.branchIndex,
    branchTotal: edge.branchTotal,
    guards: edge.guards,
    isDynamic: edge.isDynamic,
  };
}

function bezierMid(p0: number, p1: number, p2: number, p3: number): number {
  return 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3;
}
