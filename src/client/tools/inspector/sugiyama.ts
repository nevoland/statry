/**
 * In-house Sugiyama-style layered layout for directed graphs. Runs four phases:
 *
 * 1. **Cycle removal**: DFS from the initial state marks back-edges (edges
 *    that close a cycle) so the rest of the algorithm can pretend the graph
 *    is a DAG.
 * 2. **Layer assignment (longest-path)**: each node's layer is the length of
 *    the longest DAG path reaching it from a root. The initial state is
 *    pinned to layer 0; unreachable states are pushed to a rightmost layer
 *    so they don't collide with the reachable graph.
 * 3. **Long-edge subdivision**: any edge that spans more than one layer gets
 *    dummy nodes inserted at every intermediate layer. The dummies exist only
 *    to guide crossing minimization — they're stripped at the end.
 * 4. **Crossing minimization (barycenter sweep)**: alternating forward/backward
 *    passes reorder each layer by the average position of the neighbors in the
 *    adjacent layer. Converges quickly for small graphs; capped at 24 passes.
 *
 * Coordinate assignment is a straight `layer × spacing` grid within-layer.
 * Nothing fancy — the crossing-minimization step is what produces the
 * qualitative improvement over the previous BFS-rank layout.
 */

export type SugiyamaEdge = { from: string; to: string };

export type SugiyamaOptions = {
  nodeWidth: number;
  nodeHeight: number;
  /** Gap between adjacent layers along the primary axis (e.g. between columns). */
  layerGap: number;
  /** Gap between siblings within a layer along the secondary axis. */
  nodeGap: number;
  /** Direction the layers grow. Default `"right"` (initial state on the left). */
  direction?: "right" | "down";
  /** Number of forward+backward sweeps for crossing minimization. Default 24. */
  maxSweeps?: number;
};

const DEFAULT_MAX_SWEEPS = 24;

export function computeLayeredLayout(
  states: string[],
  edges: readonly SugiyamaEdge[],
  initialState: string,
  options: SugiyamaOptions,
): Map<string, { x: number; y: number }> {
  const direction = options.direction ?? "right";
  const maxSweeps = options.maxSweeps ?? DEFAULT_MAX_SWEEPS;

  // Self-loops don't affect layering — skip them.
  const graphEdges = edges.filter((e) => e.from !== e.to);

  // Phase 1: cycle removal.
  const feedback = findFeedbackEdges(states, graphEdges, initialState);
  const dagEdges: SugiyamaEdge[] = graphEdges.map((e) =>
    feedback.has(edgeKey(e)) ? { from: e.to, to: e.from } : e,
  );

  // Phase 2: longest-path layering.
  const layers = assignLayers(states, dagEdges, initialState);

  // Push truly isolated states (no edges at all) to a rightmost layer so they
  // don't crowd the initial-state column.
  pinIsolatedToRight(states, dagEdges, layers);

  // Phase 3: subdivide long edges with dummies.
  const {
    augmentedNodes,
    augmentedEdges,
    layerOf,
    isDummy,
  } = insertDummies(states, dagEdges, layers);

  // Phase 4: barycenter sweep for crossing minimization.
  const buckets = groupByLayer(augmentedNodes, layerOf, states);
  const ordered = barycenterSweep(buckets, augmentedEdges, maxSweeps);

  // Coordinate assignment.
  const positions = new Map<string, { x: number; y: number }>();
  const layerKeys = Array.from(ordered.keys()).sort((a, b) => a - b);
  for (const layer of layerKeys) {
    const nodes = ordered.get(layer)!;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      if (isDummy(node)) continue;
      const primary = layer * (primaryStep(options, direction));
      const secondary = i * secondaryStep(options, direction);
      positions.set(
        node,
        direction === "right"
          ? { x: primary, y: secondary }
          : { x: secondary, y: primary },
      );
    }
  }
  return positions;
}

function primaryStep(options: SugiyamaOptions, direction: "right" | "down") {
  return direction === "right"
    ? options.nodeWidth + options.layerGap
    : options.nodeHeight + options.layerGap;
}

function secondaryStep(options: SugiyamaOptions, direction: "right" | "down") {
  return direction === "right"
    ? options.nodeHeight + options.nodeGap
    : options.nodeWidth + options.nodeGap;
}

