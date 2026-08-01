import { timeout } from "futurise";
import {
  ENTER,
  type StateMachine,
  StateMachineRuntime,
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
} as const satisfies StateMachine<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  never
>;

const fsm = new StateMachineRuntime(STATE_MACHINE, { type: "idle" });

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
