import { expect, test } from "vitest";

import { ENTER, StateMachine } from "#lib";
import type { Definition } from "#lib";

import { analyzeDefinition, analyzeHandler } from "./analyze.js";

test("arrow with implicit object literal return", () => {
  const result = analyzeHandler(() => ({ type: "on" }));
  expect(result.error).toBeUndefined();
  expect(result.branches).toEqual([
    {
      guards: [],
      kind: "transition",
      returnSource: expect.stringContaining("on"),
      targetStateType: "on",
    },
  ]);
});

test("block body with if-return then unconditional return", () => {
  const handler = function (event: { type: string }) {
    if (event.type === "connected") return { type: "on" };
    return { type: "off" };
  };
  const result = analyzeHandler(handler);
  expect(result.branches).toHaveLength(2);
  expect(result.branches![0]!.kind).toBe("transition");
  expect(result.branches![0]!.targetStateType).toBe("on");
  expect(result.branches![0]!.guards).toHaveLength(1);
  expect(result.branches![0]!.guards[0]!.negated).toBe(false);
  expect(result.branches![1]!.targetStateType).toBe("off");
  expect(result.branches![1]!.guards[0]!.negated).toBe(true);
});

test("ternary in return produces two guarded branches", () => {
  const handler = (event: { value: number }) =>
    event.value > 10 ? { type: "high" } : { type: "low" };
  const result = analyzeHandler(handler);
  expect(result.branches).toHaveLength(2);
  expect(result.branches![0]!.targetStateType).toBe("high");
  expect(result.branches![1]!.targetStateType).toBe("low");
  expect(result.branches![0]!.guards[0]!.negated).toBe(false);
  expect(result.branches![1]!.guards[0]!.negated).toBe(true);
});

test("switch statement produces one branch per case", () => {
  const handler = function (event: { value: string }) {
    switch (event.value) {
      case "a":
        return { type: "red" };
      case "b":
        return { type: "green" };
      default:
        return { type: "blue" };
    }
  };
  const result = analyzeHandler(handler);
  expect(result.branches).toHaveLength(3);
  expect(result.branches!.map((b) => b.targetStateType)).toEqual([
    "red",
    "green",
    "blue",
  ]);
  expect(result.branches![0]!.guards[0]!.source).toContain('=== "a"');
});

test("returning the state parameter is a self-branch", () => {
  const handler = (_event: unknown, state: unknown) => state;
  const result = analyzeHandler(handler);
  expect(result.branches).toHaveLength(1);
  expect(result.branches![0]!.kind).toBe("self");
});

test("returning a computed expression is unknown", () => {
  const compute = () => ({ type: "x" });
  const handler = () => compute();
  const result = analyzeHandler(handler);
  expect(result.branches![0]!.kind).toBe("unknown");
});

test("method shorthand is parsed via object-literal wrapping", () => {
  const definition = {
    idle: {
      mousedown(_event: unknown, _state: unknown) {
        return { type: "drag" };
      },
    },
    drag: {
      mouseup() {
        return { type: "idle" };
      },
    },
  } as unknown as Definition<any, any, any>;
  const description = analyzeDefinition(definition);
  expect(description.states.idle!.transitions).toHaveLength(1);
  expect(description.states.idle!.transitions[0]!.branches[0]!.targetStateType).toBe(
    "drag",
  );
  expect(description.states.drag!.transitions[0]!.branches[0]!.targetStateType).toBe(
    "idle",
  );
});

test("analyzeDefinition marks ENTER presence and lists event types", () => {
  const definition = {
    idle: {
      [ENTER]: () => undefined,
      mousedown: () => ({ type: "drag" }),
    },
    drag: {
      mouseup: () => ({ type: "idle" }),
    },
  } as unknown as Definition<any, any, any>;
  const description = analyzeDefinition(definition);
  expect(description.states.idle!.hasEnter).toBe(true);
  expect(description.states.drag!.hasEnter).toBe(false);
  expect(description.states.idle!.eventTypes).toEqual(["mousedown"]);
});

test("analyzeDefinition works on a real StateMachine's definition", () => {
  type S = { type: "off" } | { type: "on" };
  type E = { type: "toggle" };
  const definition: Definition<S, E> = {
    off: {
      toggle: () => ({ type: "on" }),
    },
    on: {
      toggle: (_event, state) =>
        (state as { type: string }).type === "on"
          ? { type: "off" }
          : { type: "on" },
    },
  };
  const machine = new StateMachine(definition, { type: "off" });
  const description = analyzeDefinition(machine.definition);
  expect(Object.keys(description.states)).toEqual(["off", "on"]);
  expect(description.states.off!.transitions[0]!.branches[0]!.targetStateType).toBe(
    "on",
  );
  expect(description.states.on!.transitions[0]!.branches).toHaveLength(2);
});
