# My Listening Map — Project Backup
*Generated end of session · valentinaorjuela.github.io/my-listening-map*

---

## What This Is

A personal music taste dashboard built from a Spotify data export after closing a Spotify account. The project is simultaneously a data visualization and a political act — it gives meaningful insight into listening history that Spotify withheld, and was built precisely as a response to Spotify's data practices.

**Live at:** `valentinaorjuela.github.io/my-listening-map`  
**Stack:** HTML/CSS/JS frontend · Python for data cleaning  
**Libraries:** D3.js · Leaflet · Chart.js · PapaParse  
**Main data file:** `data/master_playlist_enriched.csv`

---

## Current State (end of session)

| Metric | Value |
|---|---|
| Total tracks | 2,196 |
| Genre nodes | 319 (294 with songs, 25 ancestors/roots with 0 songs) |
| Edges | 490 |
| Origin edges | 153 |
| Subgenre edges | 232 |
| Influence edges | 105 |
| Clusters | 17 |
| Disconnected nodes | **0** |

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
├── index.html               — app shell, layout, tabs
├── app.js                   — chart/map logic, song table, filter system
├── network.js               — D3 genre network graph
├── style.css                — Win95/Y2K aesthetic, all styles
└── data/
    ├── master_playlist_enriched.csv   — 2,196 tracks, 31 columns
    ├── nodes.csv                      — genre nodes (id, song_count, cluster)
    └── edges.csv                      — genre relationships (source, target, type, weight)
```

### master_playlist_enriched.csv columns (31)
Track URI, Track Name, Album Name, Artist Name(s), Release Date, Duration (ms), Popularity, Explicit, Added By, Added At, Genres, Record Label, Danceability, Energy, Key, Loudness, Mode, Speechiness, Acousticness, Instrumentalness, Liveness, Valence, Tempo, Time Signature, playlist_name, playlist_count, playlist_names, Artist Country, Artist Continent, **Main Genre**, **Influence Genre**

`Main Genre` and `Influence Genre` are new columns added this session.

---

## Design Aesthetic

Windows 95 / Y2K with pastel panels. VT323 monospace font throughout. Fixed taskbar at bottom with live clock. Color palette: cream background `#f6eee0`, coral, yellow, mint, lavender, orange, pink. Double-border panels. Win95-style scrollbars.

---

## App Layout

**Left panel (fixed 320px):**
- Player header — name, stats, loading progress bar, transport buttons (decorative)
- Songs table — filterable by clicking any chart/map element. Columns: title, artist, year, genre, country. Column visibility adapts to active filter.

**Right panel (tabbed):**
- **Genre Network** — D3 force-directed graph (default tab)
- **Mapa** — Leaflet bubble map, bubble size = song count, color = continent
- **Décadas** — Chart.js bar chart, % by decade
- **Otros Stats** — Languages donut + audio radar (Danceability, Energy, Valence, Acousticness, Instrumentalness, Speechiness)

---

## Genre Network — Architecture

### Edge types (3)
- **origin** — solid line — historical/genealogical lineage (e.g. `african percussion → cumbia`)
- **subgenre** — dashed line — one genre is a branch of another (e.g. `folk → indie folk`)
- **influence** — dotted line — derived from actual track tagging: songs that have both a main genre and an influence genre create an edge between those two genres. Clicking an influence edge shows the specific songs embodying that connection.

**Key principle:** influence edges are *personal* — they come from your actual library, not from music theory. Origin and subgenre edges are *historical* — they describe genre genealogy regardless of what you listen to.

### The influence system
Each track has:
- `Main Genre` — where the song lives in the network (one node)
- `Influence Genre` — optional, a genre that influenced that specific song

A song with `main: rock latino, influence: hip hop latino` lives in the rock latino bubble but creates/strengthens an influence edge from rock latino → hip hop latino. Clicking that edge shows you the songs behind it.

This replaced the old system where multi-genre tags made songs appear in multiple bubbles simultaneously, which was redundant with the edges already showing those relationships.

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
Nodes with `cluster: ancestor` have 0 songs and appear as small diamonds. They represent root genres that predate or underpin the genres in your library. Current ancestors:
`ambient`, `bebop`, `european immigrant music`, `hard bop`, `heavy metal`, `idm`, `indigenous colombian music`, `indigenous cuban music`, `latin jazz`, `porro`, `soul jazz`, `stutter house`, `techno`, `uk garage`, `west african pentatonic`, `bambuco`, and others.

**West african pentatonic** — added this session. Connected to: `sahelian folk`, `blues`, `tuareg music`, `jaliya tradition`.

