import type { State } from "./State";
import type { Event } from "./Event";

export type RuntimeTarget<S extends State, E extends Event, Context> = {
  readonly state: S;
  context: Context | undefined;
  dispatchEvent: (event: E) => void;
};

export type RuntimeEvent<S extends State, E extends Event, Context> =
  | {
      type: "statetransition" | "selftransition";
      state: S;
      target: RuntimeTarget<S, E, Context>;
      trigger: E;
      timeStamp: number;
      previousState: S;
    }
  | {
      type: "ignoredevent";
      state: S;
      target: RuntimeTarget<S, E, Context>;
      trigger: E;
      timeStamp: number;
    };
