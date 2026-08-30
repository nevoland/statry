import type { ComponentChildren } from "preact";

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
            <th class="w-6 px-2 py-2"></th>
            <th class="px-2 py-2">Type</th>
            <th class="px-2 py-2">Prev</th>
            <th class="px-2 py-2">Next</th>
            {showMachineColumn && <th class="px-2 py-2">Machine</th>}
            <th class="w-20 px-2 py-2">Time</th>
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
  const columns = showMachineColumn ? 6 : 5;
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
  const isIgnored = event.type === "ignoredevent";
  const time = formatTime(event.timeStamp);

  return (
    <>
      <tr
        class={clsx(
          "cursor-pointer border-t border-slate-800/60 transition-colors",
          selected ? "bg-slate-800" : "hover:bg-slate-900",
          isMuted && "italic",
        )}
        onClick={onToggleExpand}
        onMouseEnter={() => onSelect(event)}
        onMouseLeave={() => onSelect(null)}
      >
        <td class="px-2 py-1.5 text-slate-500">{expanded ? "▾" : "▸"}</td>
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
          {isIgnored && (
            <span class="ml-1 text-[10px] text-red-400">(ignored)</span>
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
        <td class="px-2 py-1.5 font-mono text-[10px] text-slate-500">
          {time}
        </td>
      </tr>
      {expanded && (
        <tr class="border-t border-slate-800/60 bg-slate-950/60">
          <td class="px-2 py-2"></td>
          <td class="px-2 py-2" colSpan={columns - 1}>
            <EventDetail event={event} machineName={machineName} />
          </td>
        </tr>
      )}
    </>
  );
}

type EventDetailProps = {
  event: InspectorRuntimeEvent;
  machineName: string;
};

function EventDetail({ event, machineName }: EventDetailProps) {
  const kind = kindLabel(event.type);
  return (
    <dl class="flex flex-col gap-2 text-[11px]">
      <DetailRow label="Kind">
        <span class="text-slate-200">{kind}</span>
      </DetailRow>
      <DetailRow label="Machine">
        <span class="text-slate-200">{machineName}</span>
      </DetailRow>
      <DetailRow label="Timestamp">
        <span class="font-mono text-slate-200">
          {formatTimestampFull(event.timeStamp)}
        </span>
      </DetailRow>
      {event.type !== "dispose" && (
        <DetailRow label="Trigger">
          <JsonBlock value={event.trigger} />
        </DetailRow>
      )}
      {event.type !== "ignoredevent" && (
        <DetailRow label="Previous state">
          <JsonBlock value={event.previousState} />
        </DetailRow>
      )}
      {(event.type === "statetransition" ||
        event.type === "selftransition" ||
        event.type === "ignoredevent") && (
        <DetailRow label={event.type === "ignoredevent" ? "State" : "Next state"}>
          <JsonBlock value={event.state} />
        </DetailRow>
      )}
    </dl>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ComponentChildren;
}) {
  return (
    <div class="flex flex-col gap-1 sm:flex-row sm:gap-3">
      <dt class="w-28 shrink-0 text-[10px] tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd class="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre class="max-h-40 overflow-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function kindLabel(type: InspectorRuntimeEvent["type"]): string {
  switch (type) {
    case "statetransition":
      return "State transition";
    case "selftransition":
      return "Self transition";
    case "ignoredevent":
      return "Ignored event";
    case "dispose":
      return "Dispose";
  }
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

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatTimestampFull(timestamp: number): string {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}
