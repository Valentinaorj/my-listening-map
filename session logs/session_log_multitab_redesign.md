# My Listening Map — UI Redesign Session Log
*Documents all changes made in this conversation, starting from the goals redefinition*

---

## Why This Session Happened

The platform existed as a data visualization with five charts (genre network, map, decades bar, languages donut, audio radar) but lacked a clear purpose beyond exploration. This session started with an honest question: *what do I actually want this for?*

The answer was two things:
1. **Rediscovery** — finding songs I loved and forgot about
2. **Active retrieval** — being able to say "I want hip hop today" and get a full list, or curate a playlist for a hangout

This clarified that the platform needed a **first-class song retrieval interface**, not just visualizations you look at. Everything built in this session flows from that.

---

## Goals Defined

- Songs table should always be visible and populated, not hidden until you click something
- Genre network and map should cross-filter each other
- Decade filtering should be a tactile control, not a chart
- The layout should feel like Windows Media Player — playlist always on the right, visuals on the left
- Languages donut and audio radar removed from the interface (data preserved in code)

---

## Layout Redesign

### Before
Three-panel layout: left panel (player header + songs table), right panel (tabbed: network / map / decades / stats). Songs table was empty until you clicked a chart.

### After
Two-column split:
- **Left column**: map (top) and genre network (bottom), both always visible simultaneously, stacked vertically
- **Right column** (420px): songs panel always populated, with search, sort, song count, and decade slider at the bottom

### Global header (top bar)
Full-width bar in cream (`--bg`), same color as the bottom bar. Contains:
- Back / forward navigation arrows (left side)
- "my listening map" title
- "reset all filters" button (right side)

The old Windows 95 taskbar at the bottom was kept exactly as it was: status text on the left, credit on the right.

### Player panel removed
The black terminal box with the name and progress bar was removed. It wasn't doing anything functional.

### Decade filter
Moved from a standalone chart tab to the bottom of the songs panel, styled with a coral header bar matching the other panel titlebars. The reset button matches the style of the other panel reset buttons.

---

## Song Table — New Behaviour

### Always populated
On load, all 2,196 songs appear immediately. No clicking required to see the list.

### Sort by column headers
Each column header has a pair of sort arrows (△▽). Click once to sort ascending (▲), again to reverse (▼). The active direction fills solid, the inactive one stays outline. Columns: title, artist, year, genre, country.

### Text search
A search bar above the table filters by title, artist, or genre as you type. Stacks with all other active filters.

### Song count footer
A persistent strip below the table shows the current count (e.g. "347 songs") reflecting all active filters simultaneously.

### Decade range slider
A draggable range slider at the bottom of the songs panel. Three interaction modes:
- Drag the **left thumb** to move the start decade
- Drag the **right thumb** to move the end decade
- Drag the **filled bar** in the middle to slide the whole range without changing its width (e.g. move a one-decade selection from the 70s to the 80s)
- Click anywhere on the empty track to snap the nearest thumb to that position
- Reset button restores the full range

The decade slider only filters the songs table — it does not dim the map or network.

---

## Cross-filtering — Map and Network

### The model
Map and network can each hold one active filter at a time. Both can be active simultaneously (stacked). Each filter only replaces its own — clicking a map bubble never clears the network selection, and vice versa.

The songs table always reflects **all active filters combined**: map filter + network filter + decade range + text search.

### Map → Network
Clicking a country bubble on the map:
- Dims all other map bubbles (selected bubble gets a white ring and higher opacity)
- Dims all genre nodes in the network that have zero songs from that country
- Filters the songs table to songs from that country
- Recenters the network zoom

### Network → Map
Clicking a genre node in the network:
- Dims the network to that node's immediate connections (existing behaviour)
- Dims all map bubbles whose countries have no songs in that genre
- Filters the songs table to songs in that genre

### Releasing filters
- **Click map background** → releases map filter, restores all bubbles, removes country-based network dim
- **Click network background** → does nothing if a network filter is active (prevents accidental deselection)
- **Close map popup (X on bubble tooltip)** → releases map filter
- **Map panel reset button** → releases map filter only
- **Network panel reset button** → releases network filter, closes genre overlay and influence panel, recenters network
- **Reset all filters** (global header) → clears everything: both filters, decade range, text search, closes all overlays, recenters both map and network

### Binary dimming
All dimming is binary — a node or bubble is either full opacity or dimmed to ~8%. No proportional scaling.

---

## Navigation History (Back / Forward)

Every time you click a genre node or a map bubble, that filter state is pushed onto a history stack. The back and forward arrows in the global header walk through this history, restoring both `mapFilter` and `networkFilter` to what they were at each step.

Reset all clears the history entirely.

---

## Titlebar Meta Text

Each viz panel shows contextual information in its titlebar, replacing generic descriptions with live selection state.

**Map titlebar**
- At rest: `X countries`
- With selection: `Colombia (47 songs)`

