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

test("routes forward edges as a cubic Bezier path", () => {
  const result = inspectorLayout(
    description({ a: { transitions: { next: [{ to: "b" }] } }, b: {} }),
    "a",
  );
  expect(result.edges[0]!.path.startsWith("M ")).toBe(true);
  expect(result.edges[0]!.path).toContain(" C ");
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
