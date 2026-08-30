import type { RuntimeEvent, StateMachine } from "#lib";

export type AnyStateMachine = StateMachine<any, any, any>;

export type InspectorMachineEntry = {
  name: string;
  machine: AnyStateMachine;
};

export type InspectorRuntimeEvent = RuntimeEvent<AnyStateMachine>;

export type InspectorLearnedEdge = {
  from: string;
  to: string;
  eventType: string;
  count: number;
};

export type InspectorLayoutNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type InspectorLayoutEdge = {
  from: string;
  to: string;
  eventType: string;
  path: string;
  labelX: number;
  labelY: number;
  branchIndex: number;
  branchTotal: number;
  guards: GuardCondition[];
  isDynamic: boolean;
};

export type InspectorLayoutResult = {
  nodes: InspectorLayoutNode[];
  edges: InspectorLayoutEdge[];
  width: number;
  height: number;
};

export function edgeKey(from: string, to: string, eventType: string): string {
  return `${from}->${to}:${eventType}`;
}

export function branchKey(
  stateType: string,
  eventType: string,
  branchIndex: number,
): string {
  return `${stateType}:${eventType}:${branchIndex}`;
}

export type MachineDescription = {
  states: Record<string, StateDescription>;
};

export type StateDescription = {
  type: string;
  hasEnter: boolean;
  eventTypes: string[];
  transitions: TransitionDescription[];
  parseError?: string;
};

export type TransitionDescription = {
  eventType: string;
  branches: TransitionBranch[];
};

export type TransitionBranch = {
  kind: "transition" | "self" | "unknown";
  targetStateType: string | null;
  guards: GuardCondition[];
  returnSource: string;
};

export type GuardCondition = {
  source: string;
  negated: boolean;
};
