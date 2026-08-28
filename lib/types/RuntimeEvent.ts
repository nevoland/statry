import type { StateMachine } from "../classes/StateMachine.js";

import type { Event } from "./Event";
import type { State } from "./State";

/**
 * Discriminated union of runtime events produced by a state machine: a transition to a new state,
 * a self-transition, or an event ignored by the current state.
 *
 * @template S The state type.
 * @template E The event type.
 * @template Context The state machine's context type.
 */
export type RuntimeEventInternal<
  S extends State = State,
  E extends Event = Event,
  Context = unknown,
> =
  | {
      type: "statetransition";
      state: S;
      target: StateMachine<S, E, Context>;
      trigger: E;
      timeStamp: number;
      previousState: S;
    }
  | {
      type: "selftransition";
      state: S;
      target: StateMachine<S, E, Context>;
      trigger: E;
      timeStamp: number;
      previousState: S;
    }
  | {
      type: "ignoredevent";
      state: S;
      target: StateMachine<S, E, Context>;
      trigger: E;
      timeStamp: number;
    };

/**
 * Runtime event emitted by a `StateMachine`, with state, event, and context types inferred from `M`.
 *
 * @template M The `StateMachine` instance type to infer state, event, and context types from.
 */
export type RuntimeEvent<M extends StateMachine<any, any, any>> =
  RuntimeEventInternal<
    StateMachineState<M>,
    StateMachineEvent<M>,
    StateMachineContext<M>
  >;

type StateMachineState<M extends StateMachine<any, any, any>> =
  M extends StateMachine<infer S, any, any> ? S : never;

type StateMachineEvent<M extends StateMachine<any, any, any>> =
  M extends StateMachine<any, infer E, any> ? E : never;

type StateMachineContext<M extends StateMachine<any, any, any>> =
  M extends StateMachine<any, any, infer C> ? C : never;
