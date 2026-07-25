import type { State } from "./State";
import type { ENTER } from "../constants/ENTER";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

type StateFromHandler<Handler> = Handler extends (
  event: any,
  state: infer S extends State,
  ...args: any
) => any
  ? S
  : never;

type StateFromNode<Node, StateType extends string> =
  | {
      [
        EventType in Exclude<keyof Node, typeof ENTER> & string
      ]: StateFromHandler<NonNullable<Node[EventType]>>;
    }[Exclude<keyof Node, typeof ENTER> & string]
  | (typeof ENTER extends keyof Node
      ? StateFromHandler<NonNullable<Node[typeof ENTER]>>
      : never)
  | { type: StateType };

export type StateMachineState<M extends StateMachineLike> = {
  [StateType in keyof M & string]: StateFromNode<M[StateType], StateType>;
}[keyof M & string];
