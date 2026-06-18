# CLAUDE.md — My Listening Map
## Rules for working on this codebase

### Data files
- `data/master_playlist_enriched.csv` — 2,196 tracks, 31 columns. Source of truth for all song data.
- `data/nodes.csv` — genre nodes. Columns: id, song_count, cluster
- `data/edges.csv` — genre relationships. Columns: source, target, type, weight

---

### Song → Node architecture (STRICT)
- Every song lives in exactly ONE node via the `Main Genre` column
- `Influence Genre` is optional and does NOT place a song in a node — it only informs edges
- song_count on each node must reflect actual songs in master_playlist_enriched.csv with that Main Genre
- Never split a song across multiple nodes

---

### Edge types (3 only)
- `origin` — one genre historically gave rise to another (e.g. blues → rock and roll)
- `subgenre` — one genre is a more specific form of another (e.g. ska → rocksteady)
- `influence` — cross-genre aesthetic borrowing, not lineage (e.g. jazz → bossa nova)
- Weight range: 0.35–1.0. Origin edges are highest (0.7–1.0), influence edges lowest (0.35–0.65)
- No fusion edge type — it was removed intentionally

---

### Genre naming conventions
- Format: `X latino` not `latin X` — e.g. `hip hop latino`, `rock latino`, `folk latino`
- Geographic modifiers only when sonically meaningful, not just artist nationality
- Instrument names and language names are NOT genre names
- Controlled vocabulary — do not invent new genre names without confirming with Val

---

### Cluster assignments
Existing clusters: rock, pop-indie, folk-singer-songwriter, electronic, jazz, soul-rnb-funk,
hip-hop, hip-hop-latino, rock-latino-espanol, cancion, andina, caribe, afro-sudamericano,
brasileira, african-global-roots, classical-experimental, ancestor

- `ancestor` = genres with 0 songs that exist only as structural origin nodes
- New nodes must be assigned to an existing cluster — do not create new clusters without asking

---

### Before editing any CSV
1. Read the file first and confirm what you see
2. State the changes you plan to make and wait for confirmation
3. Make the changes
4. Verify: check counts, check no orphaned edge endpoints, check no broken references

---

### song_count integrity
- After any genre rename or reclassification in master_playlist_enriched.csv,
  run a recount and update nodes.csv song_count to match
- Command to recount: python3 scripts/recount_nodes.py (create this if it doesn't exist)

---

### Never do without asking
- Create new clusters
- Delete edges that have actual songs behind them (check influence edges especially)
- Rename a genre that affects 10+ songs
- Add a node with a name that could be confused with an existing one