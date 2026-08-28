import { interval, on, timeout } from "futurise";

import {
  type Definition,
  ENTER,
  type RuntimeEvent,
  StateMachine,
} from "../../lib/main.js";
import type { RuntimeEvent } from "../../lib/types/RuntimeEvent.js";

import { Server } from "./components.js";

const STATE_MACHINE: Definition<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  { a: "bingo" }
> = {
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
};

const fsm = new StateMachine(STATE_MACHINE, { type: "idle" }, { a: "bingo" });

const fsm2 = new StateMachine<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" }
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

const fsm3 = new StateMachine<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" }
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
  event.target.context?.a;
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

const connectionMachine = new StateMachine<
  { type: "disconnected" } | { type: "connected" },
  { type: "connect" } | { type: "disconnect" }
>(
  {
    connected: {
      disconnect: () => ({ type: "disconnected" }),
    },
    disconnected: {
      connect: () => ({ type: "connected" }),
    },
  },
  {
    type: "disconnected",
  },
);

const heartbeatMachine = new StateMachine<
  { type: "off" } | { type: "on" },
  Extract<RuntimeEvent<typeof connectionMachine>, { type: "statetransition" }>
>(
  {
    off: {
      statetransition: (event, state) =>
        event.state.type === "connected" ? { type: "on" } : state,
    },
    on: {
      [ENTER]: () => interval(1000, () => console.warn("ping")),
      statetransition: (event, state) =>
        event.state.type === "disconnected" ? { type: "off" } : state,
    },
  },
  { type: "off" },
);
connectionMachine.addEventListener("statetransition", heartbeatMachine.send);
connectionMachine.send({ type: "connect" });
connectionMachine.send({ type: "disconnect" });
