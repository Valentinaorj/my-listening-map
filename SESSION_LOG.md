# SESSION_LOG.md
## My Listening Map — valentinaorj.github.io/my-listening-map
## Last updated: 2026-04-09

---

## PROJECT OVERVIEW

Personal music dashboard built from exported Spotify CSVs.
Stack: HTML/CSS/JS frontend, Python for data cleaning.
Libraries: Chart.js, Leaflet, PapaParse, D3.js.
Design: Windows 98 / Y2K aesthetic, pastel panels, fixed taskbar.
Repo: valentinaorj.github.io/my-listening-map

---

## FILES

| File | Description |
|------|-------------|
| `data/master_playlist_enriched.csv` | Main data — 2,201 tracks, 31 columns |
| `data/master_playlist_original.csv` | Original Spotify export — 2,202 tracks, 27 columns (reference only) |
| `data/nodes.csv` | Genre nodes with cluster assignments |
| `data/edges.csv` | Genre relationships (3 types: origin, subgenre, influence) |
| `app.js` | Charts + filtering |
| `network.js` | D3 force-directed genre graph |
| `genre-editor.html` | Artist-by-artist genre review tool |
| `scripts/master_songs.py` | |
| `scripts/enrich_country.py` | |
| `scripts/fix_genres.py` | |
| `scripts/fix_countries.py` | |
| `scripts/genre_list.py` | |

---

## DATA TRANSFORMATION SUMMARY
### Original → Enriched

**Track count:** 2,202 → 2,201 (1 duplicate removed)

**New columns added (4):**
- `Artist Country` — 90 unique countries represented
- `Artist Continent` — America, Europe, Asia, Africa, Oceania
- `Main Genre` — single primary genre per song (clean, controlled vocabulary)
- `Influence Genre` — secondary genre influences (optional, controlled vocabulary)

**The genre cleanup — the core work:**

| Metric | Original | Enriched |
|--------|----------|----------|
| Unique genre strings | 754 | 305 (294 main + 47 influence) |
| Songs with no genre | 474 | **5** |
| Songs with 5+ genre tags | 194 | 0 (architecture changed) |
| Songs with multiple Main Genres | — | 0 (enforced 1 main genre per song) |

The original data used Spotify's raw genre tags — comma-separated strings like
`"alternative rock,indie"` or `"argentine rock,latin rock,rock en español,latin alternative,murga"`.
These were messy, redundant, inconsistently named, and Spotify-generated (not curated).

The enriched file replaces all of that with:
- One **Main Genre** per song (from a controlled ~294-term vocabulary)
- One optional **Influence Genre** per song (from ~47 terms)

This is not just a rename — it's a full re-taxonomy based on sonic genealogy.

---

## GENRE ARCHITECTURE DECISIONS

### Naming convention (locked)
- Format: `X latino` not `latin X`
  - `hip hop latino`, `rock latino`, `pop latino`, `ska latino`, `folk latino`, etc.
- `latin alternative` — being handled as a special case, manually reviewed artist by artist
- Geographic modifiers are only used when they signal something **sonically distinct**,
  not merely the artist's nationality
- Instrument names and language names are NOT genre descriptors
  (e.g. Shona is a language, Mbira is an instrument — `shona mbira` node name needs review)

### Edge types (3 only — fusion removed)
- **origin** → solid lines
- **subgenre** → dashed lines
- **influence** → dotted lines

"Influence"-suffixed node names (e.g. `reggae influence`) were collapsed into
proper `influence` edge-type entries.

---

## GENRE TAXONOMY — FULL PICTURE

### Top 40 Main Genres by song count
| Genre | Songs |
|-------|-------|
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
| contemporary classical | 24 |
| pop latino | 24 |
| indie rock | 23 |
| jazz | 23 |
| jangle pop | 21 |
| classic rock | 20 |
| garage rock | 19 |
| soul | 19 |
| r&b | 18 |
| cumbia | 16 |
| trova | 16 |
| downtempo | 16 |
| ska | 16 |
| proto-punk | 16 |
| nu jazz | 16 |
| canzone napoletana | 16 |
| city pop | 15 |
| hard rock | 15 |
| electronic | 15 |
| baroque pop | 14 |
| art rock | 14 |
| classical | 14 |
| cancion protesta | 14 |
| chicha | 13 |
| punk | 13 |

