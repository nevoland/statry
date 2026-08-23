import type { RuntimeEvent } from "./RuntimeEvent";

type StateMachineLike = Record<string, Record<PropertyKey, unknown>>;

export type RuntimeEventType = RuntimeEvent<StateMachineLike>["type"];
