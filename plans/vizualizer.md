# State Machine Visualizer

A Preact `<Inspector>` component that visualizes running `statry` state machines. It statically analyzes handler ASTs to build a full topology (states, transitions, guards), lays each machine out with an in-house Sugiyama algorithm, renders every machine in one interactive orthogonal canvas, and observes runtime events to animate transitions and count edge usage.

Everything lives under `src/client/` for now; when we later promote it to a library, `analyze` / `sugiyama` / `layout` / `useInspector` can move to `lib/` and the presentational shell to a separate package.

Only one dependency was added: **`meriyah`** (~130 KB min) for AST parsing. Layout is entirely in-house — no `elkjs`, no `dagre`.

---

## 1. Structured description of the state machine

`src/client/tools/inspector/analyze.ts`

statry event handlers are opaque functions `(event, state, context) => S`, so there is no static "transitions" declaration to read. Rather than learn transitions by observation (empty diagram until events fire, and guards indistinguishable), we parse each handler's `.toString()` source with meriyah and derive the topology up front.

**Public entry point.** `analyzeDefinition(definition)` iterates every `state → event → handler` triplet and returns:

```ts
MachineDescription    = { states: Record<string, StateDescription> }
StateDescription      = { type, hasEnter, eventTypes, transitions, parseError? }
TransitionDescription = { eventType, branches: TransitionBranch[] }
TransitionBranch      = { kind: "transition" | "self" | "unknown",
                          targetStateType: string | null,
                          guards: GuardCondition[],
                          returnSource: string }
GuardCondition        = { source: string, negated: boolean }
```

Types live in `src/client/tools/inspector/types.ts` alongside the small `edgeKey` / `branchKey` helpers.

**Handler shapes recognised.** Block body with `return`, expression-body arrow, ternary in return, `switch` (each case → a guard), object-literal return (target extracted from the `type` property), identifier return (`return state` → `self`). Everything else is `kind: "unknown"` with `returnSource` preserved for the popover.

**Parsing strategy.** Two wrappers are tried in sequence — `(source)` for arrow / function expressions, `({source})` for method-shorthand — so both syntactic forms are accepted. Bound / native functions detected via `[native code]`. On any parse failure the state gets a `parseError` and its transitions are downgraded to `kind: "unknown"`.

**Deferred cases.** Inlining single-use `const` bindings (e.g. `const target = { type: "on" }; return target`) is not attempted yet; those become `unknown`.

---

## 2. Diagram renderer (single machine)

Turns a `MachineDescription` + initial state + optional node/label overrides into a positioned, styled SVG group. Split into a pure layout pipeline and an SVG-rendering sub-component.

### 2a. Node placement — Sugiyama

`src/client/tools/inspector/sugiyama.ts`

`computeLayeredLayout(states, edges, initialState, options)` implements the classic four-phase Sugiyama algorithm:

1. **Cycle removal.** DFS from the initial state marks back-edges (edges to nodes on the recursion stack); those edges are conceptually reversed so the rest of the pipeline sees a DAG. Keeps the initial state anchored at layer 0.
2. **Layer assignment.** Longest-path layering: each node's layer is `1 + max(layer of DAG predecessors)`. Truly isolated states get pinned to a rightmost layer so they don't crowd the initial column.
3. **Long-edge subdivision.** Edges spanning more than one layer get a chain of dummy nodes at intermediate layers; dummies exist only to steer the crossing-minimization step.
4. **Barycenter sweep for crossing minimization.** Alternating forward/backward passes reorder each layer by the average position of its neighbors in the adjacent layer. Runs up to 24 sweeps, early-exits when no change.

Coordinates come from a `layer × step` grid; the `direction` option (`"right"` or `"down"`) swaps the primary and secondary axes.

### 2b. Edge routing and label placement

`src/client/tools/inspector/layout.ts`

`inspectorLayout(description, initialState, dynamicEdges, overrides)` glues Sugiyama to the routing:

1. Extract simple transition edges from the description (skip self-loops and non-`transition` branches).
2. Ask `computeLayeredLayout` for node positions.
3. Apply user `overrides` (dragged node positions) on top.
4. Route edges one at a time, accumulating a `placedLabelRects` list so subsequent edges treat prior labels as obstacles.
5. Compute content bounds (union of all node rects, edge waypoints, and label pills) and return the full `InspectorLayoutResult`.

**Routing dispatch.** `routeEdge` picks the axis by comparing source and target centres:

- `|dx| >= |dy|` → `routeHorizontal(forward)`: source dock at right-mid (or left-mid if backward), target dock at left-mid (or right-mid). Labels are horizontal pass-through pills; parallel-edge labels fan out **vertically**.
- otherwise → `routeVertical(downward)`: source dock at bottom-mid (or top-mid), target dock at top-mid (or bottom-mid). Labels fan out **horizontally**.

Every edge becomes a 6-waypoint stair `source dock → label near-side → label centre → label far-side → target near-side → target dock`. `simplifyWaypoints` collapses it to a straight line when the label sits on the direct path, or leaves it as a stair when the label is offset. `orthogonalPath` emits the SVG `d` string with quadratic-Bézier corners of radius 8 at each interior waypoint.

**Collision resolution.** `pushRectOutOfObstacles(rect, obstacles, preferredAxis)` iteratively pushes a rect out of overlapping obstacles along the caller's preferred axis (or the shortest escape direction). Two public wrappers:

- `clampLabelOutOfObstacles` — center-based coords for label pills, default preferred axis `"vertical"`.
- `clampNodeOutOfObstacles` — top-left coords, preferred axis `"shortest"` so a dragged node slides against its blocker.

The auto-router calls the label wrapper on the natural label position before baking waypoints, passing both **state boxes and previously-placed label rects** as obstacles — so labels never overlap nodes nor each other in the initial layout.

### 2c. SVG rendering per machine

`MachineGroup` (defined inside `InspectorCanvas.tsx`, since only the canvas instantiates it).

Renders one `<g>` containing a frame rect, a title, then the nodes and edges inside a nested content group translated by `contentOffset` (derived from a baseline no-overrides layout so drag mapping is exactly 1:1).

- **Nodes**: rounded slate rectangles inside `<g data-node={id}>`. Current state gets a brighter blue border; a state receiving an `ignoredevent` briefly gets a red border.
- **Edges**: `<path>` with an arrowhead `<marker>`, then a label group `<g data-edge={key}>`. Unobserved edges render at 40 % opacity, observed at 100 %. On `statetransition` the edge briefly pulses via the `inspector-edge-flash` CSS keyframe (600 ms).
- **Label pills**: rounded rect with text inside; multi-branch handlers on the same event show a numbered diamond before the text (`1 emergency IF cond`, `2 emergency ELSE`). Dynamic edges (observed but not statically predicted) render with a dashed stroke.
- **Frame**: sized as `union(baseline frame, effective content bounds + padding)` so it always encompasses dragged content without ever shrinking below its baseline.

Clicking an edge-label group opens the popover; that popover is owned by the canvas (section 4) since it's an HTML overlay outside the SVG.

---

## 3. Event log

`src/client/components/InspectorEventTable.tsx`

Takes a `RuntimeEvent[]` and the `machines` list and renders an expandable table.

- **Columns.** `▸/▾` · `Type` · `Prev` · `Next` · `Machine` (hidden when only one machine) · `Time`. The rendering of `Prev` / `Next` switches on `event.type`:
  - `statetransition`: prev = `previousState.type`, next = `state.type`.
  - `selftransition`: prev = next = `state.type` with a subtle "self" indicator.
  - `ignoredevent`: prev = `state.type`, next = `—`, row muted/italic with red `(ignored)` marker.
  - `dispose`: type = `"dispose"`, prev = `previousState.type`, next = `—`, no payload.