function edgeKey(e: SugiyamaEdge): string {
  return `${e.from}->${e.to}`;
}

/**
 * Find feedback (back) edges via DFS. An edge is a back-edge if it targets a
 * node currently on the DFS recursion stack. Feedback edges are the smallest
 * set we need to remove/reverse to make the graph acyclic.
 */
function findFeedbackEdges(
  states: string[],
  edges: readonly SugiyamaEdge[],
  initialState: string,
): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const s of states) outgoing.set(s, []);
  for (const e of edges) outgoing.get(e.from)?.push(e.to);

  const feedback = new Set<string>();
  const onStack = new Set<string>();
  const done = new Set<string>();

  function dfs(node: string) {
    onStack.add(node);
    for (const target of outgoing.get(node) ?? []) {
      if (onStack.has(target)) {
        feedback.add(`${node}->${target}`);
      } else if (!done.has(target)) {
        dfs(target);
      }
    }
    onStack.delete(node);
    done.add(node);
  }

  if (states.includes(initialState)) dfs(initialState);
  for (const s of states) if (!done.has(s)) dfs(s);
  return feedback;
}

/**
 * Longest-path layering. Each node's layer is one greater than the maximum
 * layer of its DAG predecessors. The initial state is pinned to layer 0 first
 * so nothing shoves it right of another reachable node.
 */
function assignLayers(
  states: string[],
  dagEdges: readonly SugiyamaEdge[],
  initialState: string,
): Map<string, number> {
  const preds = new Map<string, string[]>();
  for (const s of states) preds.set(s, []);
  for (const e of dagEdges) preds.get(e.to)?.push(e.from);

  const layers = new Map<string, number>();
  if (states.includes(initialState)) layers.set(initialState, 0);

  const inProgress = new Set<string>();

  function compute(node: string): number {
    const cached = layers.get(node);
    if (cached !== undefined) return cached;
    if (inProgress.has(node)) return 0; // safety guard for residual cycles
    inProgress.add(node);
    const p = preds.get(node) ?? [];
    let layer = 0;
    for (const pred of p) {
      const l = compute(pred);
      if (l + 1 > layer) layer = l + 1;
    }
    inProgress.delete(node);
    layers.set(node, layer);
    return layer;
  }

  for (const s of states) compute(s);
  return layers;
}

/**
 * Truly isolated states — no incoming and no outgoing edges — get pinned to a
 * column past everything else so they don't crash into the initial-state
 * column at layer 0. States that participate in the graph but happen to sit
 * in a component disconnected from the initial state are left where the
 * longest-path pass put them.
 */
function pinIsolatedToRight(
  states: string[],
  dagEdges: readonly SugiyamaEdge[],
  layers: Map<string, number>,
): void {
  const touched = new Set<string>();
  for (const e of dagEdges) {
    touched.add(e.from);
    touched.add(e.to);
  }

  let maxLayer = 0;
  for (const layer of layers.values()) {
    if (layer > maxLayer) maxLayer = layer;
  }

  for (const s of states) {
    if (touched.has(s)) continue;
    layers.set(s, maxLayer + 1);
  }
}

/**
 * Replace each edge spanning more than one layer with a chain of virtual nodes
 * so the barycenter sweep can pull the chain into a smooth vertical position
 * rather than letting a long edge jump straight across other nodes.
 */
function insertDummies(
  states: string[],
  dagEdges: readonly SugiyamaEdge[],
  layers: Map<string, number>,
): {
  augmentedNodes: string[];
  augmentedEdges: SugiyamaEdge[];
  layerOf: Map<string, number>;
  isDummy: (id: string) => boolean;
} {
  const augmentedNodes = [...states];
  const augmentedEdges: SugiyamaEdge[] = [];
  const layerOf = new Map(layers);
  const dummies = new Set<string>();
  let counter = 0;

  for (const edge of dagEdges) {
    const from = layers.get(edge.from);
    const to = layers.get(edge.to);
    if (from === undefined || to === undefined) continue;
    const span = Math.abs(to - from);
    if (span <= 1) {
      augmentedEdges.push(edge);
      continue;
    }
    // Assume from < to since dagEdges are already oriented; step per layer.
    const step = to > from ? 1 : -1;
    let prev = edge.from;
    for (let l = from + step; l !== to; l += step) {
      const dummy = `__dummy_${counter++}`;
      augmentedNodes.push(dummy);
      dummies.add(dummy);
      layerOf.set(dummy, l);
      augmentedEdges.push({ from: prev, to: dummy });
      prev = dummy;
    }
    augmentedEdges.push({ from: prev, to: edge.to });
  }

  return {
    augmentedEdges,
    augmentedNodes,
    isDummy: (id) => dummies.has(id),
    layerOf,
  };
}

