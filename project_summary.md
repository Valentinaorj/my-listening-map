# My Listening Map — Project Summary
*Last updated end of UI redesign session · valentinaorjuela.github.io/my-listening-map*

---

## What This Is

A personal music taste dashboard built from a Spotify data export after closing a Spotify account. The project is simultaneously a data visualization and a political act — it gives meaningful insight into listening history that Spotify withheld, and was built precisely as a response to Spotify's data practices.

The platform has two purposes: **understanding** (exploring genre genealogy, geographic spread, decade distribution) and **retrieval** (finding specific songs, curating playlists, remembering music for a hangout). Every design decision should serve one or both of these.

**Live at:** `valentinaorjuela.github.io/my-listening-map`  
**Stack:** HTML/CSS/JS frontend · Python for data cleaning  
**Libraries:** D3.js · Leaflet · Chart.js · PapaParse  
**Main data file:** `data/master_playlist_enriched.csv`

---

## Current State

| Metric | Value |
|---|---|
| Total tracks | 2,196 |
| Genre nodes | 319 (294 with songs, 25 ancestors/roots with 0 songs) |
| Edges | 490 |
| Origin edges | 153 |
| Subgenre edges | 232 |
| Influence edges | 105 |
| Clusters | 17 |
| Disconnected nodes | 0 |

### Top 15 genres by song count
| Genre | Songs |
|---|---|
| folk latino | 175 |
| rock latino | 107 |
| alternative rock | 92 |
| electrocumbia | 68 |
| folk | 52 |
| hip hop latino | 48 |
| alternative pop | 47 |
| neo-classical | 46 |
| progressive rock | 35 |
| hip hop | 33 |
| bolero | 28 |
| neo-psychedelic | 27 |
| rock and roll | 26 |
| neo-soul | 25 |
| psychedelic rock | 25 |

---

## File Structure

```
my-listening-map/
├── index.html               — app shell, global header, layout structure
├── app.js                   — filter state, songs table, map, cross-filter logic
├── network.js               — D3 force-directed genre graph, all network logic
├── style.css                — Win95/Y2K aesthetic, all styles
└── data/
    ├── master_playlist_enriched.csv   — 2,196 tracks, 31 columns
    ├── nodes.csv                      — genre nodes (id, song_count, cluster)
    └── edges.csv                      — genre relationships (source, target, type, weight)
```

### master_playlist_enriched.csv columns (31)
Track URI, Track Name, Album Name, Artist Name(s), Release Date, Duration (ms), Popularity, Explicit, Added By, Added At, Genres, Record Label, Danceability, Energy, Key, Loudness, Mode, Speechiness, Acousticness, Instrumentalness, Liveness, Valence, Tempo, Time Signature, playlist_name, playlist_count, playlist_names, Artist Country, Artist Continent, **Main Genre**, **Influence Genre**

**Critical:** The CSV is saved with `QUOTE_ALL` (every field quoted). The `parseCSV` function in `network.js` handles this with a custom quoted-field parser that strips quotes from header names with `.replace(/^"|"$/g, '')`. Do not change the CSV writing format or the network will break silently — wrong column offsets cause all `Main Genre` reads to return empty.

---

## Layout

### Global header (full width, top)
- Back / forward navigation arrows (filter history)
- "my listening map" title
- "reset all filters" button
- Same cream color as bottom bar (`--bg`)

### Two-column split
**Left column — viz panels (stacked vertically):**
- Map panel (top) — Leaflet bubble map
- Network panel (bottom) — D3 force-directed genre graph

**Right column (420px fixed) — songs:**
- Songs panel — always populated, always visible
- Decade range slider at bottom of songs panel

### Bottom bar
Status text (left) · "by valentina orjuela" (right). Unchanged from original.

---

## Design Aesthetic

