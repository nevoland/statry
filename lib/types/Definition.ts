import type { ENTER } from "../constants/ENTER.js";

import type { CleanupCallback } from "./CleanupCallback";
import type { Event } from "./Event";
import type { RuntimeEventInternal } from "./RuntimeEvent";
import type { State } from "./State";

/**
 * Definition of a state machine: for each state `type`, an optional `ENTER` lifecycle hook and a
 * map from event `type` to a transition handler.
 *
 * @param S - The state type.
 * @param E - The event type.
 * @param Context - The context type.
 */
export type Definition<S extends State, E extends Event, Context = unknown> = {
  [SType in S["type"]]: {
    /**
     * Lifecycle hook invoked when the state machine transitions into this state from a state of a
     * different `type`. Receives the triggering `statetransition` runtime event, the newly-entered
     * state, and the current context. May return a cleanup callback that runs when the state is
     * left (via another transition or via disposal).
     *
     * Not invoked for the initial state a machine is constructed (or cloned) in — no transition
     * has occurred at that point. To run setup on startup, model an explicit `idle → started`
     * transition triggered by a bootstrap event.
     */
    [ENTER]?: (
      event: RuntimeEventInternal<Extract<S, { type: SType }>, E, Context>,
      state: Extract<S, { type: SType }>,
      context: Context,
    ) => CleanupCallback<S, E, Context> | void;
  } & {
    /**
     * Transition handler invoked when an event of this `type` is dispatched while the machine is
     * in a state of the enclosing `type`. Receives the event, the current state, and the current
     * context, and returns the next state. Returning a state whose `type` matches the current
     * one yields a self-transition; returning a state whose `type` differs yields a full
     * state transition (which runs the previous state's cleanup and the next state's `ENTER`).
     */
    [EType in E["type"]]?: (
      event: Extract<E, { type: EType }>,
      state: Extract<S, { type: SType }>,
      context: Context,
    ) => S;
  };
};