function groupByLayer(
  nodes: string[],
  layerOf: Map<string, number>,
  originalOrder: string[],
): Map<number, string[]> {
  const buckets = new Map<number, string[]>();
  // Seed insertion order with the caller-provided state order so ties in the
  // barycenter step break the same way each run.
  const orderIndex = new Map(originalOrder.map((id, i) => [id, i]));
  for (const node of nodes) {
    const layer = layerOf.get(node);
    if (layer === undefined) continue;
    let bucket = buckets.get(layer);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(layer, bucket);
    }
    bucket.push(node);
  }
  for (const [, bucket] of buckets) {
    bucket.sort((a, b) => {
      const ia = orderIndex.get(a) ?? Infinity;
      const ib = orderIndex.get(b) ?? Infinity;
      return ia - ib;
    });
  }
  return buckets;
}

/**
 * Iterative barycenter sweep. Each pass:
 *   - Forward sweep: for layer i > 0, sort by average position of predecessors
 *     in layer i-1.
 *   - Backward sweep: for layer i < last, sort by average position of
 *     successors in layer i+1.
 * Nodes with no neighbors in the reference layer keep their existing index so
 * the ordering stays stable.
 */
function barycenterSweep(
  buckets: Map<number, string[]>,
  edges: readonly SugiyamaEdge[],
  maxSweeps: number,
): Map<number, string[]> {
  const layers = Array.from(buckets.keys()).sort((a, b) => a - b);
  const current = new Map<number, string[]>();
  for (const [k, v] of buckets) current.set(k, [...v]);

  const succs = new Map<string, string[]>();
  const preds = new Map<string, string[]>();
  for (const e of edges) {
    let arr = succs.get(e.from);
    if (arr === undefined) {
      arr = [];
      succs.set(e.from, arr);
    }
    arr.push(e.to);
    arr = preds.get(e.to);
    if (arr === undefined) {
      arr = [];
      preds.set(e.to, arr);
    }
    arr.push(e.from);
  }

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    const changed =
      sweepDirection(current, layers, 1, preds) ||
      sweepDirection(current, layers, -1, succs);
    if (!changed) break;
  }

  return current;
}

function sweepDirection(
  current: Map<number, string[]>,
  layers: number[],
  step: 1 | -1,
  neighborMap: Map<string, string[]>,
): boolean {
  let changed = false;
  const start = step === 1 ? 1 : layers.length - 2;
  const end = step === 1 ? layers.length : -1;
  for (let i = start; i !== end; i += step) {
    const refLayer = layers[i - step]!;
    const layer = layers[i]!;
    const refOrder = current.get(refLayer)!;
    const refIndex = new Map(refOrder.map((id, idx) => [id, idx]));
    const nodes = current.get(layer)!;
    const reordered = orderByBarycenter(nodes, neighborMap, refIndex);
    if (!arraysEqual(nodes, reordered)) {
      current.set(layer, reordered);
      changed = true;
    }
  }
  return changed;
}

function orderByBarycenter(
  nodes: string[],
  neighborMap: Map<string, string[]>,
  neighborIndex: Map<string, number>,
): string[] {
  return nodes
    .map((id, originalIndex) => {
      const neighbors = (neighborMap.get(id) ?? []).filter((n) =>
        neighborIndex.has(n),
      );
      if (neighbors.length === 0) {
        return { bc: originalIndex, id };
      }
      let sum = 0;
      for (const n of neighbors) sum += neighborIndex.get(n)!;
      return { bc: sum / neighbors.length, id };
    })
    .sort((a, b) => a.bc - b.bc)
    .map(({ id }) => id);
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
