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
  type AnyStateMachine,
  type GuardCondition,
  type InspectorLayoutEdge,
  type InspectorLayoutResult,
  type InspectorMachineEntry,
} from "../tools/inspector/types.js";
import type { InspectorMachineView } from "../tools/inspector/useInspector.js";

const FRAME_PADDING = 20;
const TITLE_HEIGHT = 26;
const MACHINE_GAP = 48;
const ROW_GAP = 72;
const TARGET_ROW_WIDTH = 1100;
const CANVAS_PADDING = 24;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
const LABEL_DRAG_THRESHOLD_SQ = 25;

export type InspectorCanvasProps = {
  machines: InspectorMachineEntry[];
  views: Map<AnyStateMachine, InspectorMachineView>;
  resolveHighlight: (
    machine: AnyStateMachine,
  ) => { edgeKey: string | null; ignoredState: string | null };
};

type ViewBox = { minX: number; minY: number; width: number; height: number };

type NodeOverrideKey = string;

type PositionedMachine = {
  entry: InspectorMachineEntry;
  view: InspectorMachineView;
  layout: InspectorLayoutResult;
  offset: { x: number; y: number };
  frame: { x: number; y: number; width: number; height: number };
};

type NodeDrag = {
  kind: "node";
  overrideKey: NodeOverrideKey;
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
  initialMinX: number;
  initialMinY: number;
  scaleX: number;
  scaleY: number;
};

type LabelDrag = {
  kind: "label";
  overrideKey: string;
  startClientX: number;
  startClientY: number;
  initialX: number;
  initialY: number;
  scaleX: number;
  scaleY: number;
  onClickIfNotMoved: () => void;
};

type DragState = NodeDrag | PanDrag | LabelDrag;

type PopoverState = {
  key: string;
  machineName: string;
  x: number;
  y: number;
};

function overrideKeyOf(machineName: string, stateType: string): NodeOverrideKey {
  return `${machineName}::${stateType}`;
}

function labelOverrideKey(
  machineName: string,
  edge: InspectorLayoutEdge,
): string {
  return `${machineName}::${edgeKey(edge.from, edge.to, edge.eventType)}#${edge.branchIndex}`;
}

