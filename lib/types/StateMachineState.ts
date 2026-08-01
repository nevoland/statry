import type { StateMachine } from "./StateMachine";

export type StateMachineState<M extends StateMachine<any, any, any>> =
  M extends StateMachine<infer S extends { type: string }, any, any>
    ? S
    : never;