Windows 95 / Y2K with pastel panels. VT323 monospace font throughout. Color palette:
- Background: `#f6eee0` (cream)
- Panel titlebars: coral (`#e8614a`), mint (`#7dd4a8`), lavender (`#b8a0d4`), yellow (`#e8c547`), black for network
- Network background: `#070b14` (dark)
- Double-border panels (`4px double #1a1a1a`)
- Win95-style scrollbars

**Decade filter header** is coral to match the panel aesthetic — it's the only standalone filter control and needed visual grounding.

---

## Songs Panel

### Always populated
All 2,196 songs appear on load. The table is the primary retrieval interface — everything else filters it.

### Filters that affect the table
All four stack simultaneously:
1. **Country** — from clicking a map bubble
2. **Genre** — from clicking a network node or influence edge
3. **Decade range** — from the slider
4. **Text search** — from the search bar (matches title, artist, genre)

### Sort
Column header arrows (`△▽`) sort each column. Active direction fills solid (`▲`/`▼`), inactive stays outline. Default: year descending.

### Song count footer
Always visible strip below the table showing current filtered count.

### Column visibility
When filtering by genre, the genre column swaps to show the influence genre instead. When filtering by country or language, the country column hides.

---

## Cross-filtering System

This is the most complex and important part of the codebase. Read carefully before changing anything.

### Filter state (lives in app.js)
```js
var mapFilter     = null  // { type: 'country', value: 'Colombia' }
var networkFilter = null  // { type: 'genre',   value: 'folk latino' }
var decadeMin     = null  // e.g. 1990
var decadeMax     = null  // e.g. 2000
var searchQuery   = ''
```

### The core rule
**Each filter only owns its own dimension.** Clicking a map bubble sets `mapFilter` only — it never touches `networkFilter`. Clicking a genre node sets `networkFilter` only — it never touches `mapFilter`. This means both can be active simultaneously.

### How dimming works
**Map → Network:** clicking a country dim genres with zero songs from that country. Implemented via `window.applyNetworkDimByCountry(country)` in `network.js`, which reads the active genre set from `window.getActiveGenresForDim()` in `app.js`.

**Network → Map:** clicking a genre node dims country bubbles with no songs in that genre. Implemented via `applyMapDim()` in `app.js`.

**Decade → Both:** dragging the decade slider dims genres and countries with no songs in that period. Implemented via `applyAllDims()` which calls both `applyMapDim()` and `window.applyNetworkDimByDecade()`.

**All dimming is binary** — 1.0 or 0.08 opacity. No proportional scaling.

### Priority rule — CRITICAL
**A node selection (`activeSelection.type === 'node'`) always takes visual priority in the network.** `applyNetworkDimByCountry` and `applyNetworkDimByDecade` both check this guard at the top:
```js
if (activeSelection && activeSelection.type === 'node') return
```
This means: if you have a genre node selected, clicking a map bubble will update the songs table and map bubble dim but will NOT overwrite the network's node-based dim.

### clearDim behavior — CRITICAL
`clearDim()` in `network.js` resets opacity and sets `activeSelection = null`. It is called from `closeOverlay()`, `hideEdgeTooltip()`, and `clearNetworkDim()`. **After any `clearDim()` call, the country dim must be re-applied if `mapFilter` is still active.** Both `closeOverlay` and `hideEdgeTooltip` do this synchronously at their end:
```js
var activeCountry = typeof window.getMapFilter === 'function' ? window.getMapFilter() : null
if (activeCountry) window.applyNetworkDimByCountry(activeCountry)
```
If you add a new function that calls `clearDim()`, you must add this re-apply pattern or the map filter will silently lose its effect on the network.

### Releasing filters
| Action | What clears |
|---|---|
| Map background click | `mapFilter` only |
| Map reset button | `mapFilter` only |
| Network background click | blocked if `networkFilter` active |
| Network overlay close button | `networkFilter` only, re-applies country dim |
| Network reset button | `networkFilter` only, re-applies country dim |
| Reset all filters | everything — both filters, decade, search, history |

