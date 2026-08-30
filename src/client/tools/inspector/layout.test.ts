import { expect, test } from "vitest";

import { inspectorLayout } from "./layout.js";
import type { MachineDescription } from "./types.js";

function description(
  states: Record<
    string,
    { transitions?: Record<string, Array<{ to?: string; guard?: string }>> }
  >,
): MachineDescription {
  const built: MachineDescription = { states: {} };
  for (const [stateType, def] of Object.entries(states)) {
    built.states[stateType] = {
      eventTypes: Object.keys(def.transitions ?? {}),
      hasEnter: false,
      transitions: Object.entries(def.transitions ?? {}).map(
        ([eventType, branches]) => ({
          branches: branches.map((b, index, arr) => ({
            guards:
              b.guard === undefined
                ? []
                : [{ negated: index === arr.length - 1, source: b.guard }],
            kind: b.to === undefined ? "self" : "transition",
            returnSource: b.to === undefined ? "state" : `{ type: "${b.to}" }`,
            targetStateType: b.to ?? null,
          })),
          eventType,
        }),
      ),
      type: stateType,
    };
  }
  return built;
}

test("places the initial state in the leftmost column", () => {
  const result = inspectorLayout(
    description({
      drag: { transitions: { mouseup: [{ to: "idle" }] } },
      idle: { transitions: { mousedown: [{ to: "drag" }] } },
    }),
    "idle",
  );
  const idle = result.nodes.find((n) => n.id === "idle");
  const drag = result.nodes.find((n) => n.id === "drag");
  expect(idle!.x).toBeLessThan(drag!.x);
});

test("enumerates a static edge for each transition branch", () => {
  const result = inspectorLayout(
    description({
      a: {
        transitions: {
          next: [
            { guard: "cond", to: "b" },
            { guard: "cond", to: "c" },
          ],
        },
      },
      b: {},
      c: {},
    }),
    "a",
  );
  expect(result.edges).toHaveLength(2);
  const bEdge = result.edges.find((e) => e.to === "b")!;
  const cEdge = result.edges.find((e) => e.to === "c")!;
  expect(bEdge.branchTotal).toBe(2);
  expect(cEdge.branchTotal).toBe(2);
  expect(bEdge.branchIndex).not.toBe(cEdge.branchIndex);
});

test("skips self-return branches from the diagram", () => {
  const result = inspectorLayout(
    description({
      off: {
        transitions: {
          statetransition: [{ guard: "connected", to: "on" }, {}],
        },
      },
      on: {},
    }),
    "off",
  );
  expect(result.edges).toHaveLength(1);
  expect(result.edges[0]!.to).toBe("on");
});

test("routes forward edges as an orthogonal path with L segments", () => {
  const result = inspectorLayout(
    description({ a: { transitions: { next: [{ to: "b" }] } }, b: {} }),
    "a",
  );
  expect(result.edges[0]!.path.startsWith("M ")).toBe(true);
  expect(result.edges[0]!.path).toContain(" L ");
  // Same-y forward edges are straight horizontal — no turns, so no Q.
  expect(result.edges[0]!.path).not.toContain(" Q ");
});

test("routes forward edges with different y as a Z-shape (two rounded turns)", () => {
  // Move `a` to a different y so the a→b edge has a Z-shape.
  const overrides = new Map([["a", { x: 24, y: 200 }]]);
  const result = inspectorLayout(
    description({
      a: { transitions: { next: [{ to: "b" }] } },
      b: {},
    }),
    "a",
    [],
    overrides,
  );
  const edge = result.edges[0]!;
  // Z-shape: source → mid corner → mid corner → target = 3 L segments + 2 Q turns.
  const lCount = (edge.path.match(/ L /g) ?? []).length;
  const qCount = (edge.path.match(/ Q /g) ?? []).length;
  expect(lCount).toBeGreaterThanOrEqual(3);
  expect(qCount).toBe(2);
});

test("places unreached states in an orphan column", () => {
  const result = inspectorLayout(
    description({
      a: { transitions: { next: [{ to: "b" }] } },
      b: {},
      orphan: {},
    }),
    "a",
  );
  const positions = new Map(result.nodes.map((n) => [n.id, n.x]));
  expect(positions.get("orphan")!).toBeGreaterThan(positions.get("b")!);
});

test("dynamic edges show up as separate edges when they don't match a static one", () => {
  const desc = description({
    a: { transitions: { next: [{ to: "b" }] } },
    b: {},
    c: {},
  });
  const result = inspectorLayout(desc, "a", [
    { count: 1, eventType: "surprise", from: "a", to: "c" },
  ]);
  const dynamic = result.edges.find((e) => e.isDynamic);
  expect(dynamic).toBeDefined();
  expect(dynamic!.to).toBe("c");
});

test("content bounds encompass back-edge dips and self-loop arcs", () => {
  const desc = description({
    a: { transitions: { next: [{ to: "b" }] } },
    b: { transitions: { back: [{ to: "a" }], tick: [{ to: "b" }] } },
  });
  const result = inspectorLayout(desc, "a");
  const backEdge = result.edges.find(
    (e) => e.from === "b" && e.to === "a",
  )!;
  const selfEdge = result.edges.find(
    (e) => e.from === "b" && e.to === "b",
  )!;
  // The back-edge dips below the last node row.
  const lastNode = result.nodes[result.nodes.length - 1]!;
  expect(backEdge.labelY).toBeGreaterThan(lastNode.y + lastNode.height);
  // The viewBox bottom (minY + height) must exceed the back-edge dip.
  expect(result.minY + result.height).toBeGreaterThanOrEqual(backEdge.labelY);
  // The viewBox top (minY) must be at or above the self-loop arc peak.
  expect(result.minY).toBeLessThanOrEqual(selfEdge.labelY);
});

test("parallel edges between the same pair get distinct lanes", () => {
  const desc = description({
    a: {
      transitions: {
        alt: [{ to: "b" }],
        tick: [{ to: "b" }],
        wave: [{ to: "b" }],
      },
    },
    b: {},
  });
  const result = inspectorLayout(desc, "a");
  const edges = result.edges.filter((e) => e.from === "a" && e.to === "b");
  expect(edges).toHaveLength(3);
  const laneTotals = new Set(edges.map((e) => e.laneTotal));
  const laneIndices = new Set(edges.map((e) => e.laneIndex));
  expect(laneTotals).toEqual(new Set([3]));
  expect(laneIndices).toEqual(new Set([0, 1, 2]));
  // Different labelY positions -> visually separated.
  const labelYs = edges.map((e) => e.labelY);
  expect(new Set(labelYs).size).toBe(3);
});

test("node overrides move nodes to the provided positions", () => {
  const desc = description({
    a: { transitions: { next: [{ to: "b" }] } },
    b: {},
  });
  const overrides = new Map([["b", { x: 500, y: 400 }]]);
  const result = inspectorLayout(desc, "a", [], overrides);
  const bNode = result.nodes.find((n) => n.id === "b")!;
  expect(bNode.x).toBe(500);
  expect(bNode.y).toBe(400);
});