### Latin American / Latinx genres (full breakdown)
| Genre | Songs |
|-------|-------|
| folk latino | 175 |
| rock latino | 107 |
| electrocumbia | 68 |
| hip hop latino | 48 |
| bolero | 28 |
| pop latino | 24 |
| cumbia | 16 |
| trova | 16 |
| cancion protesta | 14 |
| chicha | 13 |
| son cubano | 11 |
| folclor andino | 11 |
| candombe | 11 |
| jazz latino | 10 |
| murga | 7 |
| merengue | 6 |
| nueva trova | 6 |
| bullerengue | 6 |
| currulao | 6 |
| cumbia sonidera | 6 |
| vallenato | 4 |
| son jarocho | 3 |
| ska latino | 3 |
| electronica latina | 2 |
| mambo | 2 |
| cumbia pop | 1 |
| indie latino | 1 |
| punk latino | 1 |
| cuarteto | 1 |
| reggaeton chileno | 1 |
| guasca | 1 |
| carranga | 1 |
| porro | 1 |
| r&b latino | 1 |
| bachata | 1 |
| latin alternative | 1 ← STILL TO CLEAN |

### World / regional / niche genres
| Genre | Songs |
|-------|-------|
| canzone napoletana | 16 |
| city pop | 15 |
| folk español | 14 |
| chanson | 11 |
| rumba flamenca | 5 |
| african folk | 4 |
| bossa nova | 4 |
| samba | 4 |
| lebanese folk | 4 |
| shibuya-kei | 3 |
| mpb | 2 |
| brasileira | 2 |
| jaliya tradition | 2 |
| flamenco urbano | 2 |
| sahelian folk | 2 |
| galician folk | 2 |
| j-r&b | 2 |
| anatolian rock | 2 |
| j-rap | 1 |
| afro funk | 1 |
| afro folk | 1 |
| soukous | 1 |
| shona mbira | 1 ← FLAG: see note below |
| flamenco pop | 1 |
| libyan reggae | 1 |
| moroccan funk | 1 |
| balkan | 1 |
| tuareg music | 1 |
| chanson haïtienne | 1 |
| guinean ceremonial music | 1 |
| african percussion | 1 |
| georgian polyphonic | 1 |
| eurasian folk | 1 |
| contemporary maloya | 1 |
| african diaspora | 1 |
| forró | 1 |
| tuvan | 1 |
| kayokyoku | 1 |
| gqom | 1 |
| klezmer | 1 |
| j-rock | 1 |
| c-pop | 1 |

### Influence genres (all 47)
jazz (17), folk (15), hip hop latino (15), hip hop (12), r&b (10), electronic (9),
blues (7), cancion protesta (7), ambient (7), swing music (6), funk (6),
avant-garde (6), reggae (6), alternative rock (5), afrobeat (4), experimental (4),
soul (4), african folk (3), neo-psychedelic (3), shoegaze (3), chanson (3),
dreamy pop (2), samba (2), avant garde (2), bossa nova (2), cumbia (2),
soul inspired (2), americana (2), psychedelic rock (2), folk español (2),
dark folk (2), europop (2), anatolian rock (2), dreamy folk (1), pop (1),
baroque pop (1), alternative pop (1), arabic pop (1), reggae rock (1),
african percussion (1), eurasian folk (1), african diaspora (1), indie jazz (1),
bolero (1), traditional folk (1), chamber pop (1), rock (1)

---

## NODES — STATUS

### Added
- `dark folk`
- `musical theater`
- `soukous`
- `shona mbira` ⚠️ FLAG — Shona is a language, Mbira is an instrument.
  Was pushed back on during musicology session. Needs renaming —
  candidates: `chimurenga`, `mbira music`, or ask Val.

### Merged / dissolved
- `contemporary classic` → merged into `contemporary classical`
- `folk electrónico` → reclassified as `folk` (main) + `electronic` (influence edge)
- `ambient folk` → reclassified as `dark folk` (main) + `ambient` (influence edge)
- `pop soul` → redistributed per-artist across `soul`, `hip hop`, `alternative pop`, `folk`
- `pop urbaine` → redistributed per-artist
- `indie soul` → redistributed per-artist

### Artist-specific reclassifications (confirmed)
- **Bacardi** → `pop latino` (main) + `funk` (influence)
- Other artists from `pop soul` / `pop urbaine` / `indie soul` cleanup:
  ⚠️ Exact artist list not fully recoverable — check Excel review sheet from that session.

---

## EDGES — STATUS

### Architecture
- Audited 116 orphaned influence edges (former fusion edges)
  - **15 flipped** (direction reversed)
  - **26 deleted**
  - Remainder reclassified as `origin` or `subgenre`
