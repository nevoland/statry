# Statry

🔀 Type-safe state machine description and runtime library

Statry lets you describe a finite state machine as a plain object (states, events, transitions, and per-state lifecycle hooks) and run it with a small `StateMachine` class. The definition drives full TypeScript inference, so events, states, and context are all checked at compile time.

### Features

- **Type-safe by construction**: states and events are inferred from the definition; unknown event types or transitions to unknown states are caught by the compiler.
- **Plain-object definitions**: a state machine is a nested record: `{ [stateType]: { [eventType]: handler, [ENTER]: hook } }`. No builders, no complex API.
- **Lifecycle hooks with cleanup**: the `ENTER` hook runs when a state is entered and may return a cleanup function that runs when the state is left. This is useful for timers, subscriptions, or listeners.
- **Runtime event stream**: the machine extends `TypedEventEmitter`, dispatching `statetransition`, `selftransition`, and `ignoredevent` so you can observe or react to what the machine is doing.
- **Context.** An optional context object is threaded through every handler for data that outlives a single transition.
- **Tiny surface**: one class (`StateMachine`), one symbol (`ENTER`), and a handful of types.

### Usage

Everything is exported from the main entry-point:

```ts
import { ENTER, StateMachine, type StateMachineDefinition } from "statry";
```

### Examples

#### A minimal drag-and-drop

The simplest definition is just states and their event handlers. Each handler returns the next state (or `void` to stay put):

```ts
const DEFINITION = {
  idle: {
    mousedown: () => ({ type: "drag" }),
  },
  drag: {
    mouseup: () => ({ type: "idle" }),
  },
} as const satisfies StateMachineDefinition<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  never
>;

const machine = new StateMachine(DEFINITION, { type: "idle" });

machine.send({ type: "mousedown" }); // machine.state is now { type: "drag" }
machine.send({ type: "mouseup" }); // back to { type: "idle" }
```

The three type parameters in `StateMachineDefinition<States, Events, Context>` drive inference for every handler in the object. Sending an event that isn't in the union, or returning a state that isn't, is a compile-time error.

> [!TIP]
> The state, event, and context types can also be supplied directly as type parameters on the `StateMachine` constructor, in which case the definition is checked against them without needing a separate `as const satisfies` clause. This is convenient when the definition is inlined at the call site:
>
> ```ts
> const machine = new StateMachine<
>   { type: "idle" } | { type: "drag" },
>   { type: "mousedown" } | { type: "mouseup" },
>   never
> >(
>   {
>     idle: {
>       mousedown: () => ({ type: "drag" }),
>     },
>     drag: {
>       mouseup: () => ({ type: "idle" }),
>     },
>   },
>   { type: "idle" },
> );
> ```
>
> Prefer `as const satisfies StateMachineDefinition<...>` when the definition lives in its own binding and you want its literal shape to drive inference at every call site; prefer the constructor form when the state, event, and context unions are the authoritative source of truth and the definition is a one-shot argument.

#### Auto-release with a timer

To run work when a state is entered, define an `ENTER` handler. It receives the transition event, the new state, and the context. Use `event.target.send` to send events to the current state machine. If the handler returns a function, that function is called when the state is left, allowing timers and subscriptions to be cleaned up:

```ts
const definition = {
  idle: {
    mousedown: () => ({ type: "drag" }),
  },
  drag: {
    [ENTER]: (event, state, context) => {
      const id = setTimeout(() => event.target.send({ type: "mouseup" }), 3000);
      return () => clearTimeout(id);
    },
    mouseup: () => ({ type: "idle" }),
  },
} as const satisfies StateMachineDefinition<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  never
>;

const machine = new StateMachine(definition, { type: "idle" });
machine.send({ type: "mousedown" }); // auto-releases 3 s later
```

If the user releases early with a real `mouseup`, `clearTimeout` cancels the pending self-send.