- **Machine column** looks up `event.target` in the `machines` array by identity.
- **Row click** toggles a detail panel showing kind, machine name, ms-precision timestamp, and pretty-printed JSON for trigger + previous / next state.
- **Row hover** calls `onSelectEvent(event)` so the parent can highlight the corresponding edge in the diagram. `ignoredevent` produces no edge — the parent outlines the current state box in red instead.
- Newest events on top. React keys use the array index (append-only, never mutated).

---

## 4. Canvas with pan and zoom

`src/client/components/InspectorCanvas.tsx`

Takes `{ machines, views, resolveHighlight }` and renders **one** SVG containing every visible machine, plus a floating HTML overlay for edge popovers and a floating zoom/reset control group.

### Machine placement inside the canvas

Machines are laid out in a **wrapping row** — each machine gets a baseline frame from its own `inspectorLayout` call, packed left-to-right until a target row width is exceeded, then wrapped to the next row. `computeCanvasBounds` unions the baseline frames to produce the initial `viewBox`; individual machine `frame` rects still grow to encompass dragged content, but the canvas viewport doesn't reshape during interaction.

Machine positions are stable across drags because they use the baseline (no-override) layout — only the machine's own frame + node/edge/label positions react to user overrides.

### Pan / zoom / drag interactions

All interaction state lives here:

```ts
overrides         Map<`machine::state`, {x,y}>       node position overrides (top-left)
labelOverrides    Map<`machine::edge#branch`, {x,y}> label position overrides (center)
machineOffsets    Map<machineName, {x,y}>            per-machine frame translation
viewBox           ViewBox | null                     current pan/zoom viewport
drag              DragState | null                   active drag (node / label / pan / machine)
popover           PopoverState | null                open edge popover (screen coords)
```

A single `useEffect` on `drag` attaches `pointermove` / `pointerup` handlers to the window; the branch inside dispatches on `drag.kind`:

- **Node drag.** Proposed position clamped by `clampNodeOutOfObstacles` against sibling state boxes + all routed labels in that machine. On mouseup, `labelOverrides` for edges incident to the moved state are dropped so those labels snap back to the fresh auto-layout (otherwise they'd dangle at their old positions).
- **Label drag.** Threshold-based click-vs-drag (< 5 px → click, opens the popover; > 5 px → drag). Proposed position clamped by `clampLabelOutOfObstacles` against nodes + every other label pill in the same machine.
- **Machine drag** (empty area of the frame or the title): moves the whole machine via `machineOffsets`; nodes and labels ride along.
- **Pan** (empty area of the canvas): shifts the SVG `viewBox`.

Scale is derived from `svg.getScreenCTM()` — `1 / ctm.a` and `1 / ctm.d` — so the 1:1 mapping between mouse and world coordinates survives `preserveAspectRatio="xMidYMid meet"` letterboxing. **Mouse-wheel zoom** anchors to the cursor via `SVGSVGElement.createSVGPoint` + inverse CTM; **`+` / `−` buttons** anchor to the centre. **Reset view** clears all override maps and restores the viewBox to the baseline content bounds.

### Edge popover

HTML overlay positioned relative to the canvas container (kept out of the SVG so it doesn't scale with zoom). Shows the machine name, event type, from / to, branch index when part of a multi-branch handler, guards (IF / NOT badges), the raw `returnSource`, and the observed count. Closes on outside click, on pan, on zoom, or on the `✕` button.

---

## 5. Top-level: canvas + logs + filters

`src/client/components/Inspector.tsx`

Wires everything together:

```jsx
<section>
  <FilterBar ... />               // machine chips + "show ignored" toggle
  <InspectorCanvas
    machines={visibleMachines}
    views={views}
    resolveHighlight={fn}         // event → { edgeKey, ignoredState } per machine
  />
  <InspectorEventTable
    events={filteredEvents}
    machines={machines}
    selectedEvent={selectedEvent}
    onSelectEvent={setSelectedEvent}
  />