**Bambuco** — added this session. Colombian Andean ancestor. Connected to: `guasca`, `carranga`, `folclor andino`.

### Network interactions
- Drag nodes · scroll to zoom · click node = opens genre overlay (slide up from bottom)
- Click edge = shows edge type tooltip (origin/subgenre) or influence panel with song list (influence)
- Clicking a node or edge dims everything else to 0.08 opacity — only the selected node + its immediate connections stay bright
- Hover temporarily overrides the dim
- Click SVG background to clear selection
- Genre search (top left) — autocomplete, zooms to node
- Legend (top right) — collapsible, cluster checkboxes with drag-to-toggle, edge type checkboxes with drag-to-toggle
- Opening node overlay closes edge panel and vice versa

---

## Genre Classification Philosophy

**Core principle:** Genre should reflect *sonic genealogy and genre lineage*, not cultural association labels. Instrument names or movement references are not genre descriptors.

**Genre naming convention:** `"X latino"` not `"latin X"` — e.g. `hip hop latino`, `rock latino`, `jazz latino`, `folk latino`.

**Singer-songwriter** was deleted as a genre — it describes a format/mode, not a sound. All tracks formerly tagged only as singer-songwriter were reassigned to their actual genres.

**Influence vs main genre logic:** When an artist has multiple genre tags, the *main genre* is what the music primarily *is*, and the *influence genre* is what it *draws from*. E.g. Bad Bunny is `reggaeton` (main) not a separate node for each genre tag.

**Val has deep knowledge of Latin American music** — particularly Argentine, Colombian, Mexican, Chilean, Uruguayan. Push back is expected and welcome on surface-level cultural tagging. The genre list has ~320 genres with particular depth in this area.

---

## Data Pipeline

### Original data
Exported CSVs from a closed Spotify account. Processed through Python scripts (`master_songs.py`, `enrich_country.py`, `fix_genres.py`, `fix_countries.py`, `genre_list.py`).

### CSV parsing note — IMPORTANT
The `master_playlist_enriched.csv` is saved with `QUOTE_ALL` (every field quoted). This is necessary because many fields contain commas (multi-artist names, playlist names, etc.). The `parseCSV` function in `network.js` handles this with a quoted-field parser — it strips quotes from header names with `.replace(/^"|"$/g, '')`. Do not change the CSV writing to anything other than `QUOTE_ALL` or the network will break silently (wrong column offsets → all Main Genre reads return empty).

---

## Changes Made This Session

### New columns added to master CSV
- `Main Genre` — single genre per track (replaces multi-value Genres for network purposes)
- `Influence Genre` — optional, one genre that influenced this specific track

### Genre system redesign
- Dropped `fusion` edge type entirely
- Three edge types now: `origin`, `subgenre`, `influence`
- `influence` edges are data-derived (from track tagging), not hand-curated
- `origin` and `subgenre` edges are hand-curated music history

### Nodes added (new this session)
World music cluster additions: `jaliya tradition`, `libyan reggae`, `moroccan funk`, `lebanese folk`, `arabic pop`, `tuareg music`, `chanson haïtienne`, `guinean ceremonial music`, `georgian polyphonic`, `eurasian folk`, `contemporary maloya`, `african diaspora`, `sahelian folk`

Genre additions: `dark folk`, `musical theater`, `dreamy folk`, `traditional folk`, `blue-eyed soul`, `british pop`, `chamber pop`, `soukous`, `shona mbira`, `anatolian rock`, `balkan`, `soul inspired`, `dreamy pop`, `country`, `mexican rock`, `j-rap`, `argentine rock`, `reggaeton chileno`, `tropical dub` (later retagged), `bullerengue`, `neo-classical`, `indie rock`, `indie pop`, `dream pop`, `shoegaze`, `alternative folk`, `klezmer`, `flamenco urbano`, `guasca`, `carranga`

Ancestor additions: `west african pentatonic`, `bambuco`

### Nodes removed (deleted or merged)
`singer-songwriter` (format, not genre), `bacardi`, `contemporary classic` (→ `contemporary classical`), `folk electronico` (→ `folk + electronic influence`), `ambient folk` (→ `dark folk`), `pop soul` (→ `soul`), `pop urbaine` (→ `hip hop`), `indie soul` (split by artist), `psychedelic pop` (→ `neo-psychedelic`), `house latino`, `tropical music`, `soca`, `tropical dub`, `popular colombian music`, `colombian pop`, `tropical bass`, `calypso`, `afrobeats latino`

