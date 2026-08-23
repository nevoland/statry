import { on, timeout } from "futurise";
import {
  ENTER,
  type StateMachineDefinition,
  StateMachine,
} from "../../lib/main.js";
import { Server } from "./components.js";

const STATE_MACHINE = {
  idle: {
    mousedown(event, state) {
      return {
        type: "drag",
      };
    },
  },
  drag: {
    [ENTER]: (event) =>
      timeout(3000, () => event.target.send({ type: "mouseup" })),
    mouseup() {
      return {
        type: "idle",
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
    idle: {
      mousedown(event, state) {
        return {
          type: "drag",
        };
      },
    },
    drag: {
      [ENTER]: (event) =>
        timeout(3000, () => event.target.send({ type: "mouseup" })),
      mouseup() {
        return {
          type: "idle",
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
    idle: {
      mousedown(event, state) {
        return {
          type: "drag",
        };
      },
    },
    drag: {
      [ENTER]: (event) =>
        timeout(3000, () => event.target.send({ type: "mouseup" })),
      mouseup() {
        return {
          type: "idle",
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
      <h1 class="text-center text-9xl font-extralight text-blue-500">Statra</h1>
      <h3 class="text-center text-2xl font-normal">
        <Server />
      </h3>
    </>
  );
}
