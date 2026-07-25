import type { StateMachine } from "#lib";
import { StateMachineRuntime } from "../..//lib/classes/StateMachineRuntime.js";
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
    mouseup(event, _state, context) {
      return {
        type: "idle",
      };
    },
  },
} satisfies StateMachine<
  { type: "idle" } | { type: "drag" },
  { type: "mousedown" } | { type: "mouseup" },
  any
>;

const fsm = new StateMachineRuntime(STATE_MACHINE, { type: "idle" });

/*

Argument of type '{ idle: { mousedown(event: { type: "mousedown"; }, state: { type: "idle"; }): { type: "drag"; }; }; drag: { mouseup(event: { type: "mouseup"; }, _state: { type: "drag"; }, context: any): { type: "idle"; }; }; }' is not assignable to parameter of type '{ [x: string]: { [ENTER]?: ((event: RuntimeEvent<{ type: string; }, { type: "mousedown"; }, any>, state: { type: string; }, context: any, dispatchEvent: (event: { type: "mousedown"; }) => void) => void | CleanupCallback<{ type: string; }, string, any>) | undefined; } & { mousedown?: ((event: { type: "mousedown"; }, state: { type: string; }, context: any) => { type: string; }) | undefined; }; }'.
  Property 'idle' is incompatible with index signature.
    Type '{ mousedown(event: { type: "mousedown"; }, state: { type: "idle"; }): { type: "drag"; }; }' is not assignable to type '{ [ENTER]?: ((event: RuntimeEvent<{ type: string; }, { type: "mousedown"; }, any>, state: { type: string; }, context: any, dispatchEvent: (event: { type: "mousedown"; }) => void) => void | CleanupCallback<{ type: string; }, string, any>) | undefined; } & { mousedown?: ((event: { type: "mousedown"; }, state: { type: string; }, context: any) => { type: string; }) | undefined; }'.
      Type '{ mousedown(event: { type: "mousedown"; }, state: { type: "idle"; }): { type: "drag"; }; }' is not assignable to type '{ mousedown?: ((event: { type: "mousedown"; }, state: { type: string; }, context: any) => { type: string; }) | undefined; }'.
        Types of property 'mousedown' are incompatible.
          Type '(event: { type: "mousedown"; }, state: { type: "idle"; }) => { type: "drag"; }' is not assignable to type '(event: { type: "mousedown"; }, state: { type: string; }, context: any) => { type: string; }'.
            Types of parameters 'state' and 'state' are incompatible.
              Type '{ type: string; }' is not assignable to type '{ type: "idle"; }'.
                Types of property 'type' are incompatible.
                  Type 'string' is not assignable to type '"idle"'.

*/

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
