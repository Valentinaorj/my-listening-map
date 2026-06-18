# My Listening Map — Network Interaction System Session Log

*Documents all decisions and changes made in this session. Continues from session_log_network_collapse.md, which documented the two-level collapsed/expanded architecture. This session focused exclusively on interaction behavior, visual feedback, and the expand mechanics.*

---

## What This Session Built

The previous session established the collapsed/expanded architecture. This session made it actually usable:

- Group expand: children replace the parent in the simulation, with correct edge routing and physics
- Eponymous child detection: groups like `cumbia` (where the group label matches a real genre node) use that node as anchor instead of a diamond
- Peek nodes: when a child connects to a genre inside another group, that specific genre appears as a node rather than just showing the group bubble
- Dimming: coherent opacity rules for all states (group expanded, solo node selected, child node selected)
- Edge hover: type + direction tooltip on all edge types, with wide transparent hit areas
- Node hover: edge relationship list on solo genres and child nodes
- UI copy: all "reset" buttons renamed to "clear"

---

## Data Changes

### Zero-song nodes deleted from `nodes.csv` and `edges.csv`

All 17 nodes with `song_count === 0` were removed. These were all in the `ancestor` cluster — structural placeholders with no songs. They created visual noise (visible nodes that filter to nothing) and confusing edges. Every edge touching a deleted node was also removed.

**Rule going forward:** No empty nodes, even if they are "the structural origin of something." If a genre has no songs, it should not exist in the network.

Result: 255 nodes, 323 edges. One `ancestor` node survived: `porro` (1 song, miscategorized — can be fixed separately).

---

## The Expand Mechanic: How It Works Now

### What happens when you click a multi-child group

The expand mechanic was completely rewritten from the previous session's two-simulation approach. It now works as a single unified simulation.

**Before (old):** Two separate simulations — `simCollapsed` for the 62 group nodes, `simExpanded` for the children. Children were injected into a separate SVG layer with their own force system. The parent node was dimmed/shrunk but remained in place.

**After (current):** One simulation. Child nodes and peek nodes are injected directly into `simCollapsed`. The parent group node is pinned (`fx/fy`) at its current position so it stops moving but keeps acting as a physics anchor. The tick handler is temporarily replaced to also update child positions and edge coordinates.

**Why this matters:** With two simulations, external group nodes had no physics relationship to the children — they were pulled toward the pinned parent position but the children were in a completely separate system. The result was external nodes crowding toward the center with no coherent spatial logic. With one simulation, external nodes, children, and peek nodes all share the same force field — children cluster around the anchor, peek nodes float pulled by their edges, external groups stay at natural edge distances.

### The anchor: diamond vs eponymous child

Every expanded group needs a visual anchor — the center point that root children attach to.

