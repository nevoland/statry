import type { StateMachine } from "./StateMachine";

type EventOfTransition<
  M extends StateMachine<any, any, any>,
  S extends keyof M & string,
  E extends keyof M[S] & string,
> =
  NonNullable<M[S][E]> extends (event: infer Event, state: any) => any
    ? Event extends { type: E }
      ? Event
      : never
    : never;

export type StateMachineEvent<M extends StateMachine<any, any, any>> = {
  [S in keyof M & string]: {
    [E in keyof M[S] & string]: [EventOfTransition<M, S, E>] extends [never]
      ? { type: E }
      : EventOfTransition<M, S, E>;
  }[keyof M[S] & string];
}[keyof M & string];
