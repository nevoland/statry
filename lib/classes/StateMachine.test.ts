import { expect, test, vi } from "vitest";

import { ENTER } from "../constants/ENTER.js";
import type { Definition } from "../types";

import { StateMachine } from "./StateMachine.js";

type LightState =
  { type: "red" } | { type: "yellow" } | { type: "green"; blink?: boolean };

type LightEvent =
  { type: "next" } | { type: "reset" } | { type: "set"; value: number };

type LightContext = { count: number };

function createDefinition(): Definition<LightState, LightEvent, LightContext> {
  return {
    green: {
      next: () => ({ type: "yellow" }),
    },
    red: {
      next: () => ({ type: "green" }),
      set: (event, _state, context) => {
        context.count = event.value;
        return { type: "red" };
      },
    },
    yellow: {
      next: () => ({ type: "red" }),
      reset: () => ({ type: "red" }),
    },
  };
}

test("constructor stores definition, initial state, and context", () => {
  const definition = createDefinition();
  const context = { count: 0 };
  const machine = new StateMachine(definition, { type: "red" }, context);

  expect(machine.state).toEqual({ type: "red" });
  expect(machine.definition).toBe(definition);
  expect(machine.context).toBe(context);
});

test("constructor allows omitting the context", () => {
  const machine = new StateMachine(createDefinition(), { type: "red" });
  expect(machine.context).toBeUndefined();
});

test("send transitions to a new state when the handler returns one", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );

  machine.send({ type: "next" });
  expect(machine.state).toEqual({ type: "green" });

  machine.send({ type: "next" });
  expect(machine.state).toEqual({ type: "yellow" });

  machine.send({ type: "next" });
  expect(machine.state).toEqual({ type: "red" });
});

test("send passes the event, state, and context to the handler", () => {
  const handler = vi.fn(() => ({ type: "green" as const }));
  const definition = {
    green: {},
    red: { next: handler },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    { hello: string }
  >;
  const context = { hello: "world" };
  const state = { type: "red" } as const;
  const machine = new StateMachine(definition, state, context);
  const event = { type: "next" } as const;

  machine.send(event);

  expect(handler).toHaveBeenCalledTimes(1);
  expect(handler).toHaveBeenCalledWith(event, state, context);
});

test("send does nothing when no handler matches", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );

  machine.send({ type: "reset" });
  expect(machine.state).toEqual({ type: "red" });
});

test("send does not dispatch `ignoredevent` when no listener is attached", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);
  machine.addEventListener("selftransition", listener);

  machine.send({ type: "reset" });

  expect(listener).not.toHaveBeenCalled();
});

test("send dispatches `ignoredevent` when a listener is attached and no handler matches", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  const listener = vi.fn();
  machine.addEventListener("ignoredevent", listener);

  const before = Date.now();
  machine.send({ type: "reset" });
  const after = Date.now();

  expect(listener).toHaveBeenCalledTimes(1);
  const event = listener.mock.calls[0]?.[0];
  expect(event).toMatchObject({
    state: { type: "red" },
    target: machine,
    trigger: { type: "reset" },
    type: "ignoredevent",
  });
  expect(event.timeStamp).toBeGreaterThanOrEqual(before);
  expect(event.timeStamp).toBeLessThanOrEqual(after);
});

test("send treats a `void` return value as staying in the current state and does not update the state reference", () => {
  const definition = {
    idle: {
      poke: () => undefined as unknown as { type: "idle" },
    },
  } satisfies Definition<{ type: "idle" }, { type: "poke" }, unknown>;
  const initialState = { type: "idle" } as const;
  const machine = new StateMachine(definition, initialState);
  const transitionListener = vi.fn();
  machine.addEventListener("statetransition", transitionListener);

  machine.send({ type: "poke" });

  expect(machine.state).toBe(initialState);
  expect(transitionListener).not.toHaveBeenCalled();
});

