type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

type StateMachineStateFromNode<Node, StateType extends string> =
  | { type: StateType }
  | {
      [EventType in keyof Node & string]: NonNullable<Node[EventType]> extends (
        ...args: any[]
      ) => infer NextState
        ? NextState
        : never;
    }[keyof Node & string];

export type StateMachineState<M extends StateMachineLike> = Extract<
  {
    [StateType in keyof M & string]: StateMachineStateFromNode<
      M[StateType],
      StateType
    >;
  }[keyof M & string],
  { type: string }
>;
