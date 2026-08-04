import type { ENTER } from "../constants/ENTER.js";

import type { CleanupCallback } from "./CleanupCallback";
import type { Event } from "./Event";
import type { RuntimeEventStateTransition } from "./RuntimeEventStateTransition";
import type { State } from "./State";

type StateMachineRuntimeTarget<E extends Event> = {
  send(event: E): void;
};

/**
 * Mapping of state transitions to their corresponding events.
 *
 * @param S - The state type.
 * @param E - The event type.
 * @param Context - The context type.
 */
export type StateMachine<S extends State, E extends Event, Context> = {
  [SType in S["type"]]: {
    [ENTER]?: (
      event: RuntimeEventStateTransition<
        Extract<S, { type: SType }>,
        StateMachineRuntimeTarget<E>,
        E,
        S
      >,
      state: Extract<S, { type: SType }>,
      context: Context,
      send: (event: E) => void,
    ) => CleanupCallback<S, E, Context> | void;
  } & {
    [EType in E["type"]]?: (
      event: Extract<E, { type: EType }>,
      state: Extract<S, { type: SType }>,
      context: Context,
    ) => S;
  };
};
