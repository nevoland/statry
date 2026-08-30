import { clsx, useCallback, useMemo, useState } from "../dependencies.js";
import {
  edgeKey,
  type AnyStateMachine,
  type InspectorMachineEntry,
  type InspectorRuntimeEvent,
} from "../tools/inspector/types.js";
import { useInspector } from "../tools/inspector/useInspector.js";

import { InspectorCanvas } from "./InspectorCanvas.js";
import { InspectorEventTable } from "./InspectorEventTable.js";

export type InspectorProps = {
  machines: InspectorMachineEntry[];
};

export function Inspector({ machines }: InspectorProps) {
  const [visibleMachines, setVisibleMachines] = useState<Set<AnyStateMachine>>(
    () => new Set(machines.map(({ machine }) => machine)),
  );
  const [showIgnored, setShowIgnored] = useState(true);
  const [selectedEvent, setSelectedEvent] =
    useState<InspectorRuntimeEvent | null>(null);

  const { events, views } = useInspector(machines);

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          visibleMachines.has(event.target) &&
          (showIgnored || event.type !== "ignoredevent"),
      ),
    [events, visibleMachines, showIgnored],
  );

  const visibleEntries = useMemo(
    () => machines.filter(({ machine }) => visibleMachines.has(machine)),
    [machines, visibleMachines],
  );

  const resolveHighlight = useCallback(
    (machine: AnyStateMachine) => resolveEventHighlight(selectedEvent, machine),
    [selectedEvent],
  );

  return (
    <section class="flex w-full flex-col gap-3">
      <header class="flex flex-wrap items-center gap-2">
        <span class="text-xs tracking-wide text-slate-500 uppercase">
          Machines
        </span>
        {machines.map(({ name, machine }) => {
          const active = visibleMachines.has(machine);
          return (
            <button
              class={clsx(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                active
                  ? "border-blue-500 bg-blue-500/10 text-blue-300"
                  : "border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300",
              )}
              key={name}
              onClick={() =>
                setVisibleMachines((previous) =>
                  toggle(previous, machine),
                )
              }
              type="button"
            >
              {name}
            </button>
          );
        })}
        <label class="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <input
            checked={showIgnored}
            class="accent-blue-500"
            onChange={(event) =>
              setShowIgnored((event.target as HTMLInputElement).checked)
            }
            type="checkbox"
          />
          Show ignored events
        </label>
      </header>

      <InspectorCanvas
        machines={visibleEntries}
        resolveHighlight={resolveHighlight}
        views={views}
      />

      <InspectorEventTable
        events={filteredEvents}
        machines={machines}
        onSelectEvent={setSelectedEvent}
        selectedEvent={selectedEvent}
      />
    </section>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function resolveEventHighlight(
  event: InspectorRuntimeEvent | null,
  machine: AnyStateMachine,
): { edgeKey: string | null; ignoredState: string | null } {
  if (event === null || event.target !== machine) {
    return { edgeKey: null, ignoredState: null };
  }
  if (event.type === "statetransition") {
    return {
      edgeKey: edgeKey(
        event.previousState.type,
        event.state.type,
        event.trigger.type,
      ),
      ignoredState: null,
    };
  }
  if (event.type === "selftransition") {
    return {
      edgeKey: edgeKey(
        event.state.type,
        event.state.type,
        event.trigger.type,
      ),
      ignoredState: null,
    };
  }
  if (event.type === "ignoredevent") {
    return { edgeKey: null, ignoredState: event.state.type };
  }
  return { edgeKey: null, ignoredState: null };
}