test("send dispatches `selftransition` with the same previous and next state when the handler returns void", () => {
  const definition = {
    idle: {
      poke: () => undefined as unknown as { type: "idle" },
    },
  } satisfies Definition<{ type: "idle" }, { type: "poke" }, unknown>;
  const initialState = { type: "idle" } as const;
  const machine = new StateMachine(definition, initialState);
  const listener = vi.fn();
  machine.addEventListener("selftransition", listener);

  machine.send({ type: "poke" });

  expect(listener).toHaveBeenCalledTimes(1);
  const event = listener.mock.calls[0]?.[0];
  expect(event.previousState).toBe(initialState);
  expect(event.state).toBe(initialState);
});

test("send updates the state reference on a self-transition to a new state object of the same type", () => {
  const definition: Definition<
    { type: "green"; blink: boolean },
    { type: "toggle" }
  > = {
    green: {
      toggle: (_event, state) => ({ ...state, blink: !state.blink }),
    },
  };
  const initialState = { blink: false, type: "green" } as const;
  const machine = new StateMachine(definition, initialState);

  machine.send({ type: "toggle" });

  expect(machine.state).not.toBe(initialState);
  expect(machine.state).toEqual({ blink: true, type: "green" });
});

test("send dispatches `selftransition` when a listener is attached and the state type does not change", () => {
  const definition: Definition<
    { type: "green"; blink: boolean },
    { type: "toggle" },
    unknown
  > = {
    green: {
      toggle: (_event, state) => ({ ...state, blink: !state.blink }),
    },
  };
  const previousState = { blink: false, type: "green" } as const;
  const machine = new StateMachine(definition, previousState);
  const listener = vi.fn();
  machine.addEventListener("selftransition", listener);

  const before = Date.now();
  machine.send({ type: "toggle" });
  const after = Date.now();

  expect(listener).toHaveBeenCalledTimes(1);
  const event = listener.mock.calls[0]?.[0];
  expect(event).toMatchObject({
    previousState,
    state: { blink: true, type: "green" },
    target: machine,
    trigger: { type: "toggle" },
    type: "selftransition",
  });
  expect(event.timeStamp).toBeGreaterThanOrEqual(before);
  expect(event.timeStamp).toBeLessThanOrEqual(after);
});

test("send does not dispatch `selftransition` when no listener is attached", () => {
  const definition: Definition<
    { type: "green"; blink: boolean },
    { type: "toggle" }
  > = {
    green: {
      toggle: (_event, state) => ({ ...state, blink: !state.blink }),
    },
  };
  const machine = new StateMachine(definition, { blink: false, type: "green" });
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);
  machine.addEventListener("ignoredevent", listener);

  machine.send({ type: "toggle" });

  expect(listener).not.toHaveBeenCalled();
});

test("send dispatches `statetransition` when the state type changes and a listener is attached", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);

  const before = Date.now();
  machine.send({ type: "next" });
  const after = Date.now();

  expect(listener).toHaveBeenCalledTimes(1);
  const event = listener.mock.calls[0]?.[0];
  expect(event).toMatchObject({
    previousState: { type: "red" },
    state: { type: "green" },
    target: machine,
    trigger: { type: "next" },
    type: "statetransition",
  });
  expect(event.timeStamp).toBeGreaterThanOrEqual(before);
  expect(event.timeStamp).toBeLessThanOrEqual(after);
});

