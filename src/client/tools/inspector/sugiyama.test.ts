import { expect, test } from "vitest";

import { computeLayeredLayout, type SugiyamaEdge } from "./sugiyama.js";

const OPTS = {
  layerGap: 80,
  nodeGap: 40,
  nodeHeight: 40,
  nodeWidth: 140,
};

function positionsOf(
  states: string[],
  edges: SugiyamaEdge[],
  initial: string,
) {
  return computeLayeredLayout(states, edges, initial, OPTS);
}

test("initial state lands at layer 0 (x = 0)", () => {
  const result = positionsOf(["a", "b"], [{ from: "a", to: "b" }], "a");
  expect(result.get("a")!.x).toBe(0);
  expect(result.get("b")!.x).toBeGreaterThan(0);
});

test("a chain a→b→c places nodes in strictly increasing x", () => {
  const result = positionsOf(
    ["a", "b", "c"],
    [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ],
    "a",
  );
  expect(result.get("a")!.x).toBeLessThan(result.get("b")!.x);
  expect(result.get("b")!.x).toBeLessThan(result.get("c")!.x);
});

test("longest-path layering picks the deeper predecessor", () => {
  // a→b, a→c, b→d, c→d — d must sit two layers right of a (via a→b→d or a→c→d).
  const result = positionsOf(
    ["a", "b", "c", "d"],
    [
      { from: "a", to: "b" },
      { from: "a", to: "c" },
      { from: "b", to: "d" },
      { from: "c", to: "d" },
    ],
    "a",
  );
  const layerStep = OPTS.nodeWidth + OPTS.layerGap;
  expect(result.get("a")!.x).toBe(0);
  expect(result.get("d")!.x).toBe(layerStep * 2);
});

test("back-edges do not shove the initial state to the right", () => {
  // a → b → a is a 1-cycle. After feedback-edge removal the DAG is a → b, so
  // a stays at layer 0.
  const result = positionsOf(
    ["a", "b"],
    [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ],
    "a",
  );
  expect(result.get("a")!.x).toBe(0);
  expect(result.get("b")!.x).toBeGreaterThan(0);
});

test("unreachable states are pushed to a rightmost column", () => {
  const result = positionsOf(
    ["a", "b", "orphan"],
    [{ from: "a", to: "b" }],
    "a",
  );
  const bx = result.get("b")!.x;
  const orphanx = result.get("orphan")!.x;
  expect(orphanx).toBeGreaterThan(bx);
});

test("barycenter sweep reduces crossings in a bipartite fan", () => {
  // Layer 0: a1, a2, a3.
  // Layer 1: b1, b2, b3.
  // Edges: a1→b3, a2→b2, a3→b1. Initial order would cross; after sweep the b
  // layer should be reordered to [b3, b2, b1] to line up with a1..a3.
  const result = positionsOf(
    ["a1", "a2", "a3", "b1", "b2", "b3"],
    [
      { from: "a1", to: "b3" },
      { from: "a2", to: "b2" },
      { from: "a3", to: "b1" },
    ],
    "a1",
  );
  // a1..a3 stack in that order; barycenter should place b3 above b2 above b1
  // (opposite of insertion order) to align with the crossing pattern.
  const b1y = result.get("b1")!.y;
  const b2y = result.get("b2")!.y;
  const b3y = result.get("b3")!.y;
  expect(b3y).toBeLessThan(b2y);
  expect(b2y).toBeLessThan(b1y);
});

test("self-loops are ignored for layering", () => {
  // The self-loop a→a should not affect a's placement.
  const result = positionsOf(
    ["a", "b"],
    [
      { from: "a", to: "a" },
      { from: "a", to: "b" },
    ],
    "a",
  );
  expect(result.get("a")!.x).toBe(0);
  expect(result.get("b")!.x).toBeGreaterThan(0);
});

test("`down` direction swaps primary and secondary axes", () => {
  const result = computeLayeredLayout(
    ["a", "b"],
    [{ from: "a", to: "b" }],
    "a",
    { ...OPTS, direction: "down" },
  );
  expect(result.get("a")!.y).toBe(0);
  expect(result.get("b")!.y).toBeGreaterThan(0);
  // x is the secondary axis for `down`, so both nodes share x = 0.
  expect(result.get("a")!.x).toBe(0);
  expect(result.get("b")!.x).toBe(0);
});
