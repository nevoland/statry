import { useEffect, useMemo, useRef, useState } from "../../dependencies.js";

import { analyzeDefinition } from "./analyze.js";
import {
  branchKey,
  edgeKey,
  type AnyStateMachine,
  type InspectorLearnedEdge,
  type InspectorMachineEntry,
  type InspectorRuntimeEvent,
  type MachineDescription,
} from "./types.js";

const FLASH_DURATION_MS = 600;

export type InspectorMachineView = {
  description: MachineDescription;
  currentStateType: string;
  initialStateType: string;
  observedCounts: Map<string, number>;
  dynamicEdges: InspectorLearnedEdge[];
  flashEdgeKey: string | null;
};

export type InspectorState = {
  events: InspectorRuntimeEvent[];
  views: Map<AnyStateMachine, InspectorMachineView>;
};

export function useInspector(entries: InspectorMachineEntry[]): InspectorState {
  const descriptionsRef = useRef<Map<AnyStateMachine, MachineDescription>>(
    new Map(),
  );

  const initialViews = useMemo(() => {
    const views = new Map<AnyStateMachine, InspectorMachineView>();
    for (const { machine } of entries) {
      const description = getDescription(descriptionsRef.current, machine);
      views.set(machine, {
        currentStateType: machine.state.type,
        description,
        dynamicEdges: [],
        flashEdgeKey: null,
        initialStateType: machine.state.type,
        observedCounts: new Map(),
      });
    }
    return views;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<InspectorState>(() => ({
    events: [],
    views: initialViews,
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
          description: getDescription(descriptionsRef.current, machine),
          dynamicEdges: [],
          flashEdgeKey: null,
          initialStateType: machine.state.type,
          observedCounts: new Map(),
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
        setState((previous) =>
          updateStateTransition(previous, machine, from, to, eventType, event),
        );

        const timers = flashTimersRef.current;
        const existing = timers.get(machine);
        if (existing !== undefined) clearTimeout(existing);
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
      for (const timer of flashTimersRef.current.values()) clearTimeout(timer);
      flashTimersRef.current.clear();
    };
  }, [entries]);

  return state;
}

function getDescription(
  cache: Map<AnyStateMachine, MachineDescription>,
  machine: AnyStateMachine,
): MachineDescription {
  const existing = cache.get(machine);
  if (existing !== undefined) return existing;
  const description = analyzeDefinition(machine.definition);
  cache.set(machine, description);
  return description;
}

function updateStateTransition(
  previous: InspectorState,
  machine: AnyStateMachine,
  from: string,
  to: string,
  eventType: string,
  event: InspectorRuntimeEvent,
): InspectorState {
  const view = previous.views.get(machine);
  if (view === undefined) {
    return { ...previous, events: [...previous.events, event] };
  }

  const state = view.description.states[from];
  const transition = state?.transitions.find((t) => t.eventType === eventType);
  const matchingBranchIndices: number[] = [];
  transition?.branches.forEach((branch, index) => {
    if (branch.kind === "transition" && branch.targetStateType === to) {
      matchingBranchIndices.push(index);
    }
  });

  const observedCounts = new Map(view.observedCounts);
  for (const index of matchingBranchIndices) {
    const key = branchKey(from, eventType, index);
    observedCounts.set(key, (observedCounts.get(key) ?? 0) + 1);
  }

  let dynamicEdges = view.dynamicEdges;
  if (matchingBranchIndices.length === 0) {
    const existing = dynamicEdges.find(
      (edge) =>
        edge.from === from && edge.to === to && edge.eventType === eventType,
    );
    dynamicEdges = existing
      ? dynamicEdges.map((edge) =>
          edge === existing ? { ...edge, count: edge.count + 1 } : edge,
        )
      : [...dynamicEdges, { count: 1, eventType, from, to }];
  }

  const nextView: InspectorMachineView = {
    ...view,
    currentStateType: to,
    dynamicEdges,
    flashEdgeKey: edgeKey(from, to, eventType),
    observedCounts,
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
