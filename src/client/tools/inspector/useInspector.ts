import { useEffect, useRef, useState } from "../../dependencies.js";

import {
  edgeKey,
  type AnyStateMachine,
  type InspectorLearnedEdge,
  type InspectorMachineEntry,
  type InspectorRuntimeEvent,
} from "./types.js";

const FLASH_DURATION_MS = 600;

export type InspectorMachineView = {
  currentStateType: string;
  initialStateType: string;
  edges: InspectorLearnedEdge[];
  flashEdgeKey: string | null;
};

export type InspectorState = {
  events: InspectorRuntimeEvent[];
  views: Map<AnyStateMachine, InspectorMachineView>;
};

export function useInspector(entries: InspectorMachineEntry[]): InspectorState {
  const [state, setState] = useState<InspectorState>(() => ({
    events: [],
    views: new Map(
      entries.map(({ machine }) => [
        machine,
        {
          currentStateType: machine.state.type,
          edges: [],
          flashEdgeKey: null,
          initialStateType: machine.state.type,
        },
      ]),
    ),
  }));

  const flashTimersRef = useRef<Map<AnyStateMachine, number>>(new Map());

  useEffect(() => {
    setState((previous) => {
      let mutated = false;
      const views = new Map(previous.views);
      for (const { machine } of entries) {
        if (views.has(machine)) continue;
        mutated = true;
        views.set(machine, {
          currentStateType: machine.state.type,
          edges: [],
          flashEdgeKey: null,
          initialStateType: machine.state.type,
        });
      }
      return mutated ? { ...previous, views } : previous;
    });

    const cleanups: Array<() => void> = [];

    for (const { machine } of entries) {
      const onStateTransition = (event: InspectorRuntimeEvent) => {
        if (event.type !== "statetransition") return;
        const from = event.previousState.type;
        const to = event.state.type;
        const eventType = event.trigger.type;
        const key = edgeKey(from, to, eventType);
        setState((previous) =>
          updateStateTransition(previous, machine, from, to, eventType, key, event),
        );

        const timers = flashTimersRef.current;
        const existingTimer = timers.get(machine);
        if (existingTimer !== undefined) clearTimeout(existingTimer);
        const timer = window.setTimeout(() => {
          timers.delete(machine);
          setState((previous) => clearFlash(previous, machine));
        }, FLASH_DURATION_MS);
        timers.set(machine, timer);
      };

      const appendEvent = (event: InspectorRuntimeEvent) => {
        setState((previous) => ({
          ...previous,
          events: [...previous.events, event],
        }));
      };

      const onSelfTransition = (event: InspectorRuntimeEvent) => {
        if (event.type !== "selftransition") return;
        appendEvent(event);
      };

      const onIgnoredEvent = (event: InspectorRuntimeEvent) => {
        if (event.type !== "ignoredevent") return;
        appendEvent(event);
      };

      const onDispose = (event: InspectorRuntimeEvent) => {
        if (event.type !== "dispose") return;
        appendEvent(event);
      };

      machine.addEventListener("statetransition", onStateTransition);
      machine.addEventListener("selftransition", onSelfTransition);
      machine.addEventListener("ignoredevent", onIgnoredEvent);
      machine.addEventListener("dispose", onDispose);

      cleanups.push(() => {
        machine.removeEventListener("statetransition", onStateTransition);
        machine.removeEventListener("selftransition", onSelfTransition);
        machine.removeEventListener("ignoredevent", onIgnoredEvent);
        machine.removeEventListener("dispose", onDispose);
      });
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      for (const timer of flashTimersRef.current.values()) {
        clearTimeout(timer);
      }
      flashTimersRef.current.clear();
    };
  }, [entries]);

  return state;
}

function updateStateTransition(
  previous: InspectorState,
  machine: AnyStateMachine,
  from: string,
  to: string,
  eventType: string,
  key: string,
  event: InspectorRuntimeEvent,
): InspectorState {
  const view = previous.views.get(machine);
  if (view === undefined) {
    return { ...previous, events: [...previous.events, event] };
  }
  const existing = view.edges.find(
    (edge) =>
      edge.from === from && edge.to === to && edge.eventType === eventType,
  );
  const nextEdges = existing
    ? view.edges.map((edge) =>
        edge === existing ? { ...edge, count: edge.count + 1 } : edge,
      )
    : [...view.edges, { count: 1, eventType, from, to }];
  const nextView: InspectorMachineView = {
    ...view,
    currentStateType: to,
    edges: nextEdges,
    flashEdgeKey: key,
  };
  const views = new Map(previous.views).set(machine, nextView);
  return {
    events: [...previous.events, event],
    views,
  };
}

function clearFlash(
  previous: InspectorState,
  machine: AnyStateMachine,
): InspectorState {
  const view = previous.views.get(machine);
  if (view === undefined || view.flashEdgeKey === null) return previous;
  const views = new Map(previous.views).set(machine, {
    ...view,
    flashEdgeKey: null,
  });
  return { ...previous, views };
}
