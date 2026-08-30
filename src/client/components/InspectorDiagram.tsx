import { clsx, useId, useMemo } from "../dependencies.js";
import { inspectorLayout } from "../tools/inspector/layout.js";
import {
  edgeKey,
  type InspectorLearnedEdge,
  type InspectorLayoutEdge,
} from "../tools/inspector/types.js";

export type InspectorDiagramProps = {
  name: string;
  states: string[];
  edges: InspectorLearnedEdge[];
  initialStateType: string;
  currentStateType: string;
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  ignoredHighlightState: string | null;
  onHoverEdge?: (key: string | null) => void;
};

export function InspectorDiagram({
  name,
  states,
  edges,
  initialStateType,
  currentStateType,
  flashEdgeKey,
  highlightedEdgeKey,
  ignoredHighlightState,
  onHoverEdge,
}: InspectorDiagramProps) {
  const arrowId = useId();
  const arrowHighlightId = useId();
  const layout = useMemo(
    () => inspectorLayout(states, edges, initialStateType),
    [states, edges, initialStateType],
  );

  return (
    <figure class="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950 p-3">
      <figcaption class="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {name}
      </figcaption>
      <svg
        class="block h-auto w-full text-slate-200"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
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
            edge={edge}
            flashEdgeKey={flashEdgeKey}
            highlightedEdgeKey={highlightedEdgeKey}
            key={edgeKey(edge.from, edge.to, edge.eventType)}
            onHoverEdge={onHoverEdge}
          />
        ))}
        {layout.nodes.map((node) => (
          <DiagramNode
            isCurrent={node.id === currentStateType}
            isIgnoredHighlight={node.id === ignoredHighlightState}
            key={node.id}
            node={node}
          />
        ))}
      </svg>
    </figure>
  );
}

type DiagramNodeProps = {
  node: { id: string; x: number; y: number; width: number; height: number };
  isCurrent: boolean;
  isIgnoredHighlight: boolean;
};

function DiagramNode({ node, isCurrent, isIgnoredHighlight }: DiagramNodeProps) {
  const fill = isCurrent ? "rgb(30 41 59)" : "rgb(15 23 42)";
  const stroke = isIgnoredHighlight
    ? "rgb(248 113 113)"
    : isCurrent
      ? "rgb(96 165 250)"
      : "rgb(51 65 85)";
  const strokeWidth = isCurrent || isIgnoredHighlight ? 2 : 1;
  return (
    <g>
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
        class="fill-slate-100"
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
  arrowHighlightId: string;
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  onHoverEdge?: (key: string | null) => void;
};

function DiagramEdge({
  edge,
  arrowId,
  arrowHighlightId,
  flashEdgeKey,
  highlightedEdgeKey,
  onHoverEdge,
}: DiagramEdgeProps) {
  const key = edgeKey(edge.from, edge.to, edge.eventType);
  const isFlashing = key === flashEdgeKey;
  const isHighlighted = key === highlightedEdgeKey;
  const active = isFlashing || isHighlighted;
  const strokeColor = active ? "rgb(96 165 250)" : "rgb(100 116 139)";
  const marker = active ? arrowHighlightId : arrowId;
  const labelWidth = Math.max(28, edge.eventType.length * 7 + 12);
  const labelHeight = 18;

  return (
    <g
      class={clsx(
        "cursor-pointer",
        isFlashing && "inspector-edge-flash",
      )}
      onMouseEnter={onHoverEdge ? () => onHoverEdge(key) : undefined}
      onMouseLeave={onHoverEdge ? () => onHoverEdge(null) : undefined}
    >
      <path
        d={edge.path}
        fill="none"
        marker-end={`url(#${marker})`}
        stroke={strokeColor}
        stroke-width={active ? 2 : 1.25}
      />
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
      <text
        class={clsx(
          active ? "fill-blue-300" : "fill-slate-300",
        )}
        dominant-baseline="middle"
        font-size="11"
        text-anchor="middle"
        x={edge.labelX}
        y={edge.labelY + 1}
      >
        {edge.eventType}
      </text>
    </g>
  );
}
