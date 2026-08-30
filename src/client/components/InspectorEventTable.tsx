import { clsx, useState } from "../dependencies.js";
import type {
  InspectorMachineEntry,
  InspectorRuntimeEvent,
} from "../tools/inspector/types.js";

export type InspectorEventTableProps = {
  events: InspectorRuntimeEvent[];
  machines: InspectorMachineEntry[];
  selectedEvent: InspectorRuntimeEvent | null;
  onSelectEvent: (event: InspectorRuntimeEvent | null) => void;
};

export function InspectorEventTable({
  events,
  machines,
  selectedEvent,
  onSelectEvent,
}: InspectorEventTableProps) {
  const [expanded, setExpanded] = useState<Set<InspectorRuntimeEvent>>(
    () => new Set(),
  );
  const showMachineColumn = machines.length > 1;

  if (events.length === 0) {
    return (
      <div class="rounded-md border border-slate-800 bg-slate-950 p-3 text-sm text-slate-500 italic">
        No events observed yet.
      </div>
    );
  }

  const rows = [...events].reverse();

  return (
    <div class="overflow-hidden rounded-md border border-slate-800 bg-slate-950">
      <table class="w-full text-left text-xs text-slate-300">
        <thead class="bg-slate-900 text-[10px] tracking-wide text-slate-500 uppercase">
          <tr>
            <th class="w-8 px-2 py-2"></th>
            <th class="px-2 py-2">Type</th>
            <th class="px-2 py-2">Prev</th>
            <th class="px-2 py-2">Next</th>
            {showMachineColumn && <th class="px-2 py-2">Machine</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((event, index) => (
            <EventRow
              event={event}
              expanded={expanded.has(event)}
              key={events.length - 1 - index}
              machines={machines}
              onSelect={onSelectEvent}
              onToggleExpand={() =>
                setExpanded((previous) => toggle(previous, event))
              }
              selected={event === selectedEvent}
              showMachineColumn={showMachineColumn}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type EventRowProps = {
  event: InspectorRuntimeEvent;
  expanded: boolean;
  onToggleExpand: () => void;
  selected: boolean;
  onSelect: (event: InspectorRuntimeEvent | null) => void;
  machines: InspectorMachineEntry[];
  showMachineColumn: boolean;
};

function EventRow({
  event,
  expanded,
  onToggleExpand,
  selected,
  onSelect,
  machines,
  showMachineColumn,
}: EventRowProps) {
  const columns = showMachineColumn ? 5 : 4;
  const eventType = event.type === "dispose" ? "dispose" : event.trigger.type;
  const previousStateType =
    event.type === "ignoredevent" ? event.state.type : event.previousState.type;
  const nextStateType =
    event.type === "statetransition"
      ? event.state.type
      : event.type === "selftransition"
        ? event.state.type
        : "—";
  const machineName = resolveMachineName(event, machines);
  const isMuted = event.type === "ignoredevent" || event.type === "dispose";
  const isSelf = event.type === "selftransition";
  const canExpand = event.type !== "dispose";

  return (
    <>
      <tr
        class={clsx(
          "cursor-pointer border-t border-slate-800/60 transition-colors",
          selected ? "bg-slate-800" : "hover:bg-slate-900",
          isMuted && "italic",
        )}
        onClick={() => onSelect(selected ? null : event)}
        onMouseEnter={() => onSelect(event)}
        onMouseLeave={() => onSelect(null)}
      >
        <td class="px-2 py-1.5">
          {canExpand && (
            <button
              aria-label={expanded ? "Collapse payload" : "Expand payload"}
              class="text-slate-500 hover:text-slate-200"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onToggleExpand();
              }}
              type="button"
            >
              {expanded ? "▾" : "▸"}
            </button>
          )}
        </td>
        <td
          class={clsx(
            "px-2 py-1.5 font-mono",
            isMuted ? "text-slate-500" : "text-slate-200",
          )}
        >
          {eventType}
          {isSelf && (
            <span class="ml-1 text-[10px] text-slate-500">(self)</span>
          )}
        </td>
        <td class="px-2 py-1.5 font-mono text-slate-400">
          {previousStateType}
        </td>
        <td
          class={clsx(
            "px-2 py-1.5 font-mono",
            nextStateType === "—" ? "text-slate-600" : "text-slate-400",
          )}
        >
          {nextStateType}
        </td>
        {showMachineColumn && (
          <td class="px-2 py-1.5 text-slate-400">{machineName}</td>
        )}
      </tr>
      {expanded && canExpand && (
        <tr class="border-t border-slate-800/60 bg-slate-950/60">
          <td class="px-2 py-2"></td>
          <td colSpan={columns - 1} class="px-2 py-2">
            <pre class="max-h-40 overflow-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-300">
              {JSON.stringify(event.trigger, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function resolveMachineName(
  event: InspectorRuntimeEvent,
  machines: InspectorMachineEntry[],
): string {
  const entry = machines.find(({ machine }) => machine === event.target);
  return entry?.name ?? "unknown";
}
