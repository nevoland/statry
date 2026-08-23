import type { StateMachine } from "../classes/StateMachine";

import type { StateMachineEvent } from "./StateMachineEvent";
import type { StateMachineState } from "./StateMachineState";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

export type RuntimeEvent<M extends StateMachineLike> =
  | {
      type: "statetransition";
      state: StateMachineState<M>;
      target: StateMachine<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
      previousState: StateMachineState<M>;
    }
  | {
      type: "selftransition";
      state: StateMachineState<M>;
      target: StateMachine<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
      previousState: StateMachineState<M>;
    }
  | {
      type: "ignoredevent";
      state: StateMachineState<M>;
      target: StateMachine<M>;
      trigger: StateMachineEvent<M>;
      timeStamp: number;
    };
