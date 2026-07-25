import type { ENTER } from "../constants/ENTER";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

type ContextFromHandler<Handler> = Handler extends (
  event: any,
  state: any,
  context: infer Context,
  ...args: any
) => any
  ? Context
  : never;

type ContextFromNode<Node> =
  | {
      [
        EventType in Exclude<keyof Node, typeof ENTER> & string
      ]: ContextFromHandler<NonNullable<Node[EventType]>>;
    }[Exclude<keyof Node, typeof ENTER> & string]
  | (typeof ENTER extends keyof Node
      ? ContextFromHandler<NonNullable<Node[typeof ENTER]>>
      : never);

export type StateMachineContext<M extends StateMachineLike> = {
  [StateType in keyof M & string]: ContextFromNode<M[StateType]>;
}[keyof M & string];
