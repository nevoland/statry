import type { ComponentChildren } from "preact";

import {
  clsx,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "../dependencies.js";
import { formatEdgeLabel, inspectorLayout } from "../tools/inspector/layout.js";
import {
  branchKey,
  edgeKey,
  type GuardCondition,
  type InspectorLayoutEdge,
  type InspectorLearnedEdge,
  type MachineDescription,
} from "../tools/inspector/types.js";

export type InspectorDiagramProps = {
  name: string;
  description: MachineDescription;
  initialStateType: string;
  currentStateType: string;
  observedCounts: Map<string, number>;
  dynamicEdges: InspectorLearnedEdge[];
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  ignoredHighlightState: string | null;
};

type NodeDrag = {
  kind: "node";
  nodeId: string;
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  scaleX: number;
  scaleY: number;
};

type PanDrag = {
  kind: "pan";
  startClientX: number;
  startClientY: number;
  initialPanX: number;
  initialPanY: number;
  scaleX: number;
  scaleY: number;
};

type DragState = NodeDrag | PanDrag;

type PopoverState = {
  edgeKey: string;
  x: number;
  y: number;
};

export function InspectorDiagram({
  name,
  description,
  initialStateType,
  currentStateType,
  observedCounts,
  dynamicEdges,
  flashEdgeKey,
  highlightedEdgeKey,
  ignoredHighlightState,
}: InspectorDiagramProps) {
  const arrowId = useId();
  const arrowHighlightId = useId();
  const arrowMutedId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [overrides, setOverrides] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const layout = useMemo(
    () => inspectorLayout(description, initialStateType, dynamicEdges, overrides),
    [description, initialStateType, dynamicEdges, overrides],
  );

  const viewBox = {
    height: layout.height,
    minX: layout.minX + pan.x,
    minY: layout.minY + pan.y,
    width: layout.width,
  };

  useEffect(() => {
    if (drag === null) return undefined;

    const onMove = (event: PointerEvent) => {
      const dx = (event.clientX - drag.startClientX) * drag.scaleX;
      const dy = (event.clientY - drag.startClientY) * drag.scaleY;
      if (drag.kind === "node") {
        setOverrides((previous) => {
          const next = new Map(previous);
          next.set(drag.nodeId, {
            x: drag.initialX + dx,
            y: drag.initialY + dy,
          });
          return next;
        });
      } else {
        setPan({
          x: drag.initialPanX - dx,
          y: drag.initialPanY - dy,
        });
      }
    };

    const onUp = () => setDrag(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag]);

  useEffect(() => {
    if (popover === null) return undefined;
    const onDocPointerDown = (event: Event) => {
      if (figureRef.current === null) return;
      if (
        event.target instanceof Node &&
        figureRef.current.contains(event.target) &&
        (event.target as Element).closest("[data-inspector-popover]") !== null
      ) {
        return;
      }
      setPopover(null);
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [popover]);

  function getScale(): { scaleX: number; scaleY: number } {
    const svg = svgRef.current;
    if (svg === null) return { scaleX: 1, scaleY: 1 };
    const rect = svg.getBoundingClientRect();
    return {
      scaleX: viewBox.width / rect.width,
      scaleY: viewBox.height / rect.height,
    };
  }

  const onSvgPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("[data-node]")) {
      return;
    }
    if (event.target instanceof Element && event.target.closest("[data-edge]")) {
      return;
    }
    event.preventDefault();
    const { scaleX, scaleY } = getScale();
    setDrag({
      initialPanX: pan.x,
      initialPanY: pan.y,
      kind: "pan",
      scaleX,
      scaleY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    setPopover(null);
  };

  const onNodePointerDown = (nodeId: string, event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const node = layout.nodes.find((n) => n.id === nodeId);
    if (node === undefined) return;
    const { scaleX, scaleY } = getScale();
    setDrag({
      initialX: node.x,
      initialY: node.y,
      kind: "node",
      nodeId,
      scaleX,
      scaleY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    setPopover(null);
  };

  const onEdgeLabelClick = (
    edge: InspectorLayoutEdge,
    event: MouseEvent,
  ) => {
    event.stopPropagation();
    const figure = figureRef.current;
    if (figure === null) return;
    const rect = figure.getBoundingClientRect();
    const key = edgeKey(edge.from, edge.to, edge.eventType);
    if (popover !== null && popover.edgeKey === key) {
      setPopover(null);
      return;
    }
    setPopover({
      edgeKey: key,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const resetLayout = () => {
    setOverrides(new Map());
    setPan({ x: 0, y: 0 });
    setPopover(null);
  };

  const hasCustomLayout = overrides.size > 0 || pan.x !== 0 || pan.y !== 0;
  const popoverEdge =
    popover === null
      ? null
      : layout.edges.find(
          (e) => edgeKey(e.from, e.to, e.eventType) === popover.edgeKey,
        ) ?? null;
  const popoverCount =
    popoverEdge === null || popoverEdge.isDynamic
      ? null
      : observedCounts.get(
          branchKey(
            popoverEdge.from,
            popoverEdge.eventType,
            popoverEdge.branchIndex,
          ),
        ) ?? 0;

  const cursorClass =
    drag?.kind === "pan" ? "cursor-grabbing" : "cursor-grab";

  return (
    <figure
      class="relative flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950 p-3"
      ref={figureRef}
    >
      <div class="flex items-center justify-between">
        <figcaption class="text-xs font-medium tracking-wide text-slate-400 uppercase">
          {name}
        </figcaption>
        {hasCustomLayout && (
          <button
            class="rounded border border-slate-700 px-2 py-0.5 text-[10px] tracking-wide text-slate-400 uppercase hover:border-blue-500 hover:text-blue-300"
            onClick={resetLayout}
            type="button"
          >
            Reset layout
          </button>
        )}
      </div>
      <svg
        class={clsx("block h-auto w-full touch-none text-slate-200", cursorClass)}
        onPointerDown={onSvgPointerDown}
        ref={svgRef}
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      >
        <defs>
          <marker
            id={arrowId}
            markerHeight="6"
            markerWidth="8"
            orient="auto-start-reverse"
            refX="7"
            refY="3"
            viewBox="0 0 8 6"
          >
            <path d="M 0 0 L 8 3 L 0 6 z" fill="rgb(100 116 139)" />
          </marker>
          <marker
            id={arrowMutedId}
            markerHeight="6"
            markerWidth="8"
            orient="auto-start-reverse"
            refX="7"
            refY="3"
            viewBox="0 0 8 6"
          >
            <path
              d="M 0 0 L 8 3 L 0 6 z"
              fill="rgb(100 116 139)"
              opacity="0.4"
            />
          </marker>
          <marker
            id={arrowHighlightId}
            markerHeight="6"
            markerWidth="8"
            orient="auto-start-reverse"
            refX="7"
            refY="3"
            viewBox="0 0 8 6"
          >
            <path d="M 0 0 L 8 3 L 0 6 z" fill="rgb(96 165 250)" />
          </marker>
        </defs>
        {layout.edges.map((edge) => (
          <DiagramEdge
            arrowHighlightId={arrowHighlightId}
            arrowId={arrowId}
            arrowMutedId={arrowMutedId}
            edge={edge}
            flashEdgeKey={flashEdgeKey}
            highlightedEdgeKey={highlightedEdgeKey}
            key={`${edgeKey(edge.from, edge.to, edge.eventType)}#${edge.branchIndex}`}
            observedCount={
              edge.isDynamic
                ? Infinity
                : (observedCounts.get(
                    branchKey(edge.from, edge.eventType, edge.branchIndex),
                  ) ?? 0)
            }
            onLabelClick={onEdgeLabelClick}
          />
        ))}
        {layout.nodes.map((node) => (
          <DiagramNode
            isCurrent={node.id === currentStateType}
            isIgnoredHighlight={node.id === ignoredHighlightState}
            isDragging={
              drag?.kind === "node" && drag.nodeId === node.id
            }
            key={node.id}
            node={node}
            onPointerDown={(event) => onNodePointerDown(node.id, event)}
          />
        ))}
      </svg>
      {popover !== null && popoverEdge !== null && (
        <EdgePopover
          edge={popoverEdge}
          observedCount={popoverCount}
          onClose={() => setPopover(null)}
          x={popover.x}
          y={popover.y}
        />
      )}
    </figure>
  );
}

type DiagramNodeProps = {
  node: { id: string; x: number; y: number; width: number; height: number };
  isCurrent: boolean;
  isIgnoredHighlight: boolean;
  isDragging: boolean;
  onPointerDown: (event: PointerEvent) => void;
};

function DiagramNode({
  node,
  isCurrent,
  isIgnoredHighlight,
  isDragging,
  onPointerDown,
}: DiagramNodeProps) {
  const fill = isCurrent ? "rgb(30 41 59)" : "rgb(15 23 42)";
  const stroke = isIgnoredHighlight
    ? "rgb(248 113 113)"
    : isCurrent
      ? "rgb(96 165 250)"
      : "rgb(51 65 85)";
  const strokeWidth = isCurrent || isIgnoredHighlight ? 2 : 1;
  return (
    <g
      class={isDragging ? "cursor-grabbing" : "cursor-grab"}
      data-node={node.id}
      onPointerDown={onPointerDown}
    >
      <rect
        fill={fill}
        height={node.height}
        rx={6}
        stroke={stroke}
        stroke-width={strokeWidth}
        width={node.width}
        x={node.x}
        y={node.y}
      />
      <text
        class="pointer-events-none fill-slate-100 select-none"
        dominant-baseline="middle"
        font-size="13"
        text-anchor="middle"
        x={node.x + node.width / 2}
        y={node.y + node.height / 2 + 1}
      >
        {node.id}
      </text>
    </g>
  );
}

type DiagramEdgeProps = {
  edge: InspectorLayoutEdge;
  arrowId: string;
  arrowMutedId: string;
  arrowHighlightId: string;
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  observedCount: number;
  onLabelClick: (edge: InspectorLayoutEdge, event: MouseEvent) => void;
};

function DiagramEdge({
  edge,
  arrowId,
  arrowMutedId,
  arrowHighlightId,
  flashEdgeKey,
  highlightedEdgeKey,
  observedCount,
  onLabelClick,
}: DiagramEdgeProps) {
  const key = edgeKey(edge.from, edge.to, edge.eventType);
  const isFlashing = key === flashEdgeKey;
  const isHighlighted = key === highlightedEdgeKey;
  const active = isFlashing || isHighlighted;
  const isUnobserved = !active && !edge.isDynamic && observedCount === 0;
  const strokeColor = active ? "rgb(96 165 250)" : "rgb(100 116 139)";
  const marker = active ? arrowHighlightId : isUnobserved ? arrowMutedId : arrowId;
  const showDiamond = edge.branchTotal > 1;
  const label = formatEdgeLabel(edge);
  const labelWidth = edge.labelWidth;
  const labelHeight = 18;

  return (
    <g
      class={clsx(
        "cursor-pointer",
        isFlashing && "inspector-edge-flash",
      )}
      opacity={isUnobserved ? 0.4 : 1}
    >
      <path
        d={edge.path}
        fill="none"
        marker-end={`url(#${marker})`}
        pointer-events="none"
        stroke={strokeColor}
        stroke-dasharray={edge.isDynamic ? "4 4" : undefined}
        stroke-width={active ? 2 : 1.25}
      />
      <g
        data-edge={key}
        onClick={(event) => onLabelClick(edge, event as unknown as MouseEvent)}
      >
        <rect
          fill="rgb(15 23 42)"
          height={labelHeight}
          rx={9}
          stroke={active ? "rgb(96 165 250)" : "rgb(51 65 85)"}
          stroke-width={1}
          width={labelWidth}
          x={edge.labelX - labelWidth / 2}
          y={edge.labelY - labelHeight / 2}
        />
        {showDiamond && (
          <g
            transform={`translate(${edge.labelX - labelWidth / 2 + 12}, ${edge.labelY}) rotate(45)`}
          >
            <rect
              fill={active ? "rgb(96 165 250)" : "rgb(51 65 85)"}
              height={10}
              width={10}
              x={-5}
              y={-5}
            />
          </g>
        )}
        {showDiamond && (
          <text
            class="pointer-events-none fill-slate-950 select-none"
            dominant-baseline="middle"
            font-size="8"
            font-weight="700"
            text-anchor="middle"
            x={edge.labelX - labelWidth / 2 + 12}
            y={edge.labelY + 1}
          >
            {edge.branchIndex + 1}
          </text>
        )}
        <text
          class={clsx(
            "pointer-events-none select-none",
            active ? "fill-blue-300" : "fill-slate-300",
          )}
          dominant-baseline="middle"
          font-size="11"
          text-anchor="middle"
          x={edge.labelX + (showDiamond ? 9 : 0)}
          y={edge.labelY + 1}
        >
          {label}
        </text>
      </g>
    </g>
  );
}

type EdgePopoverProps = {
  edge: InspectorLayoutEdge;
  x: number;
  y: number;
  observedCount: number | null;
  onClose: () => void;
};

function EdgePopover({
  edge,
  x,
  y,
  observedCount,
  onClose,
}: EdgePopoverProps) {
  return (
    <div
      class="absolute z-10 w-72 rounded-md border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-lg"
      data-inspector-popover
      style={{ left: `${x + 8}px`, top: `${y + 8}px` }}
    >
      <div class="mb-2 flex items-start justify-between gap-2">
        <div class="font-mono text-blue-300">{edge.eventType}</div>
        <button
          aria-label="Close"
          class="text-slate-500 hover:text-slate-200"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>
      <dl class="flex flex-col gap-1.5">
        <PopoverRow label="From">
          <span class="font-mono">{edge.from}</span>
        </PopoverRow>
        <PopoverRow label="To">
          <span class="font-mono">{edge.to}</span>
        </PopoverRow>
        {edge.branchTotal > 1 && (
          <PopoverRow label="Branch">
            {edge.branchIndex + 1} of {edge.branchTotal}
          </PopoverRow>
        )}
        <PopoverRow label="Guards">
          <GuardList guards={edge.guards} />
        </PopoverRow>
        <PopoverRow label="Returns">
          <pre class="max-h-24 overflow-auto rounded bg-slate-950 p-1.5 font-mono text-[11px] text-slate-300">
            {edge.returnSource}
          </pre>
        </PopoverRow>
        {observedCount !== null && (
          <PopoverRow label="Observed">
            {observedCount}
            {observedCount === 1 ? " time" : " times"}
          </PopoverRow>
        )}
        {edge.isDynamic && (
          <div class="mt-1 rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-[11px] text-amber-300">
            Runtime-only edge — the static analyzer did not predict this
            transition.
          </div>
        )}
      </dl>
    </div>
  );
}

type PopoverRowProps = { label: string; children: ComponentChildren };

function PopoverRow({ label, children }: PopoverRowProps) {
  return (
    <div class="flex items-baseline gap-2">
      <dt class="w-16 shrink-0 text-[10px] tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd class="flex-1 min-w-0">{children}</dd>
    </div>
  );
}

function GuardList({ guards }: { guards: GuardCondition[] }) {
  if (guards.length === 0) {
    return <span class="text-slate-500 italic">unconditional</span>;
  }
  return (
    <ul class="flex flex-col gap-0.5">
      {guards.map((guard, index) => (
        <li class="font-mono text-[11px]" key={index}>
          <span
            class={clsx(
              "mr-1 text-[10px] tracking-wide uppercase",
              guard.negated ? "text-amber-400" : "text-emerald-400",
            )}
          >
            {guard.negated ? "NOT" : "IF"}
          </span>
          {guard.source}
        </li>
      ))}
    </ul>
  );
}