test("send invokes the ENTER handler of the target state on a state transition", () => {
  const enterGreen = vi.fn();
  const definition = {
    green: { [ENTER]: enterGreen },
    red: { next: () => ({ type: "green" as const }) },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    { count: number }
  >;
  const context = { count: 0 };
  const machine = new StateMachine(definition, { type: "red" }, context);

  machine.send({ type: "next" });

  expect(enterGreen).toHaveBeenCalledTimes(1);
  const [event, state, receivedContext] = enterGreen.mock.calls[0] ?? [];
  expect(event).toMatchObject({
    previousState: { type: "red" },
    state: { type: "green" },
    trigger: { type: "next" },
    type: "statetransition",
  });
  expect(state).toEqual({ type: "green" });
  expect(receivedContext).toBe(context);
});

test("send stores the cleanup callback returned by ENTER and invokes it on the next state transition", () => {
  const cleanup = vi.fn();
  const enterGreen = vi.fn(() => cleanup);
  const definition = {
    green: {
      [ENTER]: enterGreen,
      next: () => ({ type: "red" as const }),
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    { count: number }
  >;
  const context = { count: 0 };
  const machine = new StateMachine(definition, { type: "red" }, context);

  machine.send({ type: "next" });
  expect(cleanup).not.toHaveBeenCalled();

  machine.send({ type: "next" });

  expect(cleanup).toHaveBeenCalledTimes(1);
  const [event, state, receivedContext] = cleanup.mock.calls[0] ?? [];
  expect(event).toMatchObject({
    previousState: { type: "green" },
    state: { type: "red" },
    trigger: { type: "next" },
    type: "statetransition",
  });
  expect(state).toEqual({ type: "red" });
  expect(receivedContext).toBe(context);
});

test("send does not invoke cleanup on a self-transition", () => {
  const cleanup = vi.fn();
  const definition: Definition<
    { type: "red" } | { type: "green"; blink: boolean },
    { type: "next" } | { type: "toggle" },
    unknown
  > = {
    green: {
      [ENTER]: () => cleanup,
      toggle: (_event, state) => ({ ...state, blink: !state.blink }),
    },
    red: {
      next: () => ({ blink: false, type: "green" as const }),
    },
  };
  const machine = new StateMachine(definition, { type: "red" });
  machine.send({ type: "next" });
  expect(cleanup).not.toHaveBeenCalled();

  machine.send({ type: "toggle" });
  machine.send({ type: "toggle" });

  expect(cleanup).not.toHaveBeenCalled();
});

test("send chains cleanup callbacks across multiple state transitions", () => {
  const cleanupGreen = vi.fn();
  const cleanupYellow = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanupGreen,
      next: () => ({ type: "yellow" as const }),
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
    yellow: {
      [ENTER]: () => cleanupYellow,
      next: () => ({ type: "red" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" } | { type: "yellow" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });

  machine.send({ type: "next" });
  expect(cleanupGreen).not.toHaveBeenCalled();

  machine.send({ type: "next" });
  expect(cleanupGreen).toHaveBeenCalledTimes(1);
  expect(cleanupYellow).not.toHaveBeenCalled();

  machine.send({ type: "next" });
  expect(cleanupGreen).toHaveBeenCalledTimes(1);
  expect(cleanupYellow).toHaveBeenCalledTimes(1);
});

test("send clears the stored cleanup when ENTER does not return one", () => {
  const cleanupGreen = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanupGreen,
      next: () => ({ type: "yellow" as const }),
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
    yellow: {
      [ENTER]: () => {
        // No cleanup returned.
      },
      next: () => ({ type: "red" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" } | { type: "yellow" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });

  machine.send({ type: "next" });
  machine.send({ type: "next" });
  expect(cleanupGreen).toHaveBeenCalledTimes(1);

  machine.send({ type: "next" });
  expect(cleanupGreen).toHaveBeenCalledTimes(1);
});

test("send does not dispatch `statetransition` when there is no listener, no ENTER, and no cleanup", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );

  machine.send({ type: "next" });

  expect(machine.state).toEqual({ type: "green" });
});

test("send passes the mutated context to subsequent handlers", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );

  machine.send({ type: "set", value: 42 });

  expect(machine.context).toEqual({ count: 42 });
});

test("state getter reflects the current state", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  expect(machine.state).toEqual({ type: "red" });

  machine.send({ type: "next" });
  expect(machine.state).toEqual({ type: "green" });
});

test("definition getter returns the definition passed to the constructor", () => {
  const definition = createDefinition();
  const machine = new StateMachine(definition, { type: "red" });
  expect(machine.definition).toBe(definition);
});

test("clone returns a new instance sharing the definition, state, and context", () => {
  const definition = createDefinition();
  const context: LightContext = { count: 5 };
  const machine = new StateMachine(definition, { type: "green" }, context);

  const clone = machine.clone();

  expect(clone).not.toBe(machine);
  expect(clone).toBeInstanceOf(StateMachine);
  expect(clone.definition).toBe(definition);
  expect(clone.state).toEqual({ type: "green" });
  expect(clone.context).toBe(context);
});

test("clone is independent from the original machine", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  const clone = machine.clone();

  machine.send({ type: "next" });

  expect(machine.state).toEqual({ type: "green" });
  expect(clone.state).toEqual({ type: "red" });
});

test("send is a no-op when the current state has no transition table entry", () => {
  const definition: Definition<
    { type: "active" } | { type: "orphan" },
    { type: "next" }
  > = {
    active: {
      next: () => ({ type: "active" as const }),
    },
    orphan: {},
  };
  const machine = new StateMachine(definition, { type: "orphan" });
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);
  machine.addEventListener("selftransition", listener);

  machine.send({ type: "next" });

  expect(machine.state).toEqual({ type: "orphan" });
  expect(listener).not.toHaveBeenCalled();
});

test("send dispatches the previous cleanup with the new state and target on transition", () => {
  const cleanup = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanup,
      next: () => ({ type: "red" as const }),
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    { count: number }
  >;
  const machine = new StateMachine(definition, { type: "red" }, { count: 0 });

  machine.send({ type: "next" });
  machine.send({ type: "next" });

  expect(cleanup).toHaveBeenCalledTimes(1);
  const event = cleanup.mock.calls[0]?.[0];
  expect(event.target).toBe(machine);
  expect(event.previousState).toEqual({ type: "green" });
  expect(event.state).toEqual({ type: "red" });
});

test("hasListeners governs `statetransition` dispatch even when ENTER and cleanup are absent", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    {
      count: 0,
    },
  );
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);

  machine.send({ type: "next" });
  machine.removeEventListener("statetransition", listener);
  machine.send({ type: "next" });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(machine.state).toEqual({ type: "yellow" });
});

