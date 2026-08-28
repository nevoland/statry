import type { ENTER } from "../constants/ENTER.js";

import type { CleanupCallback } from "./CleanupCallback";
import type { Event } from "./Event";
import type { RuntimeEventInternal } from "./RuntimeEvent";
import type { State } from "./State";

/**
 * Mapping of state transitions to their corresponding events.
 *
 * @param S - The state type.
 * @param E - The event type.
 * @param Context - The context type.
 */
export type Definition<S extends State, E extends Event, Context = unknown> = {
  [SType in S["type"]]: {
    [ENTER]?: (
      event: RuntimeEventInternal<Extract<S, { type: SType }>, E, Context>,
      state: Extract<S, { type: SType }>,
      context: Context,
    ) => CleanupCallback<S, E, Context> | void;
  } & {
    [EType in E["type"]]?: (
      event: Extract<E, { type: EType }>,
      state: Extract<S, { type: SType }>,
      context: Context,
    ) => S;
  };
};
