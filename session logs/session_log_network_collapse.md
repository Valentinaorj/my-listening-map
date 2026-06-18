# My Listening Map — Network Collapse & Regrouping Session Log

*Documents all decisions and changes made in this session, focused exclusively on the genre network.*

---

## Why This Session Happened

The genre network had 272 nodes and 368 edges — too dense to read on arrival. The goal of this session was to make the network legible as a first impression while preserving full granularity for deliberate exploration. Everything built here flows from that single problem.

---

## The Core Idea: Two-Level Network

The network now has two visual states:

**Collapsed view (default):** 62 group nodes, one per genre family. `cumbia`, `electrocumbia`, `cumbia digital`, `cumbia pop`, `cumbia sonidera`, and `chicha` collapse into a single `cumbia` bubble. The bubble is sized by the sum of all its children's song counts. This is what you see when you open the page.

**Expanded view (per group):** Click any group node → the parent dims and shrinks, child nodes appear around it sized by their individual song counts, dashed connector lines radiate from the parent to each child. Click background to collapse back.

Solo groups (groups with one child like `salsa`, `tango`, `dancehall`) behave as single nodes in both views — clicking them goes directly to filtering songs, no expansion animation.

---

## The Data Pipeline

Three JSON/CSV files now define the network. The data files themselves (`nodes.csv`, `edges.csv`, `master_playlist_enriched.csv`) were not modified — all regrouping is a view-layer concern.

### `data/genre_groups.json`

Defines which fine-grained nodes collapse into which group. Format:

```json
{
  "cumbia": ["cumbia", "cumbia pop", "cumbia sonidera", "cumbia digital", "electrocumbia", "chicha"],
  "salsa": ["salsa"],
  "jazz": ["jazz", "nu jazz", "cool jazz", "free jazz", "indie jazz", "latin jazz", ...]
}
```

Key = the group label shown in the network. Value = array of node IDs from `nodes.csv` that belong to it. Single-element arrays are solo groups. Every node in `nodes.csv` appears exactly once across all arrays — no node is orphaned or duplicated.

**How this was built:** Started from `nodes.csv` (272 nodes). An algorithm proposed initial merges based on shared root words within the same cluster. Val reviewed and heavily edited — splitting wrong merges (e.g. `mexican rock / mexican ska / mexican indie` → not one group), absorbing some solos, and renaming parents. Three zero-song ancestor nodes (`indigenous`, `spanish music`, `bambuco`) were removed entirely. Final count: 62 groups.

**Key rule:** Groups are semantic families, not taxonomic levels. `cumbia` contains all cumbia variants because they share a musical identity. `folk` contains nodes from multiple original clusters because Val's library draws no meaningful boundary between them at that level of granularity.

### `data/group_clusters.json`

Assigns each group node to one of 11 visual clusters. Format mirrors `genre_groups.json`:

```json
{
  "caribean": ["cumbia", "reggaeton", "salsa", "dancehall", "merengue", ...],
  "jazz":     ["jazz", "big band", "lounge"],
  "rock":     ["rock", "punk", "hard rock", "ska"]
}
```

The 11 clusters are: `african`, `afroamerican`, `latin`, `caribean`, `classical-experimental`, `pop and electronic`, `folk`, `hip-hop`, `jazz`, `rock`, `soul-rnb-funk`.

**Why a separate file from genre_groups.json:** The original `nodes.csv` had 17 clusters, defined for 272 fine-grained nodes. Many of those clusters became meaningless at the group level — `brasileira` cluster had only 3 groups, `andina` had 1. A cluster of 1 node contributes no spatial grouping. The new 11 clusters were defined by Val manually, directly on the 62 group nodes, with geographic and cultural logic: Caribbean traditions together, African diaspora music together, etc.

**How cluster is used in the simulation:** Each cluster gets a gravity center point on a circle around the canvas. A custom D3 force pulls every node toward its cluster center. This is what keeps same-cluster nodes spatially close without forcing a rigid layout.