test("dispose does nothing observable when there is no listener and no stored cleanup, but still marks the machine disposed", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    { count: 0 },
  );
  const listener = vi.fn();
  machine.addEventListener("statetransition", listener);
  machine.addEventListener("selftransition", listener);
  machine.addEventListener("ignoredevent", listener);

  expect(machine.disposed).toBe(false);

  machine.dispose();

  expect(listener).not.toHaveBeenCalled();
  expect(machine.disposed).toBe(true);
});

test("dispose dispatches `dispose` when a listener is attached", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    { count: 0 },
  );
  const listener = vi.fn();
  machine.addEventListener("dispose", listener);

  const before = Date.now();
  machine.dispose();
  const after = Date.now();

  expect(listener).toHaveBeenCalledTimes(1);
  const event = listener.mock.calls[0]?.[0];
  expect(event).toMatchObject({
    previousState: { type: "red" },
    target: machine,
    type: "dispose",
  });
  expect(event.timeStamp).toBeGreaterThanOrEqual(before);
  expect(event.timeStamp).toBeLessThanOrEqual(after);
});

test("dispose invokes the stored cleanup callback with the dispose event, current state, and context", () => {
  const cleanup = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanup,
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    { count: number }
  >;
  const context = { count: 0 };
  const machine = new StateMachine(definition, { type: "red" }, context);

  machine.send({ type: "next" });
  expect(cleanup).not.toHaveBeenCalled();

  machine.dispose();

  expect(cleanup).toHaveBeenCalledTimes(1);
  const [event, state, receivedContext] = cleanup.mock.calls[0] ?? [];
  expect(event).toMatchObject({
    previousState: { type: "green" },
    target: machine,
    type: "dispose",
  });
  expect(state).toEqual({ type: "green" });
  expect(receivedContext).toBe(context);
});