The XState v5 equivalent (from the [Stately](https://stately.ai/) ecosystem) uses `after` to describe delayed transitions:

```ts
import { createActor, createMachine } from "xstate";

const dragMachine = createMachine({
  id: "drag",
  initial: "idle",
  states: {
    idle: {
      on: { mousedown: "drag" },
    },
    drag: {
      after: { 3000: "idle" },
      on: { mouseup: "idle" },
    },
  },
});

const actor = createActor(dragMachine).start();
actor.send({ type: "mousedown" });
```

XState treats `after` as a first-class concept, while Statry expresses the same behavior with a plain `setTimeout` inside `ENTER`. The XState version reads more declaratively; the Statry version keeps the timer as ordinary JavaScript, which composes with any other API that returns a cleanup function (such as the one provided by [Futurise](https://github.com/nevoland/futurise)).

#### Guards for conditional transitions

A transition handler is just a function, so a guard is expressed by returning the current `state` (or `void`) when a condition fails. Here a locked door only unlocks when the correct code is passed with the event:

```ts
type DoorState = { type: "locked" } | { type: "unlocked" } | { type: "open" };

type DoorEvent =
  | { type: "unlock"; code: string }
  | { type: "lock" }
  | { type: "open" }
  | { type: "close" };

type DoorContext = { code: string };

const door = {
  locked: {
    unlock: (event, state, context) =>
      event.code === context.code ? { type: "unlocked" } : state,
  },
  unlocked: {
    lock: () => ({ type: "locked" }),
    open: () => ({ type: "open" }),
  },
  open: {
    close: () => ({ type: "unlocked" }),
  },
} as const satisfies StateMachineDefinition<DoorState, DoorEvent, DoorContext>;

const machine = new StateMachine(door, { type: "locked" }, { code: "0000" });

machine.send({ type: "unlock", code: "1234" }); // still { type: "locked" }
machine.send({ type: "unlock", code: "0000" }); // now { type: "unlocked" }
```

When the guard fails, no `statetransition` fires. Observers still see a `selftransition`, so failed attempts remain visible if you want to react to them.

#### A stopwatch with context

States and events carry a `type` discriminator, but they can also carry data. Any value that changes as the machine runs belongs on the state itself: each transition returns a fresh state object, and no handler ever mutates what it has been given. The third type parameter is a shared context object, reserved for immutable configuration and dependencies that don't change over the machine's lifetime. This stopwatch keeps the accumulated `elapsed` milliseconds on every state, tracks the current run's `startedAt` on `running`, and reads its tick interval from the context:

```ts
import { interval } from "futurise";

type StopwatchState =
  | { type: "idle"; elapsed: number }
  | {
      type: "running";
      elapsed: number;
      baseElapsed: number;
      startedAt: number;
    };

type StopwatchEvent =
  { type: "start" } | { type: "pause" } | { type: "reset" } | { type: "tick" };

type StopwatchContext = { tickInterval: number };

const machine = new StateMachine<
  StopwatchState,
  StopwatchEvent,
  StopwatchContext
>(
  {
    idle: {
      start: (event, state) => ({
        type: "running",
        elapsed: state.elapsed,
        baseElapsed: state.elapsed,
        startedAt: Date.now(),
      }),
      reset: () => ({ type: "idle", elapsed: 0 }),
    },
    running: {
      [ENTER]: (event, state, context) =>
        interval(context.tickInterval, () =>
          event.target.send({ type: "tick" }),
        ),
      tick: (event, state) => ({
        ...state,
        elapsed: state.baseElapsed + (Date.now() - state.startedAt),
      }),
      pause: (event, state) => ({ type: "idle", elapsed: state.elapsed }),
      reset: () => ({ type: "idle", elapsed: 0 }),
    },
  },
  { type: "idle", elapsed: 0 },
  { tickInterval: 100 },
);

machine.addEventListener("statetransition", (event) => {
  console.log(event.previousState.type, "→", event.state.type);
});

machine.addEventListener("selftransition", (event) => {
  if (event.state.type === "running") {
    console.log("tick", event.state.elapsed);
  }
});

machine.send({ type: "start" });
```

The `baseElapsed` and `startedAt` state properties are frozen at the moment `start` fires and stay constant through the whole run, so each `tick` handler just derives `elapsed = baseElapsed + (Date.now() - startedAt)` from them and returns a new `running` state. The `ENTER` handler only registers the interval and returns its cleanup. It never writes back to state or context. On every interval firing, `event.target.send({ type: "tick" })` re-enters the machine, producing a `selftransition` that observers can react to through the runtime event stream. Context stays constant throughout: the interval hook reads `tickInterval` but nothing writes to it.

The XState v5 equivalent packs the same runtime data into `context`, updates it through `assign` actions, and invokes a callback for the ticking interval:

```ts
import { assign, createActor, createMachine, fromCallback } from "xstate";

type StopwatchContext = {
  elapsed: number;
  baseElapsed: number;
  startedAt: number;
  tickInterval: number;
};

type StopwatchEvent =
  { type: "start" } | { type: "pause" } | { type: "reset" } | { type: "tick" };

const stopwatchMachine = createMachine({
  id: "stopwatch",
  initial: "idle",
  context: { elapsed: 0, baseElapsed: 0, startedAt: 0, tickInterval: 100 },
  types: {
    context: {} as StopwatchContext,
    events: {} as StopwatchEvent,
  },
  states: {
    idle: {
      on: {
        start: {
          target: "running",
          actions: assign({
            baseElapsed: ({ context }) => context.elapsed,
            startedAt: () => Date.now(),
          }),
        },
        reset: {
          actions: assign({ elapsed: 0 }),
        },
      },
    },
    running: {
      invoke: {
        src: fromCallback(({ sendBack, input }) => {
          const id = setInterval(
            () => sendBack({ type: "tick" }),
            input.tickInterval,
          );
          return () => clearInterval(id);
        }),
        input: ({ context }) => ({ tickInterval: context.tickInterval }),
      },
      on: {
        tick: {
          actions: assign({
            elapsed: ({ context }) =>
              context.baseElapsed + (Date.now() - context.startedAt),
          }),
        },
        pause: "idle",
        reset: {
          target: "idle",
          actions: assign({ elapsed: 0 }),
        },
      },
    },
  },
});

const actor = createActor(stopwatchMachine).start();
actor.send({ type: "start" });
```

XState packs every mutable value (including `tickInterval`) into a single `context` and updates it through `assign` actions attached to transitions. Statry takes the opposite stance: runtime values live on the state itself, `context` holds only immutable configuration, and every transition returns a fresh state object. The `ENTER` handler only registers the interval and returns its cleanup; no handler ever writes back to state or context.

#### Composing multiple state machines

Because `StateMachine` extends `TypedEventEmitter`, one machine's `statetransition`, `selftransition`, and `ignoredevent` events can drive another machine's transitions. There is no special coordinator: a plain listener that calls `send` on the peer is enough.

Here a heartbeat machine starts pinging when a connection machine reaches `connected`, and stops when it goes back to `disconnected`:

```ts
type ConnState = { type: "disconnected" } | { type: "connected" };
type ConnEvent = { type: "connect" } | { type: "disconnect" };

const connection = {
  disconnected: {
    connect: () => ({ type: "connected" }),
  },
  connected: {
    disconnect: () => ({ type: "disconnected" }),
  },
} as const satisfies StateMachineDefinition<ConnState, ConnEvent, never>;

type BeatState = { type: "off" } | { type: "on" };
type BeatEvent = { type: "start" } | { type: "stop" };

const heartbeat = {
  off: {
    start: () => ({ type: "on" }),
  },
  on: {
    [ENTER]: () => {
      const id = setInterval(() => console.log("ping"), 1000);
      return () => clearInterval(id);
    },
    stop: () => ({ type: "off" }),
  },
} as const satisfies StateMachineDefinition<BeatState, BeatEvent, never>;

const connectionMachine = new StateMachine(connection, {
  type: "disconnected",
});
const heartbeatMachine = new StateMachine(heartbeat, { type: "off" });

connectionMachine.addEventListener("statetransition", (event) => {
  if (event.state.type === "connected") {
    heartbeatMachine.send({ type: "start" });
  } else {
    heartbeatMachine.send({ type: "stop" });
  }
});

connectionMachine.send({ type: "connect" }); // heartbeat starts pinging
connectionMachine.send({ type: "disconnect" }); // heartbeat stops
```

The same pattern scales to any number of peers, and the event stream itself is fully typed, so both `event.state` and `event.trigger` narrow to the peer's declared unions.

> [!TIP]
> **When to reach for XState instead**
>
> XState is a much larger library with a rich feature set: hierarchical and parallel states, guards, invoked actors, delayed transitions, history states, and a visual editor. Statry can express the same behaviors, just without dedicated syntax for each one:
>
> - **Guards** are conditions inside a transition handler that return the current `state` when they fail (see the door example).
> - **Delayed transitions** are `setTimeout` calls inside `ENTER` whose cleanup is `clearTimeout` (see the auto-release example).
> - **Invoked side effects** are anything an `ENTER` handler starts and its cleanup tears down: intervals, subscriptions, `AbortController`, `addEventListener`.
> - **Parallel states** come from composing peer machines through the event emitter (see the connection and heartbeat example); each region is its own `StateMachine` and they coordinate through `send`.
> - **Hierarchical states** can be modelled by nesting a child `StateMachine` inside the context of a parent, or by encoding a substate as a payload on the outer state's `type`.
>
> Everything Statry offers is built from plain functions, closures, and event listeners, and typed against a single `StateMachineDefinition<States, Events, Context>`, without decorators, schema helpers, or a `setup({ types })` call. Reach for XState when you want the declarative vocabulary and its ecosystem (visual editor, actor model, model checking); reach for Statry when a plain-object definition, strong types, and composability through plain event listeners are enough.

### Installation

Install with the [Node Package Manager](https://www.npmjs.com/package/statry):

```bash
npm install statry
```

### Documentation

Documentation is generated [here](doc/README.md).

### Use the application to test the library

- `npm run dev`
- `npm run dev:test` (or use dedicated Vitest plugin of your IDE)

Import exported library items from the `"#lib"` alias:

```ts
import { StateMachine } from "#lib";
```

### Build and publish the library

- `npm run build:lib`
- Set the `private` property to `false` in [package.json](./package.json)
- `npm run release:init`

#### Release subsequent versions using either

- `npm run release:alpha`
- `npm run release:beta`
- `npm run release:patch`
- `npm run release:minor`
- `npm run release:major`

## Application mode

### Develop on the application

- `npm run dev`
- `npm run dev:test` (or use dedicated Vitest plugin of your IDE)

### Build and run

- `npm run build:app`
- OPTIONAL: `export ENV_PATH=path/to/extra/dot_env/file`
- `npm start`

### Options

List all environment variables used by the application:

- `ENV_PATH`: Path to an optional environment file.
- `LOG_LEVEL`: One of the [supported levels](https://github.com/pinojs/pino/blob/main/docs/api.md#loggerlevels-object) or `"silent"` to disable logging.