When `networkFilter` is cleared, `updateMapStatus()` must be called to update the map titlebar (it shows genre-related info when a network filter is active). When `mapFilter` is cleared, `window.applyNetworkDimByCountry(null)` must be called to release the country dim on the network.

### Status text — complete state matrix
Both titlebars show live contextual text:

**Map titlebar:**
| State | Text |
|---|---|
| No filters | `81 countries` |
| Country only | `Colombia (47 songs)` |
| Genre only | `5 countries with folk latino songs` |
| Both | `Colombia (47 songs) · 3 with folk latino` |

**Network titlebar:**
| State | Text |
|---|---|
| No filters | `319 genres · 490 connections` |
| Genre only | `folk latino (175 songs · 8 conn.)` |
| Country only | `40 genres in Colombia` |
| Both | `folk latino (175 songs · 8 conn.) · 3 in Colombia` |

The intersection count (the `· 3 with/in` part) is always computed live from the actual track data.

### Functions that must be called when filters change
Every filter change must trigger the right combination of these:
- `renderTable()` — always
- `applyMapDim()` — always (re-evaluates bubble dim)
- `updateMapStatus()` — always (re-evaluates map titlebar text)
- `window.applyNetworkDimByCountry(country)` — when map filter changes
- `window.updateNetworkStatusForCountry(country)` — when map filter changes
- `applyAllDims()` — when decade range changes
- `navPush()` — when map or network filter changes (not decade or search)

Missing any of these causes the visual state to diverge from the data state, which is the main source of bugs in this system.

---

## Navigation History

Every map bubble click and network node click pushes a state snapshot `{ mapFilter, networkFilter }` onto `navHistory`. The back/forward arrows in the global header walk this stack via `navBack()` and `navForward()`, restoring both filters and re-applying all dim logic. Reset all clears the history.

Decade range and text search are intentionally excluded from history — they behave more like continuous dials than discrete selections.

---

## Genre Network — Architecture

### Edge types (3 only — no fusion type)
- **origin** — solid line — historical/genealogical lineage (e.g. `african percussion → cumbia`)
- **subgenre** — dashed line — one genre is a more specific form of another
- **influence** — dotted line — data-derived from track tagging. A song with `main: rock latino, influence: hip hop latino` creates/strengthens an influence edge `rock latino → hip hop latino`. Clicking an influence edge shows the specific songs behind it.

**Key principle:** influence edges are personal data — they come from your actual library. Origin and subgenre edges are hand-curated music history.

### The influence system
Each track has:
- `Main Genre` — where the song lives in the network (one node, required)
- `Influence Genre` — optional, one genre that influenced this specific track

A song lives in exactly one node. Influence Genre does NOT place it in a second node — it only creates an edge.

### Hover vs click in the network
- **Hover** → temporary dim of unconnected nodes, tooltip shows genre/count. Mouseout restores previous state. Never permanent.
- **Click node** → opens genre overlay (slides up from bottom), sets `networkFilter`, dims permanently, filters songs table
- **Click influence edge** → opens influence panel (slides up), shows song list, sets `networkFilter`
- **Click origin/subgenre edge** → shows floating edge type tooltip only, no filter change

### activeSelection
The network tracks its current selection state in `activeSelection`:
```js
// node selected:
{ type: 'node', nodeId: 'folk latino' }
// edge selected:
{ type: 'edge', srcId: 'rock latino', tgtId: 'hip hop latino' }
// country dim active (from map):
{ type: 'country', country: 'Colombia', activeGenres: { 'folk latino': true, ... } }
// decade dim active:
{ type: 'decade', activeGenres: { 'folk latino': true, ... } }
```
`applyDim()` reads `activeSelection` to restore the correct dim after hover. If you add a new selection type, add a matching case in `applyDim()`.

