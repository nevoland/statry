import type { RuntimeEvent } from "./RuntimeEvent";
import type { Event } from "./Event";
import type { State } from "./State";
import type { StateMachineDefinition } from "./StateMachineDefinition";

export type RuntimeEventListener<S extends State, E extends Event, Context> = (
  event: RuntimeEvent<StateMachineDefinition<S, E, Context>>,
) => void;
