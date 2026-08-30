import { clsx, useId, useMemo } from "../dependencies.js";
import { inspectorLayout } from "../tools/inspector/layout.js";
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
  const layout = useMemo(
    () => inspectorLayout(description, initialStateType, dynamicEdges),
    [description, initialStateType, dynamicEdges],
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
  arrowMutedId: string;
  arrowHighlightId: string;
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  observedCount: number;
};

function DiagramEdge({
  edge,
  arrowId,
  arrowMutedId,
  arrowHighlightId,
  flashEdgeKey,
  highlightedEdgeKey,
  observedCount,
}: DiagramEdgeProps) {
  const key = edgeKey(edge.from, edge.to, edge.eventType);
  const isFlashing = key === flashEdgeKey;
  const isHighlighted = key === highlightedEdgeKey;
  const active = isFlashing || isHighlighted;
  const isUnobserved = !active && !edge.isDynamic && observedCount === 0;
  const strokeColor = active ? "rgb(96 165 250)" : "rgb(100 116 139)";
  const marker = active ? arrowHighlightId : isUnobserved ? arrowMutedId : arrowId;
  const showDiamond = edge.branchTotal > 1;
  const label = formatEdgeLabel(edge.eventType, edge.guards);
  const guardTooltip = formatGuardTooltip(edge.guards);
  const labelWidth = Math.max(28, label.length * 7 + 12 + (showDiamond ? 18 : 0));
  const labelHeight = 18;

  return (
    <g
      class={clsx(
        "cursor-pointer",
        isFlashing && "inspector-edge-flash",
      )}
      opacity={isUnobserved ? 0.4 : 1}
    >
      <title>{guardTooltip}</title>
      <path
        d={edge.path}
        fill="none"
        marker-end={`url(#${marker})`}
        stroke={strokeColor}
        stroke-dasharray={edge.isDynamic ? "4 4" : undefined}
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
          class="fill-slate-950"
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
        class={clsx(active ? "fill-blue-300" : "fill-slate-300")}
        dominant-baseline="middle"
        font-size="11"
        text-anchor="middle"
        x={edge.labelX + (showDiamond ? 9 : 0)}
        y={edge.labelY + 1}
      >
        {label}
      </text>
    </g>
  );
}

function formatEdgeLabel(eventType: string, guards: GuardCondition[]): string {
  if (guards.length === 0) return eventType;
  if (guards.every((g) => g.negated)) return `${eventType} ELSE`;
  const parts = guards.map((g) => (g.negated ? `!(${g.source})` : g.source));
  const joined = parts.join(" ∧ ");
  const truncated = joined.length > 24 ? joined.slice(0, 22) + "…" : joined;
  return `${eventType} IF ${truncated}`;
}

function formatGuardTooltip(guards: GuardCondition[]): string {
  if (guards.length === 0) return "";
  return guards
    .map((g) => (g.negated ? `NOT (${g.source})` : g.source))
    .join(" AND ");
}