test("dispose invokes the cleanup even when no listener is attached", () => {
  const cleanup = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanup,
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });

  machine.send({ type: "next" });
  machine.dispose();

  expect(cleanup).toHaveBeenCalledTimes(1);
});

test("dispose dispatches the event before invoking the cleanup callback", () => {
  const order: string[] = [];
  const cleanup = vi.fn(() => {
    order.push("cleanup");
  });
  const definition = {
    green: {
      [ENTER]: () => cleanup,
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });
  const listener = vi.fn(() => {
    order.push("listener");
  });
  machine.addEventListener("dispose", listener);

  machine.send({ type: "next" });
  machine.dispose();

  expect(order).toEqual(["listener", "cleanup"]);
});

test("dispose does not invoke a cleanup that was cleared by a subsequent ENTER returning nothing", () => {
  const cleanupGreen = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanupGreen,
      next: () => ({ type: "yellow" as const }),
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
    yellow: {
      [ENTER]: () => {
        // No cleanup returned.
      },
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" } | { type: "yellow" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });

  machine.send({ type: "next" });
  machine.send({ type: "next" });
  expect(cleanupGreen).toHaveBeenCalledTimes(1);

  machine.dispose();

  expect(cleanupGreen).toHaveBeenCalledTimes(1);
});

test("dispose does not invoke the initial state's ENTER cleanup since ENTER never ran", () => {
  const cleanup = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanup,
    },
  } satisfies Definition<{ type: "green" }, { type: "next" }, unknown>;
  const machine = new StateMachine(definition, { type: "green" });

  machine.dispose();

  expect(cleanup).not.toHaveBeenCalled();
});

test("disposed getter is false on a fresh machine and true after dispose (dispatch path)", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    { count: 0 },
  );
  machine.addEventListener("dispose", vi.fn());

  expect(machine.disposed).toBe(false);

  machine.dispose();

  expect(machine.disposed).toBe(true);
});

test("dispose is idempotent: a second call does not re-dispatch or re-run cleanup", () => {
  const cleanup = vi.fn();
  const definition = {
    green: {
      [ENTER]: () => cleanup,
    },
    red: {
      next: () => ({ type: "green" as const }),
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });
  const listener = vi.fn();
  machine.addEventListener("dispose", listener);

  machine.send({ type: "next" });
  machine.dispose();
  machine.dispose();
  machine.dispose();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(machine.disposed).toBe(true);
});

test("dispose is idempotent even on the fast path with no listener and no cleanup", () => {
  const machine = new StateMachine(
    createDefinition(),
    { type: "red" },
    { count: 0 },
  );
  const listener = vi.fn();
  machine.addEventListener("dispose", listener);
  machine.removeEventListener("dispose", listener);

  machine.dispose();
  machine.dispose();

  expect(machine.disposed).toBe(true);
  expect(listener).not.toHaveBeenCalled();
});

test("send is a silent no-op after dispose and does not update the state, dispatch events, or run handlers", () => {
  const handler = vi.fn(() => ({ type: "green" as const }));
  const definition = {
    green: {
      next: () => ({ type: "red" as const }),
    },
    red: {
      next: handler,
    },
  } satisfies Definition<
    { type: "red" } | { type: "green" },
    { type: "next" } | { type: "unknown" },
    unknown
  >;
  const machine = new StateMachine(definition, { type: "red" });
  const stateListener = vi.fn();
  const selfListener = vi.fn();
  const ignoredListener = vi.fn();
  machine.addEventListener("statetransition", stateListener);
  machine.addEventListener("selftransition", selfListener);
  machine.addEventListener("ignoredevent", ignoredListener);

  machine.dispose();

  machine.send({ type: "next" });
  machine.send({ type: "unknown" } as { type: "next" });

  expect(handler).not.toHaveBeenCalled();
  expect(stateListener).not.toHaveBeenCalled();
  expect(selfListener).not.toHaveBeenCalled();
  expect(ignoredListener).not.toHaveBeenCalled();
  expect(machine.state).toEqual({ type: "red" });
});
