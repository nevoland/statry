import { expect, test } from "vitest";

import {
  clampLabelOutOfObstacles,
  clampNodeOutOfObstacles,
  inspectorLayout,
} from "./layout.js";
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

test("routes forward edges with different y as a stair through the label", () => {
  // Move `a` to a different y so the a→b edge has a Z-shape. Since labels are
  // pass-through pills (line enters left / exits right), the middle bend is
  // split around the label — giving a 4-corner stair instead of a plain Z.
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
  const lCount = (edge.path.match(/ L /g) ?? []).length;
  const qCount = (edge.path.match(/ Q /g) ?? []).length;
  expect(lCount).toBeGreaterThanOrEqual(3);
  expect(qCount).toBe(4);
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

test("uses vertical routing when target is directly below source", () => {
  // Move `b` below `a` so the primary axis is vertical.
  const overrides = new Map([["b", { x: 24, y: 300 }]]);
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
  const [source, target] = [
    edge.geometry.waypoints[0]!,
    edge.geometry.waypoints[edge.geometry.waypoints.length - 1]!,
  ];
  const aNode = result.nodes.find((n) => n.id === "a")!;
  const bNode = result.nodes.find((n) => n.id === "b")!;
  // Source dock at bottom of a (y = a.bottom); target dock at top of b (y = b.top).
  expect(source.y).toBeCloseTo(aNode.y + aNode.height);
  expect(target.y).toBeCloseTo(bNode.y);
  // And centered horizontally at each node's midpoint.
  expect(source.x).toBeCloseTo(aNode.x + aNode.width / 2);
  expect(target.x).toBeCloseTo(bNode.x + bNode.width / 2);
});

test("uses horizontal routing going left when target is to the left of source", () => {
  const overrides = new Map([
    ["a", { x: 300, y: 24 }],
    ["b", { x: 24, y: 24 }],
  ]);
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
  const source = edge.geometry.waypoints[0]!;
  const target = edge.geometry.waypoints[edge.geometry.waypoints.length - 1]!;
  const aNode = result.nodes.find((n) => n.id === "a")!;
  const bNode = result.nodes.find((n) => n.id === "b")!;
  // Since b is to the left of a, source docks at a's LEFT edge and target
  // docks at b's RIGHT edge — both at the midY of their respective nodes.
  expect(source.x).toBeCloseTo(aNode.x);
  expect(target.x).toBeCloseTo(bNode.x + bNode.width);
});

test("content bounds encompass self-loop arcs above the node row", () => {
  const desc = description({
    a: { transitions: { next: [{ to: "b" }] } },
    b: { transitions: { back: [{ to: "a" }], tick: [{ to: "b" }] } },
  });
  const result = inspectorLayout(desc, "a");
  const selfEdge = result.edges.find(
    (e) => e.from === "b" && e.to === "b",
  )!;
  const firstNode = result.nodes[0]!;
  // The self-loop arc peak sits above the node row.
  expect(selfEdge.labelY).toBeLessThan(firstNode.y);
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
  // Labels are fanned out vertically perpendicular to the flow so each pill
  // sits at its own y.
  const labelYs = edges.map((e) => e.labelY);
  expect(new Set(labelYs).size).toBe(3);
});

test("parallel edges dock at the same source and target points", () => {
  const desc = description({
    a: {
      transitions: {
        alt: [{ to: "b" }],
        tick: [{ to: "b" }],
      },
    },
    b: {},
  });
  const result = inspectorLayout(desc, "a");
  const edges = result.edges.filter((e) => e.from === "a" && e.to === "b");
  const sourceDocks = edges.map((e) => e.geometry.waypoints[0]!);
  const targetDocks = edges.map(
    (e) => e.geometry.waypoints[e.geometry.waypoints.length - 1]!,
  );
  // All parallel edges enter/leave through the same dock point on each node.
  expect(new Set(sourceDocks.map((d) => `${d.x},${d.y}`)).size).toBe(1);
  expect(new Set(targetDocks.map((d) => `${d.x},${d.y}`)).size).toBe(1);
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

test("auto-layout labels never overlap the node boxes", () => {
  // Drag `b` to the same y as `a` so the natural label midpoint would fall
  // right on top of one of the boxes if no collision resolution kicked in.
  const desc = description({
    a: { transitions: { next: [{ to: "b" }] } },
    b: {},
  });
  const overrides = new Map([["a", { x: 24, y: 24 }], ["b", { x: 200, y: 24 }]]);
  const result = inspectorLayout(desc, "a", [], overrides);
  const [aNode, bNode] = [
    result.nodes.find((n) => n.id === "a")!,
    result.nodes.find((n) => n.id === "b")!,
  ];
  const edge = result.edges[0]!;
  const labelLeft = edge.labelX - edge.labelWidth / 2;
  const labelRight = edge.labelX + edge.labelWidth / 2;
  const labelTop = edge.labelY - 9;
  const labelBottom = edge.labelY + 9;
  for (const node of [aNode, bNode]) {
    const disjoint =
      labelRight <= node.x ||
      labelLeft >= node.x + node.width ||
      labelBottom <= node.y ||
      labelTop >= node.y + node.height;
    expect(disjoint).toBe(true);
  }
});

test("clampLabelOutOfObstacles pushes a label out of an overlapping node", () => {
  const nodes = [{ x: 100, y: 100, width: 140, height: 40 }];
  // Label starts smack in the middle of the node.
  const clamped = clampLabelOutOfObstacles(170, 120, 60, nodes);
  const halfW = 30;
  const halfH = 9;
  const disjoint =
    clamped.labelX + halfW <= nodes[0]!.x ||
    clamped.labelX - halfW >= nodes[0]!.x + nodes[0]!.width ||
    clamped.labelY + halfH <= nodes[0]!.y ||
    clamped.labelY - halfH >= nodes[0]!.y + nodes[0]!.height;
  expect(disjoint).toBe(true);
});

test("clampLabelOutOfObstacles leaves a non-overlapping label alone", () => {
  const nodes = [{ x: 100, y: 100, width: 140, height: 40 }];
  const clamped = clampLabelOutOfObstacles(400, 400, 60, nodes);
  expect(clamped.labelX).toBe(400);
  expect(clamped.labelY).toBe(400);
});

test("clampLabelOutOfObstacles avoids other label pills too", () => {
  // A previously-placed label sits at (200, 200) with width 100, height 18.
  const otherLabel = { x: 150, y: 191, width: 100, height: 18 };
  const clamped = clampLabelOutOfObstacles(220, 200, 60, [otherLabel]);
  const halfW = 30;
  const halfH = 9;
  const disjoint =
    clamped.labelX + halfW <= otherLabel.x ||
    clamped.labelX - halfW >= otherLabel.x + otherLabel.width ||
    clamped.labelY + halfH <= otherLabel.y ||
    clamped.labelY - halfH >= otherLabel.y + otherLabel.height;
  expect(disjoint).toBe(true);
});

test("auto-layout gives parallel-edge labels non-overlapping pill rects", () => {
  const desc = description({
    a: {
      transitions: {
        first: [{ to: "b" }],
        second: [{ to: "b" }],
        third: [{ to: "b" }],
      },
    },
    b: {},
  });
  const result = inspectorLayout(desc, "a");
  const labelRects = result.edges.map((e) => ({
    x: e.labelX - e.labelWidth / 2,
    y: e.labelY - 9,
    width: e.labelWidth,
    height: 18,
  }));
  for (let i = 0; i < labelRects.length; i++) {
    for (let j = i + 1; j < labelRects.length; j++) {
      const a = labelRects[i]!;
      const b = labelRects[j]!;
      const disjoint =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y;
      expect(disjoint).toBe(true);
    }
  }
});

test("clampNodeOutOfObstacles pushes a node out of another node", () => {
  const others = [{ x: 100, y: 100, width: 140, height: 40 }];
  // Proposed position overlaps significantly.
  const clamped = clampNodeOutOfObstacles(150, 110, 140, 40, others);
  const disjoint =
    clamped.x + 140 <= others[0]!.x ||
    clamped.x >= others[0]!.x + others[0]!.width ||
    clamped.y + 40 <= others[0]!.y ||
    clamped.y >= others[0]!.y + others[0]!.height;
  expect(disjoint).toBe(true);
});

test("clampNodeOutOfObstacles is a no-op when the node is clear", () => {
  const others = [{ x: 100, y: 100, width: 140, height: 40 }];
  const clamped = clampNodeOutOfObstacles(400, 400, 140, 40, others);
  expect(clamped.x).toBe(400);
  expect(clamped.y).toBe(400);
});
