import type { Event } from "./Event";
import type { RuntimeEventInternal } from "./RuntimeEvent";
import type { State } from "./State";

/**
 * Callback invoked when leaving a state, receiving the triggering runtime event, the state being
 * exited, and the current context.
 *
 * @template S - The state type.
 * @template E - The event type.
 * @template Context - The state machine's context type.
 */
export type CleanupCallback<S extends State, E extends Event, Context> = (
  event: RuntimeEventInternal<S, E, Context>,
  state: S,
  context?: Context,
) => void;
