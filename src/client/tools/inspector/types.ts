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
