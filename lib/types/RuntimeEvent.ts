import type { StateMachine } from "../classes/StateMachine.js";

import type { Event } from "./Event";
import type { State } from "./State";

/**
 * Discriminated union of runtime events produced by a state machine: a transition to a new state,
 * a self-transition, or an event ignored by the current state.
 *
 * @template S - The state type.
 * @template E - The event type.
 * @template Context - The state machine's context type.
 */
export type RuntimeEventInternal<
  S extends State = State,
  E extends Event = Event,
  Context = unknown,
> =
  | {
      /** Discriminator identifying a transition to a state whose `type` differs from the previous state. */
      type: "statetransition";
      /** The new state the state machine has just entered. */
      state: S;
      /** The state machine instance that produced this event. */
      target: StateMachine<S, E, Context>;
      /** The event that triggered the transition. */
      trigger: E;
      /** Timestamp (in milliseconds since epoch) at which the transition occurred. */
      timeStamp: number;
      /** The state the state machine was in before the transition. */
      previousState: S;
    }
  | {
      /** Discriminator identifying a transition that stays within the same state `type` (data may still change). */
      type: "selftransition";
      /** The state after the transition; shares the same `type` as `previousState`. */
      state: S;
      /** The state machine instance that produced this event. */
      target: StateMachine<S, E, Context>;
      /** The event that triggered the self-transition. */
      trigger: E;
      /** Timestamp (in milliseconds since epoch) at which the self-transition occurred. */
      timeStamp: number;
      /** The state the state machine was in before the self-transition. */
      previousState: S;
    }
  | {
      /** Discriminator identifying an event that had no matching handler in the current state. */
      type: "ignoredevent";
      /** The current state of the state machine, which did not handle the event. */
      state: S;
      /** The state machine instance that produced this event. */
      target: StateMachine<S, E, Context>;
      /** The event that was dispatched but ignored. */
      trigger: E;
      /** Timestamp (in milliseconds since epoch) at which the event was ignored. */
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
