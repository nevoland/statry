import { expect, test } from "vitest";

import { inspectorLayout } from "./layout.js";
import type { InspectorLearnedEdge } from "./types.js";

test("places the initial state in the leftmost column at rank 0", () => {
  const result = inspectorLayout(["idle", "drag"], [], "idle");
  const idle = result.nodes.find((node) => node.id === "idle");
  const drag = result.nodes.find((node) => node.id === "drag");
  expect(idle).toBeDefined();
  expect(drag).toBeDefined();
  expect(idle!.x).toBeLessThan(drag!.x);
});

test("assigns ranks via BFS from the initial state along observed edges", () => {
  const edges: InspectorLearnedEdge[] = [
    { count: 1, eventType: "next", from: "a", to: "b" },
    { count: 1, eventType: "next", from: "b", to: "c" },
  ];
  const result = inspectorLayout(["a", "b", "c"], edges, "a");
  const positions = new Map(result.nodes.map((node) => [node.id, node.x]));
  expect(positions.get("a")!).toBeLessThan(positions.get("b")!);
  expect(positions.get("b")!).toBeLessThan(positions.get("c")!);
});

test("routes forward edges as a cubic Bezier path", () => {
  const edges: InspectorLearnedEdge[] = [
    { count: 1, eventType: "next", from: "a", to: "b" },
  ];
  const result = inspectorLayout(["a", "b"], edges, "a");
  expect(result.edges).toHaveLength(1);
  expect(result.edges[0]!.path.startsWith("M ")).toBe(true);
  expect(result.edges[0]!.path).toContain(" C ");
});

test("routes self-loops as an arc above the node", () => {
  const edges: InspectorLearnedEdge[] = [
    { count: 1, eventType: "tick", from: "a", to: "a" },
  ];
  const result = inspectorLayout(["a"], edges, "a");
  expect(result.edges).toHaveLength(1);
  const node = result.nodes[0]!;
  expect(result.edges[0]!.labelY).toBeLessThan(node.y);
});

test("places unreached states in an orphan column past the reached ones", () => {
  const edges: InspectorLearnedEdge[] = [
    { count: 1, eventType: "next", from: "a", to: "b" },
  ];
  const result = inspectorLayout(["a", "b", "orphan"], edges, "a");
  const positions = new Map(result.nodes.map((node) => [node.id, node.x]));
  expect(positions.get("orphan")!).toBeGreaterThan(positions.get("b")!);
});