### Module-scope variables in network.js — IMPORTANT
These must be module-scoped (not inside `initNetwork`) or external API functions won't be able to access them:
- `allNodes`, `allEdges`, `allTracks`, `validEdges`
- `nodeSelection`, `linkHitSelection`, `linkVisSelection`
- `zoomBehavior`, `svgSelection`, `networkContainer`
- `activeSelection`, `adj`
- `updateNetworkStatus` (assigned inside `initNetwork` but declared at module scope)

If you add new variables that need to be accessed from the external API (`window.*` functions at the bottom of the file), hoist them to module scope and assign them inside `initNetwork`.

### Window API exposed by network.js
These are the functions `app.js` calls to control the network:
```js
window.applyNetworkDimByCountry(country)  // dim by country, pass null to release
window.applyNetworkDimByDecade()          // dim by active decade range
window.clearNetworkDim()                  // full reset, restore all opacities
window.clearNetworkDimKeepOverlay()       // same but leaves overlay open
window.resetNetworkView()                 // close overlays + recenter zoom
window.resetNetworkStatus()              // reset titlebar text to total count
window.updateNetworkStatusForCountry(c)  // update titlebar for country context
```

### Window API exposed by app.js
These are the functions `network.js` calls to read app state or trigger app updates:
```js
window.filterSongs(type, value)          // set a filter from network interaction
window.filterSongsRaw(label, songs, t)   // set influence panel filter directly
window.getNetworkFilterActive()          // returns bool — is networkFilter set?
window.getMapFilter()                    // returns country string or null
window.getActiveGenresForDim()           // returns genre set for current map+decade context
window.clearNetworkFilter()             // clear networkFilter, re-render table
```

### Clusters (17)
| Cluster | Color |
|---|---|
| caribe | `#ff6b35` |
| afro-sudamericano | `#e8c547` |
| andina | `#c084fc` |
| cancion | `#fb7185` |
| brasileira | `#34d399` |
| rock-latino-espanol | `#f97316` |
| hip-hop-latino | `#a78bfa` |
| jazz | `#60a5fa` |
| soul-rnb-funk | `#f472b6` |
| hip-hop | `#94a3b8` |
| rock | `#ef4444` |
| electronic | `#22d3ee` |
| african-global-roots | `#fbbf24` |
| folk-singer-songwriter | `#86efac` |
| classical-experimental | `#c4b5fd` |
| pop-indie | `#fdba74` |
| ancestor | `#1e293b` |

### Ancestor nodes
`cluster: ancestor` nodes have 0 songs and appear as small diamonds. They represent root genres that predate or underpin genres in the library. Rule: an ancestor must be a broad mechanism or tradition (good: `african percussion`, `european immigrant music`) not a named genre, specific artist, or historically bounded movement (bad: `chimurenga`, `ethnic caos`). A node that only connects to one other node does not qualify as an ancestor.

---

## Map

Built with Leaflet. Country bubble size = √(count/max) × 40. Color = continent.

**Hover:** shows custom dark tooltip (same style as network tooltip — no Leaflet popup, no tail, no rounded corners, VT323 font) with country name in bold and song count. Also temporarily dims all other bubbles.

**Click:** sets `mapFilter`, permanently dims bubbles, dims network genres from that country, filters songs table.

**Background click / popup close:** releases `mapFilter`.

The map stores all markers in `mapMarkers = [{ marker, country }]` so `applyMapDim()` can iterate and update styles.

---

## Decade Range Slider

Three drag modes:
- **Min thumb drag** — moves start decade
- **Max thumb drag** — moves end decade  
- **Fill drag** — moves the whole range without changing its width (e.g. slide 1970s–1980s to 1980s–1990s)
- **Click on empty track** — snaps nearest thumb to clicked position

Range is always expressed as actual decade values (`decadeMin`, `decadeMax`). Full range = no filter (computed by comparing to `DECADE_DECADES[0]` and last). Decades are built by filling every decade between the earliest and latest in the data (Option C) — so empty decades in the middle still appear.

CSS grid lines on the track are driven by `--decade-count` CSS variable set from JS.

