import type { Event } from "./Event";
import type { RuntimeEvent } from "./RuntimeEvent";
import type { State } from "./State";
import type { StateMachineDefinition } from "./StateMachineDefinition";

export type CleanupCallback<S extends State, E extends Event, Context> = (
  event: RuntimeEvent<StateMachineDefinition<S, E, Context>>,
  state: S,
  context: Context,
) => void;