- ⚠️ Specific edge pairs from that audit: source of truth is the Excel review sheet.
  Recommend saving it as `data/edge_audit_log.xlsx` in the repo.

### Rule
- Personal influence edges (backed by actual track data) are **never deleted**.

---

## GEOGRAPHIC DATA

**90 countries represented. Top 20:**
United States (496), United Kingdom (436), Colombia (223), Argentina (149),
France (124), Mexico (95), Spain (94), Germany (82), Italy (59), Canada (48),
Chile (43), Japan (42), Uruguay (41), Puerto Rico (32), Australia (29),
Brazil (24), Cuba (20), Peru (18), Sweden (18), Austria (18)

**Continents:** America (1,034), Europe (804), Asia (61), Africa (49), Oceania (30)

**Known data issues:**
- `XE` continent code appearing (5 songs) — likely a script artifact, needs cleaning
- `Unknown` continent (4 songs) — needs country lookup
- Duplicate continent values (e.g. `America; America`) from multi-artist rows —
  display logic handles this but underlying data could be cleaned

---

## DECADE DISTRIBUTION

| Decade | Songs |
|--------|-------|
| 1930s | 2 |
| 1950s | 22 |
| 1960s | 71 |
| 1970s | 175 |
| 1980s | 95 |
| 1990s | 211 |
| 2000s | 354 |
| 2010s | 890 |
| 2020s | 376 |

---

## CHARTS IMPLEMENTED

- [x] Decades bar chart
- [x] Leaflet bubble map (uses `countryCoordinates` object ~150 countries,
      splits Artist Country by `"; "`)
- [x] Genres treemap (top 30) — to be replaced by D3 network
- [x] Audio radar (6 features)
- [x] Languages donut

---

## NETWORK.JS — FEATURES IMPLEMENTED

- [x] D3 force-directed graph with 3 edge types (origin, subgenre, influence)
- [x] Influence edge click → slide-up panel listing songs that embody that connection
- [x] Node and edge panels mutually exclusive (opening one closes other with animation)
- [x] Persistent dimming on selection — selected node/edge + immediate connections at full opacity
- [x] Edge type filtering — drag-to-toggle checkboxes (same mechanic as cluster filtering)
- [x] Influence panel: slides in on first open, updates in place for subsequent switches

---

## BUGS FIXED

- [x] `QUOTE_ALL` CSV formatting caused JS CSV parser to misread column headers
      → broke node sizing and all filtering
- [x] `var obj` not declared in `parseCSV`

---

## KNOWN FLAGS / OPEN QUESTIONS

- [ ] `shona mbira` node name — needs renaming (Shona = language, Mbira = instrument)
- [ ] 5 songs with completely empty rows (no artist, no track, no genre) — check if these
      are real rows or CSV artifacts
- [ ] `XE` continent code in 5 rows — investigate and clean
- [ ] `latin alternative` — 1 song still tagged with it in enriched CSV, check if intentional
- [ ] `avant garde` vs `avant-garde` — both exist as influence genres, should be unified

---

## GENRE CLEANUP PASSES

| Pass | Status |
|------|--------|
| `latin X` → `X latino` bulk rename | ✅ Done |
| `rock en español` → `rock latino` | ✅ Done |
| `latin alternative` artist-by-artist pass | 🔄 ~57 artists remaining |
| No-genre pass (474 → 5 remaining) | ✅ Nearly complete |
| Other problem genres | ⬜ Not started |

---

## ON THE HORIZON

1. **Finish `latin alternative` pass** — ~57 artists in genre-editor.html
2. **Clean remaining 5 empty-genre songs**
3. **Replace treemap with D3 genre network** — dark bg, glowing nodes sized by count,
   3 edge types rendered distinctly. Multiple relationship layers planned:
   - Historical/musicological lineage
   - Mood/energy similarity
   - Sonic texture
   - Cultural moment
   - Personal listening behavior (distinct layer)
4. **Tidal integration** — no open API, periodic manual exports most realistic
5. **YouTube Music** — `ytmusicapi` Python library, more feasible

---

## WORKING PRINCIPLES (do not lose)

- Genre = sonic genealogy, not cultural association labels
- Geographic modifiers only when sonically meaningful, not just artist nationality
- Instrument names / language names are NOT genre descriptors
- Personal influence edges backed by track data are never deleted
- Manual review before any bulk edit to source files
- When unsure about a lesser-known artist, ask Val — don't guess
- When doing genre classification: order genres from most to least accurate
