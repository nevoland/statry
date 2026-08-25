import { on, timeout } from "futurise";

import {
  ENTER,
  StateMachine,
  type StateMachineDefinition,
} from "../../lib/main.js";

import { Server } from "./components.js";

const STATE_MACHINE = {
  drag: {
    [ENTER]: (event) =>
      timeout(3000, () => event.target.send({ type: "mouseup" })),
    mouseup() {
      return {
        type: "idle",
      };
    },
  },
  idle: {
    mousedown(event, state) {
      return {
        type: "drag",
      };
    },
  },
} as const satisfies StateMachineDefinition<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  never
>;

const fsm = new StateMachine(STATE_MACHINE, { type: "idle" });

const fsm2 = new StateMachine(
  {
    drag: {
      [ENTER]: (event) =>
        timeout(3000, () => event.target.send({ type: "mouseup" })),
      mouseup() {
        return {
          type: "idle",
        };
      },
    },
    idle: {
      mousedown(event, state) {
        return {
          type: "drag",
        };
      },
    },
  } satisfies StateMachineDefinition<
    { type: "idle" } | { type: "drag" },
    { type: "mousedown" } | { type: "mouseup" },
    never
  >,
  { type: "idle" },
);

const fsm3 = new StateMachine<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  never
>(
  {
    drag: {
      [ENTER]: (event) =>
        timeout(3000, () => event.target.send({ type: "mouseup" })),
      mouseup() {
        return {
          type: "idle",
        };
      },
    },
    idle: {
      mousedown(event, state) {
        return {
          type: "drag",
        };
      },
    },
  },
  { type: "idle" },
);

on(fsm, "statetransition", (event) => {
  event.target.send({ type: "mousedown" });
});

export function App() {
  // useMemo(() => {
  //   on(fsm, "statetransition", (event) => {
  //     console.log(event);
  //   });
  // }, []);

  return (
    <>
      <h1 class="text-center text-9xl font-extralight text-blue-500">Statry</h1>
      <h3 class="text-center text-2xl font-normal">
        <Server />
      </h3>
    </>
  );
}