### Key retagging decisions (notable ones)
- **Gorillaz** (instrumental tracks) → `experimental`
- **Bomba Estéreo** (psychedelic pop tracks) → `electrocumbia` + `neo-psychedelic` influence
- **Lido Pimienta** → `colombian experimental` (currulao origin + electronic influence)
- **Skinshape** → `psychedelic soul` (main body of work)
- **La Muchacha** → `folk latino`
- **LosPetitFellas** → `rock latino` + `hip hop latino` influence
- **DakhaBrakha** → `folk` + `ethnic caos` influence
- **Combo Chimbita** → `jazz latino` + `psychedelic rock` influence
- **Nómade Orquestra** → `jazz` + `psychedelic rock` influence
- **Vieux Farka Touré** → `tuareg music` + `blues` influence
- **Fairuz** → `arabic folk` (lebanese folk subgenre)
- **Arooj Aftab** → `qawwali` + `indie jazz` influence
- **Octavio Mesa** → `guasca`
- **Jorge Velosa** → `carranga`
- **Fruko y Sus Tesos**, **Guillermo Buitrago**, **Alejandro Durán** → `salsa`

### Edge cleanup (manual review)
117 empty influence edges (fusion-type orphans) were reviewed in a spreadsheet. Result:
- 46 kept as `origin`
- 28 kept as `subgenre`
- 26 deleted (no meaningful relationship)
- 15 had their direction flipped (edge was pointing the wrong way historically)

Notable flips: `art rock → alternative rock` (not the other way), `glam rock → punk`, `ambient → downtempo`, `ambient → electronica`, `jazz → city pop`, `doo-wop → soul`, `ebm → techno`, `industrial → techno`, `italo dance → eurodance`

### Network.js changes
- Persistent dimming on node/edge selection (opacity 0.08 for non-selected)
- Hover temporarily overrides dim, mouseout restores it
- Influence edge click → slide-up panel with song list (same animation as node overlay)
- Panel animates only on first open; switching between edges updates content in place
- Node overlay and edge panel are mutually exclusive
- Edge type filter in legend (drag-to-toggle checkboxes, same mechanic as cluster filter)
- CSV parser updated to handle `QUOTE_ALL` format (strip quotes from header names)
- `adj` variable hoisted to module scope so `applyDim` can access it
- `filterSongsRaw` exposed on window object for influence panel → left panel song list sync
- Song count now reads from `Main Genre` column (not `Genres`)

---

## Tools Built

### genre_editor.html
Browser tool for reviewing and bulk-editing genres artist-by-artist, with per-song override capability. Was used to clean up `latin alternative` tags and other problem genres.

### world_tagger.html
Browser tool for manually tagging ambiguous world music tracks. Shows tracks with pre-filled genre suggestions, autocomplete dropdown for all 319 genres, confirm/delete/skip per card, exports JSON for Claude to apply. Gets regenerated each session from the actual untagged tracks in the CSV (not static).

---

## Known Issues / Pending Work

### Still to do
1. **More genre cleanup** — there are still many genres in the `classical-experimental`, `caribe`, `andina`, and `rock` clusters that could be more precise. The zero-disconnected-nodes goal is achieved but not all tagging is ideal.
2. **Edge review for new world music nodes** — `jaliya tradition`, `sahelian folk`, `tuareg music`, `lebanese folk`, `georgian polyphonic`, `contemporary maloya` etc. are connected but lightly. Could use more edges as the map grows.
3. **Tidal + YouTube Music integration** — Tidal lacks an open API; periodic manual exports are most realistic. YouTube Music more feasible via `ytmusicapi` Python library.
4. **Genre network future features** — Val wants to eventually layer in multiple relationship types beyond the current three: mood/energy similarity, cultural moment, personal listening behavior as a distinct layer.

### Technical debt
- `parseCSV` in `network.js` is a custom quoted-field parser. If the CSV format changes, this needs updating.
- Language detection is country-based (via `countryLanguage` lookup in `app.js`), not actual language detection. Multi-language countries are simplified.
- `african-global-roots` is both a cluster name and was briefly used as a genre node — that confusion has been resolved but worth watching.

---

## Workflow

**Two modes of working:**
1. **File delivery** — Claude modifies data/code files, delivers updated versions for manual download and replacement in the project folder
2. **Browser tools** — Claude builds HTML tools (genre editor, world tagger) that Val uses directly in the browser to make decisions, then exports JSON back to Claude for batch application

**Genre decisions protocol:** For lesser-known or emerging artists, ask Val for context rather than guessing. For well-known commercial artists, Claude can tag confidently. For world/global music with specific regional traditions, always build a browser tool with suggestions pre-filled rather than applying decisions unilaterally.
