import type { Event } from "./Event";
import type { RuntimeEvent } from "./RuntimeEvent";
import type { State } from "./State";

export type CleanupCallback<S extends State, E extends Event, Context> = (
  event: RuntimeEvent<S, E, Context>,
  state: S,
  context: Context,
) => void;
