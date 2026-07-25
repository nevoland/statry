import type { ENTER } from "../constants/ENTER";

import type { CleanupCallback } from "./CleanupCallback";
import type { Event } from "./Event";
import type { RuntimeEvent } from "./RuntimeEvent";
import type { State } from "./State";

/**
 * Mapping of state transitions to their corresponding events.
 *
 * @param S - The state type.
 * @param E - The event type.
 * @param Context - The context type.
 */
export type StateMachine<S extends State, E extends Event, Context> = [
  0,
  0,
  0,
] extends [1 & S, 1 & E, 1 & Context]
  ? {
      [SType in string]: {
        [ENTER]?: (
          event: RuntimeEvent<S, E, Context>,
          state: Extract<S, { type: SType }>,
          context: Context,
          dispatchEvent: (event: E) => void,
        ) => CleanupCallback<S, E, Context> | void;
      } & {
        [EType in string]: (
          event: Extract<E, { type: EType }>,
          state: Extract<S, { type: SType }>,
          context: Context,
        ) => S;
      };
    }
  : {
      [SType in S["type"]]: {
        [ENTER]?: (
          event: RuntimeEvent<S, E, Context>,
          state: Extract<S, { type: SType }>,
          context: Context,
          dispatchEvent: (event: E) => void,
        ) => CleanupCallback<S, E, Context> | void;
      } & {
        [EType in E["type"]]?: (
          event: Extract<E, { type: EType }>,
          state: Extract<S, { type: SType }>,
          context: Context,
        ) => S;
      };
    };