**Network titlebar**
- At rest: `X genres · Y connections`
- With selection: `folk latino (175 songs · 8 connections)`

The counts shown are always for that selection alone — not intersected with the other active filter. The intersection is visible in the songs table count.

---

## Design Decisions

**Why the map is on top, network on bottom**
The map gives geographic context and is a natural starting point. The network is denser and rewards more deliberate exploration. Putting the map first mirrors the natural sequence: where → what genre.

**Why filters stack instead of replacing**
You often want to ask compound questions: "what Colombian folk latino do I have?" Starting from either direction (country then genre, or genre then country) should work. Replace-on-click would lose the first selection too easily.

**Why the network background click is blocked**
When a genre is selected, accidentally clicking the background cleared the filter with no feedback — the songs table kept showing the filtered list but the network looked fully lit. Blocking the background means the visual state always matches the data state. The only exits are intentional: reset button or reset all.

**Why the fill drag was added to the decade slider**
If you've set a specific range (e.g. one decade wide) and want to move it forward or backward in time, dragging a single thumb collapses the range before you can reposition it. The fill drag preserves the width of the selection while shifting it.

**Why the player panel was removed**
The name, subtitle, and progress bar were decorative but took vertical space in the songs column without adding functionality. The title already appears in the global header.

---

## Code Overview

The project is a static website — no server, no database. Everything runs in the browser from four files.

### `index.html` (190 lines)
The skeleton. Defines all the HTML elements — the global header, the two viz panels, the songs column, the decade slider, the table structure. Does not contain any logic.

### `style.css` (946 lines)
All visual styling. Uses CSS variables (`--coral`, `--bg`, `--black`, etc.) defined at the top so colors are consistent and easy to change. The Win95/Y2K aesthetic comes from: `VT323` monospace font, `4px double border` panels, cream background, and named pastel colors per panel. No external CSS framework.

### `app.js` (931 lines)
Handles everything outside the network graph:
- Loads the CSV (`master_playlist_enriched.csv`) using PapaParse
- Manages filter state: `mapFilter`, `networkFilter`, `decadeMin/Max`, `searchQuery`
- Builds and renders the songs table (`renderTable`)
- Builds the Leaflet map with country bubbles
- Implements `applyMapDim` — calculates which bubbles to dim based on current filters
- Implements the decade slider (including fill drag)
- Manages navigation history (`navHistory`, `navPush`, `navBack`, `navForward`)
- Exposes `window.filterSongs`, `window.filterSongsRaw`, `window.getActiveGenresForDim`, `window.getNetworkFilterActive` — functions that `network.js` calls to communicate across the two files

### `network.js` (1154 lines)
Handles the D3 force-directed genre graph:
- Loads `nodes.csv` and `edges.csv` and the master CSV
- Builds the simulation: nodes are genres (sized by song count), edges are origin/subgenre/influence relationships
- Handles all network interactions: drag, zoom, click, hover, genre search, legend checkboxes
- The genre overlay (slides up from bottom when you click a node) shows what a genre comes from and leads to
- The influence panel (slides up when you click an influence edge) shows the specific songs behind that connection
- Exposes `window.applyNetworkDimByCountry`, `window.clearNetworkDim`, `window.resetNetworkView`, `window.resetNetworkStatus` — functions that `app.js` calls to control the network from outside

### How the two JS files talk to each other
They can't directly call each other's internal functions, so they communicate through `window.*` — functions attached to the global browser object. `app.js` exposes filter state getters; `network.js` exposes dim and reset controls. This is the standard pattern for coordinating two separate scripts on the same page.

### Data files (not modified this session)
- `data/master_playlist_enriched.csv` — 2,196 songs, 31 columns including `Main Genre` and `Influence Genre`
- `data/nodes.csv` — 319 genre nodes with id, song count, cluster
- `data/edges.csv` — 490 edges with source, target, type (origin/subgenre/influence), weight

---

## What Was Removed

| Feature | Reason |
|---|---|
| Languages donut chart | Not useful enough to justify the space; data preserved in `app.js` |
| Audio radar chart | Same — interesting once, not a retrieval tool |
| Decades bar chart | Replaced by the decade range slider in the songs panel |
| Player panel (black box) | Decorative, no functionality |
| Songs table clear (✕) button | Replaced by reset buttons per panel and reset all |
| Sort buttons (year/title/artist/genre row) | Replaced by column header sort arrows |
| Tab bar (network/map/decades/stats) | Removed when switching to always-visible split layout |

---

## Files Changed This Session

All four frontend files were modified:
- `index.html` — structural redesign
- `style.css` — new layout styles, global header, decade filter coral, panel reset button styles
- `app.js` — filter state model, cross-filtering, decade slider, navigation history, song count footer
- `network.js` — external API functions, updateNetworkStatus, validEdges and updateNetworkStatus hoisted to module scope