### `data/edges.csv` (modified)

Two changes from the previous version:

1. **Subgenre edges removed from network rendering entirely** (they still exist in the file but are skipped in all code). Rationale: subgenre relationships are now expressed structurally through the grouping — `electrocumbia` being inside the `cumbia` group already communicates that relationship. Keeping subgenre edges would double-encode it and add visual clutter.

2. **Six new origin edges added** for nodes that had become isolated (no remaining connections after subgenre removal):
   - `classical → orchestra`
   - `jazz → lounge`
   - `merengue → bachata`
   - `salsa → mambo`
   - `folk → forró`
   - `eurasian folk → tuvan`

   Three of these (`classical → orchestra`, `merengue → bachata`, `salsa → mambo`) already existed as subgenre edges and were converted to origin type rather than duplicated.

---

## Edge Logic in the New System

### Edge types in use: `origin` and `influence`

- **`origin`** (solid line, higher opacity): one genre historically or structurally gave rise to another. `blues → jazz`, `ska → reggae`. Directed, factual.
- **`influence`** (dashed line, lower opacity): songs in genre A have `Influence Genre` = B in the master CSV. These edges are personal to Val's library — they trace which genre aesthetically connects specific songs she owns. Never delete or remap without tracing the specific songs behind them.
- **`subgenre`** (removed from rendering): was used to express parent-child genre taxonomy. Now expressed through grouping instead.

### Collapsed view edge logic

When building collapsed edges, each fine-grained edge is mapped to its group endpoints. The result is deduplicated: if multiple fine-grained edges point between the same two groups, only one collapsed edge appears. **Tie-breaking rule: `origin` beats `influence`.** If any of the underlying edges is origin type, the collapsed edge shows as origin.

Internal edges (both endpoints in the same group) are hidden in collapsed view and reappear when the group expands.

### Expanded view edge logic

When a group expands, the fine-grained edges reappear for that group's children. Edges between a child and a node outside the group point to the *group node* of the external node (not its fine-grained children). This keeps the expanded view from becoming cluttered with external connections.

Additionally, **dashed connector lines** radiate from the dimmed parent node to each child node. These are purely visual (not in the edge data, not typed, not interactive) — they exist to make the expand/collapse relationship legible.

---

## D3 Force Simulation

The simulation runs on 62 collapsed group nodes. It uses six forces simultaneously:

### 1. Link force
Pulls connected nodes toward each other along edges. Origin edges: distance 160px, strength 0.2. Influence edges: distance 200px, strength 0.08. Influence edges are deliberately weaker — they express aesthetic connections, not structural ones, so they shouldn't dominate layout.

### 2. Charge (many-body repulsion)
Strength: `-400`. Every node repels every other node. This is the primary source of "air" in the layout. Higher absolute value = more spread.

### 3. Center force
Pulls the whole graph gently toward the center of the SVG. Prevents drift.

### 4. Collision
Radius: `node.r + 22px`. Prevents nodes from overlapping. The 22px padding is deliberately generous — it creates visual breathing room between adjacent nodes.

### 5. Cluster gravity (custom force)
Each cluster has a center point on a circle of radius 42% of the smaller viewport dimension. A custom force applies on every tick: each node is pulled toward its cluster center with strength `0.15 * alpha`. This is strong enough to keep same-cluster nodes spatially grouped but weak enough that inter-cluster edges can still pull across boundaries. The alpha decay means this force diminishes as the simulation settles.

### 6. Radial-leaves (custom force)
Nodes with no connections (`structuralDegree === 0`) or only one connection (`structuralDegree === 1`) are pushed outward from the center and toward their cluster boundary. This prevents isolated or weakly-connected nodes from piling up in the middle of the graph. Leaf nodes are also pushed away from their single neighbor, creating a "hanging off the edge" effect that signals their peripheral status.

### Expanded group mini-simulation

