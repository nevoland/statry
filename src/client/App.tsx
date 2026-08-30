import { getGlobal } from "@nevoland/get-global";
import { interval, timeout } from "futurise";

import {
  type Definition,
  ENTER,
  type RuntimeEvent,
  StateMachine,
} from "../../lib/main.js";

import { Inspector } from "./components/Inspector.js";

type DragState = { type: "idle" } | { type: "drag" };
type DragEvent = { type: "mousedown" } | { type: "mouseup" };

const dragDefinition: Definition<DragState, DragEvent> = {
  drag: {
    [ENTER]: (event) =>
      timeout(3000, () => event.target.send({ type: "mouseup" })),
    mouseup: () => ({ type: "idle" }),
  },
  idle: {
    mousedown: () => ({ type: "drag" }),
  },
};

const dragMachine = new StateMachine(dragDefinition, { type: "idle" });

const connectionMachine = new StateMachine<
  { type: "disconnected" } | { type: "connected" },
  { type: "connect" } | { type: "disconnect" }
>(
  {
    connected: {
      disconnect: () => ({ type: "disconnected" }),
    },
    disconnected: {
      connect: () => ({ type: "connected" }),
    },
  },
  { type: "disconnected" },
);

const heartbeatMachine = new StateMachine<
  { type: "off" } | { type: "on" },
  Extract<RuntimeEvent<typeof connectionMachine>, { type: "statetransition" }>
>(
  {
    off: {
      statetransition: (event, state) =>
        event.state.type === "connected" ? { type: "on" } : state,
    },
    on: {
      [ENTER]: () => interval(1000, () => console.warn("ping")),
      statetransition: (event, state) =>
        event.state.type === "disconnected" ? { type: "off" } : state,
    },
  },
  { type: "off" },
);
connectionMachine.addEventListener("statetransition", heartbeatMachine.send);

const machines = [
  { machine: dragMachine, name: "drag" },
  { machine: connectionMachine, name: "connection" },
  { machine: heartbeatMachine, name: "heartbeat" },
];

const globalScope = getGlobal() as unknown as Record<string, unknown>;
globalScope.__machines__ = {
  connection: connectionMachine,
  drag: dragMachine,
  heartbeat: heartbeatMachine,
};

export function App() {
  return (
    <main class="flex w-full flex-col gap-6">
      <header class="flex flex-col gap-1">
        <h1 class="text-4xl font-extralight text-blue-400">Statry Inspector</h1>
        <p class="text-sm text-slate-400">
          Live view of running state machines. Drive them from the console via{" "}
          <code class="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
            __machines__.drag.send({"{"} type: "mousedown" {"}"})
          </code>
          .
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <DemoButton
            label="drag.mousedown"
            onClick={() => dragMachine.send({ type: "mousedown" })}
          />
          <DemoButton
            label="drag.mouseup"
            onClick={() => dragMachine.send({ type: "mouseup" })}
          />
          <DemoButton
            label="connection.connect"
            onClick={() => connectionMachine.send({ type: "connect" })}
          />
          <DemoButton
            label="connection.disconnect"
            onClick={() => connectionMachine.send({ type: "disconnect" })}
          />
        </div>
      </header>
      <Inspector machines={machines} />
    </main>
  );
}

type DemoButtonProps = {
  label: string;
  onClick: () => void;
};

function DemoButton({ label, onClick }: DemoButtonProps) {
  return (
    <button
      class="rounded border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-300 hover:border-blue-500 hover:text-blue-300"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
