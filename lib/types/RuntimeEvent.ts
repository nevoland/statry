import type { StateMachineRuntime } from "../classes/StateMachineRuntime";

import type { StateMachine } from "./StateMachine";
import type { StateMachineEvent } from "./StateMachineEvent";
import type { StateMachineState } from "./StateMachineState";

export type RuntimeEvent<M extends StateMachine<any, any, any>> =
  | {
      type: "statetransition";
      state: StateMachineState<M>;
      target: StateMachineRuntime<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
      previousState: StateMachineState<M>;
    }
  | {
      type: "selftransition";
      state: StateMachineState<M>;
      target: StateMachineRuntime<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
      previousState: StateMachineState<M>;
    }
  | {
      type: "ignoredevent";
      state: StateMachineState<M>;
      target: StateMachineRuntime<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
    };