**Diamond anchor (e.g. `rock`):** When no child shares the group label, a small diamond polygon is rendered at the group node's position. It is:
- Size: 8px half-diagonal (fixed, small — matching ancestor node style)
- Fill: group color at 0.4 opacity
- Stroke: `#475569`, width 1
- Draggable (it's the pinned group node `gn`, which can be dragged)
- Interactive (hover shows group tooltip)

**Eponymous child anchor (e.g. `cumbia`):** When a child's ID matches the group label exactly, that child node becomes the anchor. The group node `<g>` is hidden entirely (`display:none`). The eponymous child:
- Starts at `gn.x, gn.y` (center position)
- Renders with full group-style opacity: `fill-opacity: 0.85`, `stroke-width: 0.5`, glow filter if song count > 30
- Is fully interactive: hover shows edge list, click filters songs and opens overlay
- Is NOT given an anchor edge to itself
- All root children attach their anchor edge to this node instead of `gn`

This distinction matters because `cumbia` the genre is a real musical entity with songs and connections — it should function as a node, not just a structural placeholder. `rock` as a group label has no corresponding genre node, so the diamond correctly represents it as a conceptual anchor with no songs.

On collapse, `gnSel.style('display', null)` restores the group node visibility.

### Anchor edges: which children connect to the anchor

Not all children attach to the anchor. The logic uses `hasIntraOriginParent` — a Set populated during edge scanning:

```
for each edge in allEdges:
  if both source and target are children of this group:
    if type === 'origin':
      hasIntraOriginParent.add(edge.target)
```

Then:
```
for each child node:
  if not eponymous AND not in hasIntraOriginParent:
    create anchor edge (child → anchor)
```

**What this produces:** Children that are targets of an intra-group origin edge already have a structural parent within the group. They don't need an anchor edge — they're anchored by their lineage. Only root nodes (genres with no intra-group origin parent) attach to the anchor. This creates a natural tree: oldest/root genres close to the anchor, derived genres hanging further out.

**Example (rock group):** `rock and roll` has no intra-group parent → connects to diamond. `garage rock` originates from `rock and roll` → connects to `rock and roll`, not the diamond. `punk` originates from `proto-punk` (also in group) → connects to `proto-punk`.

### Edge categories in expanded view

Four distinct edge types are rendered in the expanded state:

**1. Anchor edges (`_isDiamondEdge`):**
Root children → anchor node. Styled as the group color at 0.4 opacity, width 1. No hover interaction (relationship is implicit). Force: `distance 45, strength 0.9` — tight pull, keeps root children close to anchor.

**2. Intra-child edges:**
Origin or influence edges between children within the group. Styled via `EDGE_STYLES` (origin: solid, white 0.55 opacity; influence: dashed, white 0.5 opacity). Hoverable. Force: origin edges use same tight pull as anchor (`distance 45, strength 0.9`), influence edges use relaxed values (`distance 200, strength 0.08`).

**3. External edges (`_isExternalEdge`):**
Edges between a child node and a node outside the group. Styled via `EDGE_STYLES`, opacity via `externalEdgeOpacity()` function. Hoverable. Force: inherits from `EDGE_STYLES` distance/strength (origin 160/0.2, influence 200/0.08 — not tight, so external nodes float at natural distance). Two subtypes:
- Child → solo external node: routes directly to the collapsed group bubble (which IS that node)
- Child → eponymous external node (e.g. child connects to `electronic`, which is the eponymous child of the `electronic` group): routes to the group bubble (same logic as solo — the bubble IS that node)
- Child → multi-child external node: creates a peek node (see below)

**4. Peek-to-parent edges:**
Peek nodes also have real edges back to their parent group bubble (e.g. `dub → reggae`). These are added in a second pass after all peek nodes are collected, by scanning `allEdges` for edges where one endpoint is a peek node and the other is an outside collapsed group node. Styled and hoverable as external edges.

### Peek nodes

When a child connects to a fine-grained genre that lives inside another multi-child group (e.g. `electrocumbia` connects to `dub`, which is inside the `reggae` group), that specific genre is rendered as a **peek node** — it appears in the expanded view as a real interactive node.

**What a peek node is:**
- Created from `nodeById[fineId]` (has real song count, real id, real connections)
- Starts at its parent group bubble's position
- Color: parent group's color (`extGroupNode.color`), not its own fine-grained cluster color
- Visual style: same as child nodes — `fill-opacity: 0.4`, `stroke-width: 1.5`
- Fully interactive: hover shows edge list (real `adjParents`/`adjChildren`), click opens overlay + dims

**What a peek node is not:**
- Not a duplicate: only created for multi-child groups whose collapsed bubble doesn't directly represent the specific node
- Not a ghost/placeholder: it has real data and real interaction

**Solo external detection:** `(groupDefs[extGroup] || []).length <= 1`. If the external node's group has only one child, the group bubble IS that node — no peek node created, edge routes to the bubble directly. Same for eponymous check: `e.target === extGroup` (external node id matches its group label).

**Deduplication:** `peekNodeMap` (keyed by fine-grained node id) ensures each external node appears only once even if multiple children connect to it.

---

## The Force Simulation During Expansion

When a group expands, the collapsed simulation is modified:

```
simCollapsed.nodes(collapsedNodes + injectedChildNodes + injectedPeekNodes)
simCollapsed.force('link').links(collapsedEdgesWithoutGroup + injectedChildEdges)
simCollapsed.force('charge', d3.forceManyBody().strength(-600))  // temporarily boosted
simCollapsed.alphaTarget(0.4).restart()
setTimeout → alphaTarget(0), charge back to -400 after 1200ms
```

**Why remove collapsed edges touching the expanded group:** If `collapsedEdges` still contains `cumbia → electronic`, the force simulation pulls the `electronic` group node toward the pinned `cumbia` position. With the group node pinned, this creates artificial attraction that crowds external nodes toward the center. Removing those edges from the link force means external nodes are only pulled by the new child-level edges, which go to specific children (or peek nodes) at the correct distances.

**Charge boost:** `-600` temporarily during expansion (vs normal `-400`) pushes everything apart as children inject, preventing initial pile-up. Settles back to `-400` after 1.2 seconds.

**Per-edge distance/strength:**
- `_isDiamondEdge` or intra-group origin: `distance 45, strength 0.9` — tight cluster
- Other origin: `distance 160, strength 0.2`
- Influence: `distance 200, strength 0.08`

**Collapsed edges involving the expanded group** (`l.source.id === label || l.target.id === label`) are hidden via `display:none` on both `linkVisSelection` and `linkHitSelection`. They are restored to `display:null` on collapse.

---

## Dimming Logic

### State machine

There are three selection states:

**`activeSelection = null`:** No dimming. All nodes and edges at default opacity.

**`activeSelection = { type: 'group', groupId, connectedToGroup }`:** A multi-child group is expanded.

**`activeSelection = { type: 'node', nodeId }`:** A solo genre or child node is selected.

### Group expand dimming

`connectedToGroup` is built **after** `injectedChildEdges` is fully assembled — not from `collapsedEdges`. This is critical: a group node is only lit if it has a real visible edge connecting it to the expanded group's children or peek nodes.

```
injectedChildEdges.forEach(edge):
  if not _isDiamondEdge:
    if source is a collapsed group node → connectedToGroup.add(source.id)
    if target is a collapsed group node → connectedToGroup.add(target.id)
```

Then:
- **Group nodes:** `opacity 1` if in `connectedToGroup`, else `0.08`
- **Collapsed edges:** all `0.03` (they're not the focus; child edges tell the story)
- **External edges:** `externalEdgeOpacity(d)` — checks if either endpoint is a collapsed group node NOT in `connectedToGroup` → `0.03`. Otherwise default (full EDGE_STYLES opacity).
- **Child nodes and peek nodes:** `opacity 1` (all visible when group first expands)

**Why `connectedToGroup` comes from `injectedChildEdges` not `collapsedEdges`:** Collapsed edges may contain group-level connections that have no corresponding fine-grained child edge (e.g. due to direction mismatch or edge filtering). If we used `collapsedEdges`, a group node could appear lit with no visible edge connecting it — confusing. By using `injectedChildEdges`, we guarantee every lit group node has a rendered edge.

### Node click dimming (child node or solo genre)

```
fineConns = adj[d.id]  // bidirectional adjacency set
connectedGroupLabels = Set of group labels for d.id and all its fine-grained neighbors
nodeSelection.opacity: 1 if in connectedGroupLabels, else 0.08
linkVisSelection.opacity: 1 if both endpoints in connectedGroupLabels, else 0.03
childSelection.opacity: 1 if d.id in connectedIds, else 0.08
peekSelection.opacity: 1 if d.id in connectedIds, else 0.08
```

For a child node click, everything in the expanded view dims except:
- The clicked child
- Its fine-grained neighbors (from `adj[]`)
- The collapsed group nodes whose label contains any of those neighbors (via `childToGroup[]`)

### Background click

- If group is expanded → `collapseGroup(false)` → restores everything
- If solo node is selected (`activeSelection.type === 'node'`) → `clearDim()`, `clearNetworkFilter()`, re-applies country/decade dim if active

### `applyDim()` function

Called by node hover-out to restore the active dim state after a hover temporarily lit/brightened things. Reads `activeSelection` and reapplies the appropriate opacity rules. The `connectedToGroup` set is stored on `activeSelection` and reused — no recomputation from edges needed.

---

## Edge Hover Interaction

### Collapsed view (linkHitSelection)

A transparent 12px-wide hit line sits on top of each visible edge line. On hover:
- Visible line brightens: `rgba(255,255,255,0.8)`, width 3, no dasharray
- `network-tooltip` shows: `source → target` / type label below
- On mouseout: restores original `EDGE_STYLES` color/width/dash, hides tooltip, re-applies `applyDim()`

### Expanded view (makeExpandedEdgePair)

A helper function creates two parallel lines per edge set:
- **Hit line:** transparent, width 12, handles hover events
- **Vis line:** styled per `EDGE_STYLES`, `pointer-events:none`

On hit line hover:
- Finds matching vis line by datum identity (`l === d`)
- Brightens vis line same as collapsed view
- Shows tooltip: same `source → target / type` format
- On mouseout: restores, hides tooltip

Applies to: intra-child edges and external edges. Diamond/anchor edges have no hover (relationship is implicit from the visual context). Peek tether lines were removed entirely (they were confusing — the real typed edge between peek node and parent group renders instead).

### Edge tooltip format

```
[source name] → [target name]
[type]
```

Direction shown as `→` (source to target, matching `edges.csv` directionality). Type shown in smaller faded text below.

---

## Node Hover Tooltip

### Multi-child group nodes (in collapsed view)

Shows: name (colored), cluster, song count · subgenre count, "click to expand" hint.
No edge list — collapsed group edges are aggregated abstractions, not meaningful individual relationships.

### Solo genre nodes and child nodes

Shows: name (colored), cluster, song count, then edge list.

Edge list format — grouped by relationship type, single header per category, only categories with existing edges:

```
gave origin to:
→ classic rock
→ art rock

originated from:
→ blues

influences:
→ electronic

influenced by:
→ jazz
→ flamenco
```

Direction mapping:
- `adjChildren[id]` (outgoing) + type `origin` → "gave origin to"
- `adjChildren[id]` (outgoing) + type `influence` → "influences"
- `adjParents[id]` (incoming) + type `origin` → "originated from"
- `adjParents[id]` (incoming) + type `influence` → "influenced by"

`adjParents` and `adjChildren` are built from `allEdges` (non-subgenre only) during `initNetwork`. Directional: `adjChildren[source].push({id: target})`, `adjParents[target].push({id: source})`.

---

## Visual Style Decisions

### Child nodes (non-eponymous)
`fill-opacity: 0.4`, `stroke-width: 1.5`, stroke = group color. No glow filter. All children render identically (glow was removed because it made high-song-count children appear more saturated, breaking visual uniformity within the group).

### Eponymous child
`fill-opacity: 0.85`, `stroke-width: 0.5`, glow filter if song count > 30. Identical to a collapsed group bubble — visually signals "this is the anchor, the real genre that names this group."

### Peek nodes
Same as non-eponymous children: `fill-opacity: 0.4`, `stroke-width: 1.5`. Color = parent group color (not the peek node's own fine-grained cluster color). This ensures peek nodes read as "belonging to" another cluster — foreign to the expanded group's color scheme — while still being visually consistent with the expanded child style.

### Expand indicator ring
Group nodes that contain multiple children have a dashed ring: `stroke-width: 1.8`, `stroke-opacity: 0.75`, `dash: 4,3`, offset `r + 4`. This signals expandability without being visually heavy.

### Edge styles
- Origin: `rgba(255,255,255,0.55)`, solid, width 1.5
- Influence: `rgba(255,255,255,0.5)`, dashed `2,3`, width 1

Influence opacity was bumped from 0.25 to 0.5 this session — 0.25 was nearly invisible on the dark background, making influence connections unreadable.

### DOM layer order

```
gSelection (top-level <g> inside SVG):
  ├── linkHitSelection parent <g>     (transparent hit areas, z-order: bottom)
  ├── linkVisSelection parent <g>     (visible collapsed edges)
  ├── nodeLayerG                      (all collapsed group node <g> elements)
  ├── expanded-edges <g>              (injected edge lines, added on expand)
  └── expanded-children <g>          (injected child/peek node <g> elements, added on expand)
```

`nodeLayerG` is stored as a module-scope variable. After `expanded-children` is appended, `nodeLayerG.raise()` moves the entire node layer above the children — so the diamond/group node intercepts hover events correctly even when child nodes visually overlap it.

---

## Collapse Behavior

`collapseGroup(silent)` restores everything:

1. `gn.fx = null; gn.fy = null` — unpin anchor
2. `simCollapsed.nodes(collapsedNodes)` — remove injected nodes
3. `simCollapsed.force('link').links(collapsedEdges)` — restore original edges
4. `linkVisSelection.style('display', null)` — restore hidden collapsed edges
5. `linkHitSelection.style('display', null)` — restore hit areas
6. `.expanded-children` and `.expanded-edges` removed from DOM
7. `gnSel.style('display', null)` — restore group node `<g>` (critical for eponymous case where the whole `<g>` was hidden)
8. `gnSel.selectAll('circle').style('display', null)` — restore circle
9. `gnSel.select('text').style('display', null)` — restore label
10. `gnSel.selectAll('.group-diamond').remove()` — remove diamond polygon
11. Collapsed tick handler restored (no longer updates child/peek positions)
12. `simCollapsed.alpha(0.3).restart()` — gentle reheat so nodes drift back naturally
13. If `!silent`: `clearDim()`, `closeOverlay()`, reapply country/decade dim if active

The `silent` parameter is used when one group expands while another is already expanded — the old group collapses silently before the new one opens, without clearing the filter or overlay.

---

## Known Issues / Not Yet Done

- **Search highlight in expanded view:** If a search finds a child node and the parent expands, the child isn't visually distinct from its siblings after expansion. Needs a selected-state style.
- **Mobile:** No mobile-specific behavior for the expanded view.
- **Peek node click selection:** When a peek node is clicked, it dims everything via `adj[]` — but `adj[]` contains fine-grained neighbor IDs, some of which may be child nodes in the current expanded group that are now present in the DOM. The dim logic maps neighbors to group labels via `childToGroup`, which works for collapsed nodes, but the child nodes in `childSelection` are checked by ID directly. This path is mostly correct but hasn't been stress-tested across all edge cases.
- **Multiple peek nodes from same external group:** If two children both connect to nodes inside the `reggae` group, two separate peek nodes appear. Their respective edges back to the `reggae` group bubble both render. This looks correct but can produce visual clutter with many connections.
- **Filter state during expand:** When a group expands, `filterSongsGroup(label, children)` is called. If the user previously had a different filter active, it is replaced without notice.