---

## Genre Classification Philosophy

**Core principle:** Genre should reflect sonic genealogy and lineage, not cultural association labels. Instrument names are not genre names.

**Naming convention:** `"X latino"` not `"latin X"` — e.g. `hip hop latino`, `rock latino`, `folk latino`.

**Main vs influence genre:** Main genre = what the music primarily *is*. Influence genre = what it *draws from*. A song lives in exactly one node.

**Val has deep knowledge of Latin American music** — particularly Argentine, Colombian, Mexican, Chilean, Uruguayan. Push back on surface-level cultural tagging. When in doubt about a genre placement for a niche artist, ask rather than guess.

**Never create new clusters** — use existing ones only. Never rename a genre affecting 10+ songs without confirmation.

---

## Data Pipeline

Exported CSVs from a closed Spotify account. Processed through Python scripts (`master_songs.py`, `enrich_country.py`, `fix_genres.py`, `fix_countries.py`, `genre_list.py`).

After any genre rename or reclassification in `master_playlist_enriched.csv`, recount and update `nodes.csv` `song_count` to match. Dry-run before writing: apply changes → recount via `Counter` on `Main Genre` → update node counts → append new nodes/edges → write all three files in a single pass.

---

## Removed Features (data preserved)

| Feature | Where data lives |
|---|---|
| Languages donut chart | `countryLanguage` lookup in `app.js` |
| Audio radar chart | Audio feature columns in `master_playlist_enriched.csv` |
| Decades bar chart | Replaced by slider |
| Language filter (`filterSongs('language', ...)`) | Logic removed but data preserved |

---

## Known Issues / Pending Work

### Genre data
1. Genres in `classical-experimental`, `caribe`, `andina`, and `rock` clusters still have imprecise tagging
2. World music nodes (`jaliya tradition`, `sahelian folk`, `tuareg music`, `lebanese folk`, `georgian polyphonic`, `contemporary maloya`) are connected but lightly — could use more edges
3. `latin alternative` cleanup in `genre-editor.html` — ~57 artists still to review

### Features
1. **Playlist export** — copy current filtered song list to clipboard
2. **Artist nodes in the network** — would make "find things like Bomba Estéreo" possible
3. **Tidal + YouTube Music integration** — YouTube Music via `ytmusicapi` Python library
4. **Mood/energy layer** — additional filter dimension using Spotify audio features

### Technical debt
- `parseCSV` in `network.js` is a custom quoted-field parser. If CSV format changes, update it.
- Language detection is country-based (via `countryLanguage` lookup), not actual language detection. Multi-language countries are simplified.

---

## Workflow

**Two modes of working:**
1. **File delivery** — Claude modifies files, delivers for manual download and replacement
2. **Browser tools** — Claude builds HTML tools (`genre_editor.html`, `world_tagger.html`) that Val uses to make decisions, then exports JSON back to Claude for batch application

**When touching the cross-filter system:** always trace the full event chain. A filter change touches: filter state → `renderTable()` → `applyMapDim()` → `updateMapStatus()` → network dim function → network status function → `navPush()`. Missing a step creates divergence between visual state and data state.

**Genre decisions protocol:** For lesser-known or emerging artists, ask Val for context. For well-known commercial artists, Claude can tag confidently. For world/global music, always build a browser tool with pre-filled suggestions.

**Dry-run before writing** any CSV changes. The correct sequence: apply track changes → recount → update node counts → append new nodes/edges → write all three files in one pass. Never chain edits from intermediate `/tmp/` files.

---

## Tools Built

### genre_editor.html
Artist-by-artist genre review tool with bulk edit and per-song override. Used for `latin alternative` cleanup and other problem genres.

### world_tagger.html
Browser tool for manually tagging ambiguous world music tracks. Autocomplete dropdown for all 319 genres, confirm/delete/skip per card, exports JSON for Claude to apply. Regenerated each session from actual untagged tracks in the CSV.