When a group expands, a *second* independent simulation runs for the child nodes only. Forces: link (distance 70, strength 0.3), charge (-120), center at the parent node's position, collision (node.r + 8). This simulation settles quickly (`alphaDecay 0.03`) so children appear to snap into position rather than drift. The parent node is not part of this simulation — it stays pinned where the collapsed simulation left it.

---

## Interaction Design

### Click a multi-child group node
1. Songs table filters to all children combined (e.g. clicking `cumbia` shows songs where `Main Genre` is any of: `cumbia`, `cumbia pop`, `cumbia sonidera`, `cumbia digital`, `electrocumbia`, `chicha`)
2. All other collapsed nodes dim to 15% opacity
3. The clicked node dims to 20% and shrinks to half its radius
4. Child nodes appear around the parent with enter animation (radius grows from 0)
5. Dashed connector lines appear from parent to each child
6. Inter-child edges appear (origin/influence typed)
7. A second force simulation runs for the children

### Click a child node (in expanded view)
1. Songs table filters to that specific fine-grained genre
2. Genre overlay panel opens showing what that genre comes from and leads to (same overlay as before)
3. Sibling child nodes dim to 30%

### Click a solo group node
Songs table filters to that genre's songs. No expansion animation (nothing to expand).

### Click background
If a group is expanded: collapses it — children removed, parent restored to full size and opacity, filters cleared.

### Genre search
Searches both group labels (e.g. "cumbia") and individual child IDs (e.g. "electrocumbia"). If a child is matched, its parent group expands and the child is highlighted.

### Cross-filter with map and decade slider
In collapsed view, a group node dims (via map/decade cross-filter) only if *none* of its children have songs matching the active filter. If any child has songs in the filtered set, the group node stays lit. This gives an accurate picture at the group level without requiring expansion.

---

## app.js Changes

Minimal — only what was necessary to support group-level filtering from the network.

### `filterSongsMulti(type, groupLabel, childIds)`
New function (exposed as `window.filterSongsMulti`). Called by `network.js` when a multi-child group is clicked. Sets `networkFilter` to `{ type: 'genre-group', value: groupLabel, children: childIds }`.

### `genre-group` type handling in `getFilteredTracks`
The filter now checks `networkFilter.type`. If `genre-group`, it builds a lookup set from `networkFilter.children` and matches `Main Genre` against any of them. If `genre`, it matches exactly as before.

Same check added in `applyMapDim` and `updateMapStatus` — any place that previously read `networkFilter.value` and did a single-string match now handles the array case.

### `hasGenre` check
Extended to include `networkFilter.type === 'genre-group'` so the map status bar updates correctly when a group is selected.

---

## Files Changed This Session

| File | What changed |
|---|---|
| `network.js` | Full rewrite: two-level collapsed/expanded architecture, new cluster system, new edge logic |
| `app.js` | Added `filterSongsMulti`, `genre-group` filter type in three places, `hasGenre` check |
| `data/genre_groups.json` | New file: 62 group definitions across all 272 fine-grained nodes |
| `data/group_clusters.json` | New file: 11 cluster assignments for the 62 group nodes |
| `data/edges.csv` | Subgenre edges not removed from file but skipped in code; 3 converted to origin, 3 new origin edges added |

---

## What Is Not Yet Done (next session)

- **Legend redefinition**: the legend currently reflects the 11 new clusters but its visual design hasn't been reviewed since the redesign. Needs manual review against the live network.
- **Node label readability**: at 62 nodes, some labels may still overlap depending on simulation settlement. May need label collision avoidance or hide-below-threshold logic.
- **Expand animation polish**: the child nodes appear but the transition could be smoother — a slight delay stagger between children would make the emergence feel more deliberate.
- **Solo group click behavior**: currently filters songs but doesn't provide any visual feedback in the network itself (no dim, no selection state). Should probably highlight the clicked node and dim others as a secondary selection state.
- **Search highlight behavior**: when a child node is found via search, the parent expands — but the child isn't visually distinct enough from its siblings after expansion.
- **Mobile viewport**: the network has no mobile-specific behavior. Likely needs separate treatment.