</section>
```

**Filter bar.** Per-machine visibility chips and a "show ignored events" toggle. Hiding a machine simply removes it from the canvas layout and from the event table filter.

**Event → highlight bridge.** `resolveHighlight(machine)` inspects the currently selected `RuntimeEvent` and, if it targets this machine, resolves it to a `{ edgeKey, ignoredState }` pair. `statetransition` and `selftransition` produce an `edgeKey`; `ignoredevent` produces an `ignoredState` (state gets a red outline briefly). `dispose` produces neither.

### The observation hook — `useInspector`

`src/client/tools/inspector/useInspector.ts`

The bridge between running machines and the components. Per entry `{ name, machine }`:

1. Run `analyzeDefinition(machine.definition)` once (cached in a ref) → `MachineDescription`.
2. Subscribe to `statetransition`, `selftransition`, `ignoredevent`, `dispose` on `machine`.
3. Maintain a per-machine `MachineView`:

   ```ts
   MachineView = { description, currentStateType, initialStateType,
                   observedCounts: Map<branchKey, number>,
                   dynamicEdges: InspectorLearnedEdge[],
                   flashEdgeKey: string | null }
   ```

4. On `statetransition`, find matching branch(es) by `(from, eventType, to)`. If found, bump their `observedCount` and set `flashEdgeKey` for the 600 ms pulse. If none match (analyzer missed it), append to `dynamicEdges` — rendered as dashed lines so the drift is visible.

Every raw `RuntimeEvent` also lands in a shared `events` list used by the event table.

---

## Demo setup

`src/client/App.tsx` instantiates four demo machines — `drag`, `connection`, `heartbeat`, `traffic` — and exposes them on `window.__machines__` for manual driving from the browser console. Below the diagram, a strip of buttons dispatches the interesting events (`drag.mousedown`, `traffic.emergency(fire)`, etc.) so the demo can be exercised without opening devtools.

`src/client/main.css` sets the dark canvas background and defines the `inspector-edge-flash` keyframe. `src/client/components.ts` and `src/client/tools.ts` are auto-generated by `vite-plugin-module-list` — no manual edits.

---

## Verification

1. `npm test` — every phase has its own tests (`analyze.test.ts`, `sugiyama.test.ts`, `layout.test.ts`). Should be green.
2. `npm run dev`, open the printed URL. All four demo machines should render immediately with their full topology, initial state highlighted, guards visible on the heartbeat and traffic `emergency` branches.
3. Drive events via the demo buttons or from the console (`window.__machines__.drag.send({ type: "mousedown" })`). Verify:
   - Current-state highlight moves.
   - Edge flashes for 600 ms.
   - Event row appears with correct Prev / Next; ignored events surface as a red-outlined row.
   - Observed count updates (edge goes from 40 % to 100 % opacity).
4. Interactive checks — drag a node, drag a label, drag a machine frame, mouse-wheel zoom, `+` / `−` buttons, `Reset view`. In every case:
   - No box (state box or label pill) overlaps another box.
   - Mouse moves 1:1 with the dragged element.
   - Popover opens on edge-label click and closes on outside click / pan / zoom.
5. Headless verification via Chrome DevTools Protocol has been the primary way of asserting behaviour after each iteration — it reads `d` path strings, rect attributes, and popover text to verify docking, overlap-freedom, and 1:1 drag mapping.

## Deferred / future work

- **Compound (nested) states.** statry doesn't support them yet — analyzer + layout would need extension first.
- **Inlining single-use `const` bindings inside a handler** so `const target = { type: "on" }; return target` resolves to `on` instead of `unknown`.
- **`dynamicEdges` warning banner.** Currently silent + dashed edge only.
- **Async layout via Web Worker.** Only needed if a machine grows beyond ~100 nodes; sync path is fine for the demo.
- **Interactive event sending from the diagram** — click an edge to fire its event. A natural next step but out of scope so far.