export function InspectorCanvas({
  machines,
  views,
  resolveHighlight,
}: InspectorCanvasProps) {
  const arrowId = useId();
  const arrowHighlightId = useId();
  const arrowMutedId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [overrides, setOverrides] = useState<Map<NodeOverrideKey, { x: number; y: number }>>(
    () => new Map(),
  );
  const [labelOverrides, setLabelOverrides] = useState<
    Map<string, { x: number; y: number }>
  >(() => new Map());
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const positioned = useMemo(
    () => layoutAllMachines(machines, views, overrides),
    [machines, views, overrides],
  );
  const contentBounds = useMemo(
    () => computeCanvasBounds(positioned),
    [positioned],
  );

  const machineKey = machines.map((m) => m.name).join("|");
  useEffect(() => {
    setViewBox(boundsToViewBox(contentBounds));
    setPopover(null);
    setOverrides(new Map());
    setLabelOverrides(new Map());
    // Only reset when the set of machines changes, not on every override tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineKey]);

  useEffect(() => {
    if (drag === null) return undefined;
    let hasMoved = false;
    const onMove = (event: PointerEvent) => {
      const screenDx = event.clientX - drag.startClientX;
      const screenDy = event.clientY - drag.startClientY;
      const dx = screenDx * drag.scaleX;
      const dy = screenDy * drag.scaleY;
      if (drag.kind === "node") {
        hasMoved = true;
        setOverrides((previous) => {
          const next = new Map(previous);
          next.set(drag.overrideKey, {
            x: drag.initialX + dx,
            y: drag.initialY + dy,
          });
          return next;
        });
        return;
      }
      if (drag.kind === "pan") {
        hasMoved = true;
        setViewBox((previous) => {
          if (previous === null) return previous;
          return {
            ...previous,
            minX: drag.initialMinX - dx,
            minY: drag.initialMinY - dy,
          };
        });
        return;
      }
      // Label drag with click-vs-drag threshold.
      if (
        !hasMoved &&
        screenDx * screenDx + screenDy * screenDy < LABEL_DRAG_THRESHOLD_SQ
      ) {
        return;
      }
      hasMoved = true;
      setLabelOverrides((previous) => {
        const next = new Map(previous);
        next.set(drag.overrideKey, {
          x: drag.initialX + dx,
          y: drag.initialY + dy,
        });
        return next;
      });
    };
    const onUp = () => {
      if (drag.kind === "label" && !hasMoved) {
        drag.onClickIfNotMoved();
      }
      setDrag(null);
    };
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
    const onDown = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-inspector-popover]") !== null
      ) {
        return;
      }
      setPopover(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [popover]);

  function getScale(): { scaleX: number; scaleY: number } {
    const svg = svgRef.current;
    if (svg === null) return { scaleX: 1, scaleY: 1 };
    const ctm = svg.getScreenCTM();
    if (ctm === null || ctm.a === 0 || ctm.d === 0) {
      return { scaleX: 1, scaleY: 1 };
    }
    return { scaleX: 1 / ctm.a, scaleY: 1 / ctm.d };
  }

  function clientToWorld(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (svg === null) return null;
    const ctm = svg.getScreenCTM();
    if (ctm === null) return null;
    const inverse = ctm.inverse();
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const world = point.matrixTransform(inverse);
    return { x: world.x, y: world.y };
  }

  const applyZoom = (
    factor: number,
    anchorClientX?: number,
    anchorClientY?: number,
  ) => {
    setViewBox((previous) => {
      if (previous === null) return previous;
      const currentScale = contentBounds.width / previous.width;
      const nextScale = clamp(currentScale * factor, MIN_ZOOM, MAX_ZOOM);
      const effectiveFactor = currentScale / nextScale;
      const newWidth = previous.width * effectiveFactor;
      const newHeight = previous.height * effectiveFactor;
      const svg = svgRef.current;
      let anchorWorld: { x: number; y: number };
      let localFraction: { x: number; y: number };
      if (
        svg !== null &&
        anchorClientX !== undefined &&
        anchorClientY !== undefined
      ) {
        const world = clientToWorld(anchorClientX, anchorClientY);
        if (world === null) {
          anchorWorld = {
            x: previous.minX + previous.width / 2,
            y: previous.minY + previous.height / 2,
          };
          localFraction = { x: 0.5, y: 0.5 };
        } else {
          anchorWorld = world;
          localFraction = {
            x: (world.x - previous.minX) / previous.width,
            y: (world.y - previous.minY) / previous.height,
          };
        }
      } else {
        anchorWorld = {
          x: previous.minX + previous.width / 2,
          y: previous.minY + previous.height / 2,
        };
        localFraction = { x: 0.5, y: 0.5 };
      }
      return {
        height: newHeight,
        minX: anchorWorld.x - localFraction.x * newWidth,
        minY: anchorWorld.y - localFraction.y * newHeight,
        width: newWidth,
      };
    });
    setPopover(null);
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    applyZoom(factor, event.clientX, event.clientY);
  };

  const onCanvasPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (
      event.target instanceof Element &&
      (event.target.closest("[data-node]") !== null ||
        event.target.closest("[data-edge]") !== null)
    ) {
      return;
    }
    if (viewBox === null) return;
    event.preventDefault();
    const { scaleX, scaleY } = getScale();
    setDrag({
      initialMinX: viewBox.minX,
      initialMinY: viewBox.minY,
      kind: "pan",
      scaleX,
      scaleY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    setPopover(null);
  };

  const onNodePointerDown = (
    machineName: string,
    node: { id: string; x: number; y: number },
    event: PointerEvent,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const { scaleX, scaleY } = getScale();
    setDrag({
      initialX: node.x,
      initialY: node.y,
      kind: "node",
      overrideKey: overrideKeyOf(machineName, node.id),
      scaleX,
      scaleY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    });
    setPopover(null);
  };

  const openPopover = (
    machineName: string,
    edge: InspectorLayoutEdge,
    clientX: number,
    clientY: number,
  ) => {
    const container = containerRef.current;
    if (container === null) return;
    const rect = container.getBoundingClientRect();
    const key = `${machineName}::${edgeKey(edge.from, edge.to, edge.eventType)}#${edge.branchIndex}`;
    if (popover !== null && popover.key === key) {
      setPopover(null);
      return;
    }
    setPopover({
      key,
      machineName,
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  };

  const onLabelPointerDown = (
    machineName: string,
    edge: InspectorLayoutEdge,
    event: PointerEvent,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const key = labelOverrideKey(machineName, edge);
    const existing = labelOverrides.get(key);
    const initialX = existing?.x ?? edge.labelX;
    const initialY = existing?.y ?? edge.labelY;
    const { scaleX, scaleY } = getScale();
    const clickX = event.clientX;
    const clickY = event.clientY;
    setDrag({
      initialX,
      initialY,
      kind: "label",
      onClickIfNotMoved: () => openPopover(machineName, edge, clickX, clickY),
      overrideKey: key,
      scaleX,
      scaleY,
      startClientX: clickX,
      startClientY: clickY,
    });
  };

  const resetView = () => {
    setOverrides(new Map());
    setLabelOverrides(new Map());
    setViewBox(boundsToViewBox(contentBounds));
    setPopover(null);
  };

  const hasCustomView =
    overrides.size > 0 ||
    labelOverrides.size > 0 ||
    (viewBox !== null && !viewBoxEqualsBounds(viewBox, contentBounds));

  const cursorClass = drag?.kind === "pan" ? "cursor-grabbing" : "cursor-grab";

  const popoverInfo = useMemo(() => {
    if (popover === null) return null;
    for (const pm of positioned) {
      if (pm.entry.name !== popover.machineName) continue;
      for (const edge of pm.layout.edges) {
        const key = `${pm.entry.name}::${edgeKey(edge.from, edge.to, edge.eventType)}#${edge.branchIndex}`;
        if (key !== popover.key) continue;
        const observedCount = edge.isDynamic
          ? null
          : pm.view.observedCounts.get(
              branchKey(edge.from, edge.eventType, edge.branchIndex),
            ) ?? 0;
        return { edge, machineName: pm.entry.name, observedCount };
      }
    }
    return null;
  }, [popover, positioned]);

  const viewBoxString =
    viewBox === null
      ? `${contentBounds.minX} ${contentBounds.minY} ${contentBounds.width} ${contentBounds.height}`
      : `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`;

  return (
    <div
      class="relative h-[60vh] w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950"
      ref={containerRef}
    >
      <svg
        class={clsx(
          "block h-full w-full touch-none text-slate-200",
          cursorClass,
        )}
        onPointerDown={onCanvasPointerDown}
        onWheel={onWheel}
        preserveAspectRatio="xMidYMid meet"
        ref={svgRef}
        viewBox={viewBoxString}
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
        {positioned.map((pm) => {
          const highlight = resolveHighlight(pm.entry.machine);
          return (
            <MachineGroup
              arrowHighlightId={arrowHighlightId}
              arrowId={arrowId}
              arrowMutedId={arrowMutedId}
              flashEdgeKey={pm.view.flashEdgeKey}
              highlightedEdgeKey={highlight.edgeKey}
              ignoredHighlightState={highlight.ignoredState}
              key={pm.entry.name}
              labelOverrides={labelOverrides}
              observedCounts={pm.view.observedCounts}
              onLabelPointerDown={(edge, event) =>
                onLabelPointerDown(pm.entry.name, edge, event)
              }
              onNodePointerDown={(node, event) =>
                onNodePointerDown(pm.entry.name, node, event)
              }
              positioned={pm}
              draggingOverrideKey={
                drag?.kind === "node" ? drag.overrideKey : null
              }
              currentStateType={pm.view.currentStateType}
            />
          );
        })}
      </svg>
      <div class="pointer-events-none absolute inset-0 flex flex-col items-end gap-1 p-3">
        <div class="pointer-events-auto flex flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-900/90 backdrop-blur">
          <ZoomButton label="+" onClick={() => applyZoom(ZOOM_STEP)} />
          <ZoomButton label="−" onClick={() => applyZoom(1 / ZOOM_STEP)} />
        </div>
        {hasCustomView && (
          <button
            class="pointer-events-auto rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-[10px] tracking-wide text-slate-400 uppercase backdrop-blur hover:border-blue-500 hover:text-blue-300"
            onClick={resetView}
            type="button"
          >
            Reset view
          </button>
        )}
      </div>
      {popover !== null && popoverInfo !== null && (
        <EdgePopover
          edge={popoverInfo.edge}
          observedCount={popoverInfo.observedCount}
          onClose={() => setPopover(null)}
          machineName={popoverInfo.machineName}
          x={popover.x}
          y={popover.y}
        />
      )}
    </div>
  );
}

type MachineGroupProps = {
  positioned: PositionedMachine;
  currentStateType: string;
  observedCounts: Map<string, number>;
  flashEdgeKey: string | null;
  highlightedEdgeKey: string | null;
  ignoredHighlightState: string | null;
  arrowId: string;
  arrowMutedId: string;
  arrowHighlightId: string;
  draggingOverrideKey: NodeOverrideKey | null;
  labelOverrides: Map<string, { x: number; y: number }>;
  onNodePointerDown: (
    node: { id: string; x: number; y: number },
    event: PointerEvent,
  ) => void;
  onLabelPointerDown: (
    edge: InspectorLayoutEdge,
    event: PointerEvent,
  ) => void;
};

function MachineGroup({
  positioned,
  currentStateType,
  observedCounts,
  flashEdgeKey,
  highlightedEdgeKey,
  ignoredHighlightState,
  arrowId,
  arrowMutedId,
  arrowHighlightId,
  draggingOverrideKey,
  labelOverrides,
  onNodePointerDown,
  onLabelPointerDown,
}: MachineGroupProps) {
  const { entry, layout, offset, frame } = positioned;

  return (
    <g>
      <rect
        fill="rgb(2 6 23 / 0.6)"
        height={frame.height}
        rx={10}
        stroke="rgb(30 41 59)"
        stroke-width={1}
        width={frame.width}
        x={frame.x}
        y={frame.y}
      />
      <text
        class="pointer-events-none fill-slate-500 select-none"
        font-size="11"
        font-weight="600"
        letter-spacing="0.08em"
        x={frame.x + 12}
        y={frame.y + 16}
      >
        {entry.name.toUpperCase()}
      </text>
      <g transform={`translate(${offset.x}, ${offset.y})`}>
        {layout.edges.map((edge) => {
          const overrideKeyStr = labelOverrideKey(entry.name, edge);
          const labelPosition = labelOverrides.get(overrideKeyStr);
          const renderedEdge =
            labelPosition === undefined
              ? edge
              : {
                  ...edge,
                  labelX: labelPosition.x,
                  labelY: labelPosition.y,
                };
          return (
            <DiagramEdge
              arrowHighlightId={arrowHighlightId}
              arrowId={arrowId}
              arrowMutedId={arrowMutedId}
              edge={renderedEdge}
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
              onLabelPointerDown={onLabelPointerDown}
            />
          );
        })}
        {layout.nodes.map((node) => (
          <DiagramNode
            isCurrent={node.id === currentStateType}
            isIgnoredHighlight={node.id === ignoredHighlightState}
            isDragging={
              draggingOverrideKey === overrideKeyOf(entry.name, node.id)
            }
            key={node.id}
            node={node}
            onPointerDown={(event) => onNodePointerDown(node, event)}
          />
        ))}
      </g>
    </g>
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
  onLabelPointerDown: (
    edge: InspectorLayoutEdge,
    event: PointerEvent,
  ) => void;
};

function DiagramEdge({
  edge,
  arrowId,
  arrowMutedId,
  arrowHighlightId,
  flashEdgeKey,
  highlightedEdgeKey,
  observedCount,
  onLabelPointerDown,
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
      class={clsx("cursor-pointer", isFlashing && "inspector-edge-flash")}
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
        class="cursor-grab"
        data-edge={key}
        onPointerDown={(event) =>
          onLabelPointerDown(edge, event as unknown as PointerEvent)
        }
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

type ZoomButtonProps = { label: string; onClick: () => void };

function ZoomButton({ label, onClick }: ZoomButtonProps) {
  return (
    <button
      class="border-b border-slate-700 px-2 py-1 text-sm text-slate-300 last:border-b-0 hover:bg-slate-800 hover:text-blue-300"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

type EdgePopoverProps = {
  edge: InspectorLayoutEdge;
  machineName: string;
  x: number;
  y: number;
  observedCount: number | null;
  onClose: () => void;
};

function EdgePopover({
  edge,
  machineName,
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
        <div class="flex flex-col">
          <span class="text-[10px] tracking-wide text-slate-500 uppercase">
            {machineName}
          </span>
          <span class="font-mono text-blue-300">{edge.eventType}</span>
        </div>
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
      <dd class="min-w-0 flex-1">{children}</dd>
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

function layoutAllMachines(
  machines: InspectorMachineEntry[],
  views: Map<AnyStateMachine, InspectorMachineView>,
  overrides: Map<NodeOverrideKey, { x: number; y: number }>,
): PositionedMachine[] {
  const laidOut: {
    entry: InspectorMachineEntry;
    view: InspectorMachineView;
    baseline: InspectorLayoutResult;
    live: InspectorLayoutResult;
  }[] = [];

  for (const entry of machines) {
    const view = views.get(entry.machine);
    if (view === undefined) continue;
    const machineOverrides = new Map<string, { x: number; y: number }>();
    for (const [key, pos] of overrides) {
      const [name, state] = key.split("::");
      if (name === entry.name && state !== undefined) {
        machineOverrides.set(state, pos);
      }
    }
    // Baseline layout (without overrides) fixes the frame position and content
    // offset, so dragging a node cannot shift the whole machine and break the
    // 1:1 mapping between mouse motion and screen motion.
    const baseline = inspectorLayout(
      view.description,
      view.initialStateType,
      view.dynamicEdges,
    );
    const live =
      machineOverrides.size === 0
        ? baseline
        : inspectorLayout(
            view.description,
            view.initialStateType,
            view.dynamicEdges,
            machineOverrides,
          );
    laidOut.push({ baseline, entry, live, view });
  }

  return positionMachines(laidOut);
}

function positionMachines(
  laidOut: {
    entry: InspectorMachineEntry;
    view: InspectorMachineView;
    baseline: InspectorLayoutResult;
    live: InspectorLayoutResult;
  }[],
): PositionedMachine[] {
  const result: PositionedMachine[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;
  for (const item of laidOut) {
    const frameWidth = item.baseline.width + FRAME_PADDING * 2;
    const frameHeight =
      item.baseline.height + FRAME_PADDING * 2 + TITLE_HEIGHT;
    if (currentX > 0 && currentX + frameWidth > TARGET_ROW_WIDTH) {
      currentX = 0;
      currentY += rowHeight + ROW_GAP;
      rowHeight = 0;
    }
    const frameX = currentX;
    const frameY = currentY;
    const contentOffsetX = frameX + FRAME_PADDING - item.baseline.minX;
    const contentOffsetY =
      frameY + TITLE_HEIGHT + FRAME_PADDING - item.baseline.minY;
    result.push({
      entry: item.entry,
      frame: {
        height: frameHeight,
        width: frameWidth,
        x: frameX,
        y: frameY,
      },
      layout: item.live,
      offset: { x: contentOffsetX, y: contentOffsetY },
      view: item.view,
    });
    currentX += frameWidth + MACHINE_GAP;
    if (frameHeight > rowHeight) rowHeight = frameHeight;
  }
  return result;
}

function computeCanvasBounds(machines: PositionedMachine[]): ViewBox {
  if (machines.length === 0) {
    return { height: 400, minX: 0, minY: 0, width: 800 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const pm of machines) {
    if (pm.frame.x < minX) minX = pm.frame.x;
    if (pm.frame.y < minY) minY = pm.frame.y;
    if (pm.frame.x + pm.frame.width > maxX) maxX = pm.frame.x + pm.frame.width;
    if (pm.frame.y + pm.frame.height > maxY) maxY = pm.frame.y + pm.frame.height;
  }
  return {
    height: maxY - minY + CANVAS_PADDING * 2,
    minX: minX - CANVAS_PADDING,
    minY: minY - CANVAS_PADDING,
    width: maxX - minX + CANVAS_PADDING * 2,
  };
}

function boundsToViewBox(bounds: ViewBox): ViewBox {
  return {
    height: bounds.height,
    minX: bounds.minX,
    minY: bounds.minY,
    width: bounds.width,
  };
}

function viewBoxEqualsBounds(vb: ViewBox, bounds: ViewBox): boolean {
  const epsilon = 0.5;
  return (
    Math.abs(vb.minX - bounds.minX) < epsilon &&
    Math.abs(vb.minY - bounds.minY) < epsilon &&
    Math.abs(vb.width - bounds.width) < epsilon &&
    Math.abs(vb.height - bounds.height) < epsilon
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
