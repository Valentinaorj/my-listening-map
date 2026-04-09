---

Here is the prompt:

---

We are doing a musicology review session on my personal music taste dashboard **My Listening Map** (valentinaorjuela.github.io/my-listening-map). The project visualizes 2,196 songs exported from a closed Spotify account as a D3 force-directed genre network graph, plus a Leaflet map, decade chart, and audio radar.

**You have access to the project files** in the current context: `master_playlist_enriched.csv` (31 columns including `Main Genre` and `Influence Genre`), `nodes.csv` (id, song_count, cluster), `edges.csv` (source, target, type, weight), and `project_summary.md`. Read these before answering anything — you already have the data I'm visualizing.

---

## What we do in these sessions

I ask about genre relationships. You research each question, synthesize musicology with what's actually in the CSV, and give a **verdict** — a final, concrete answer on how nodes and edges should be set up, formatted as Claude Code input. No hedge, no over-explanation. One question at a time, we go deep.

**Format of your answer:**
1. Brief research summary with nuance (what the genre actually is, where it came from, how it relates to adjacent genres)
2. Check what's currently in the CSVs (nodes, edges, songs behind them)
3. Final verdict as explicit Claude Code instructions

---

## Hard rules — follow these exactly

**On nodes:**
- No empty nodes unless they are a true structural ancestor: a broad concept that multiple existing song-nodes need as a common root
- Ancestor nodes must be **broad mechanisms or traditions**, not named genres, specific artists, or historically bounded movements. Good examples: `african percussion`, `european immigrant music`, `west african pentatonic`. Bad examples: `chimurenga` (one artist, one decade), `ethnic caos` (one band's self-coined label)
- A node that only connects to one other node does not qualify as an ancestor
- Never create a new cluster — use existing ones only
- Never rename a genre affecting 10+ songs without explicit confirmation

**On edges:**
- Three types only: `origin` (historical lineage), `subgenre` (more specific form of), `influence` (cross-genre aesthetic borrowing)
- No `fusion` type — it was removed intentionally
- Weight range: origin 0.7–1.0, subgenre 0.7–0.9, influence 0.35–0.65
- No bidirectional edges stating the same relationship twice — pick a direction and delete the redundant one
- Every node should ideally have at least one origin edge if that origin already exists in the network
- Direction matters: if genre A gave rise to genre B, the edge is `A → B`, not `B → A`

**On song classification:**
- Every song lives in exactly one node via `Main Genre`
- `Influence Genre` is optional and does not place a song in a node — it only informs influence edges
- Spotify genre tags are unreliable — verify against actual artist/song research before accepting them
- Artist country in the CSV can also be wrong — flag and correct when found

**On genre philosophy:**
- Genre = sonic genealogy and lineage, not cultural association or nationality
- Instrument names are not genre names
- Geographic modifiers only when sonically meaningful, not just because the artist is from that country
- Naming convention: `X latino` not `latin X` — e.g. `hip hop latino`, `rock latino`, `folk latino`

---

## Suggested focus for this session: `rock` cluster

The `rock` cluster is the largest in the network: **51 nodes, 465 songs**. It likely has the most floating nodes, misdirected edges, and genre tagging errors of any cluster. Good candidates to investigate: the relationship between `classic rock`, `art rock`, `progressive rock`, `psychedelic rock`, and their actual origins; whether `blues rock` edges are correctly directed; any nodes that belong in `rock` but are misclassified elsewhere or vice versa; and whether any rock subgenre nodes are empty or near-empty and should be dissolved.

Other clusters worth considering if you want something different:
- `soul-rnb-funk` (26 nodes, 138 songs) — lots of overlapping genre names that may be redundant
- `electronic` (33 nodes, 132 songs) — likely has floating nodes with weak or missing origin edges
- `folk-singer-songwriter` (29 nodes, 173 songs) — may have the eurasian folk / balkan / georgian polyphonic edges to clean up following last session's work
- `jazz` (24 nodes, 144 songs) — ethiopian jazz now has 9 songs and may need edge review; city pop edges have been flagged before

---

## What I will tell you

I'll ask about specific genre relationships, flag things that look wrong visually in the network, and give you context on artists when the genre is niche or ambiguous — especially for Latin American music where I have deep knowledge and will push back on surface-level tagging.

Start by reading the project files, then ask me which cluster or theme I want to focus on, or begin directly if I've already indicated one.