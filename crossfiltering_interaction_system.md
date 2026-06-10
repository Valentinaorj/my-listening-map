# My Listening Map — Interaction System

## Overview

The platform visualizes a personal music library of 2,196 songs through two coordinated views — a geographic bubble map and a force-directed genre network — alongside a persistent song table. All three update in real time as the user explores.

---

## Filter Architecture

Three independent filter dimensions stack simultaneously:

- **Country** (from the map)
- **Genre** (from the network)
- **Decade range** (from the slider)
- **Text search** (from the search bar)

The song table always reflects the intersection of all active filters. Each filter only owns its own dimension — clicking a map bubble never clears a genre selection, and vice versa.

---

## Cross-filtering Between Map and Network

The map and network dim each other based on the active selection.

**Country → Network:** clicking a map bubble dims all genre nodes that have zero songs from that country. The network titlebar updates to show how many genres exist in that country: *"40 genres in Colombia"*.

**Genre → Map:** clicking a genre node dims all country bubbles that have no songs in that genre. The map titlebar updates to show how many countries have songs in that genre: *"5 countries with folk latino songs"*.

**Stacked:** both filters can be active simultaneously. Selecting a country then a genre shows the intersection in the song table while each visual maintains its own dim state. The active node selection always takes visual priority in the network — a country dim will not overwrite a genre node selection.

**Decade range:** also participates in cross-filtering. Dragging the slider dims genres and countries that have no songs in the selected period, stacked on top of any active map or genre filter.

---

## Hover Behaviour

Both visuals share the same hover logic:

- **Hover a map bubble** → temporary dim of all other bubbles, tooltip appears showing country name and song count. Mouseout restores previous state.
- **Hover a network node** → temporary dim of all unconnected nodes and edges, tooltip shows genre name, cluster, and song count. Mouseout restores previous state.

Hover is always temporary. It overrides but never replaces the permanent filter state.

---

## Titlebars as Live Context

Each panel titlebar shows contextual information that recomputes on every interaction. Three dimensions feed the titlebars — country (map), genre (network), and decade range (slider) — so each panel has eight possible states depending on which combination is active.

**Map titlebar** (`updateMapStatus` in `app.js`):

| Active filters | Text shown |
|---|---|
| none | `81 countries` |
| decade only | `34 countries with 1970s – 1990s songs` |
| country only | `Colombia (47 songs)` |
| country + decade | `Colombia (47 songs) · 31 from 1970s – 1990s` |
| genre only | `5 countries with folk latino songs` |
| genre + decade | `5 countries with folk latino from 1970s – 1990s` |
| country + genre | `Colombia (47 songs) · 12 with folk latino` |
| country + genre + decade | `Colombia (47 songs) · 9 with folk latino from 1970s – 1990s` |

**Network titlebar** (`updateNetworkStatus` and `updateNetworkStatusForCountry` in `network.js`):

| Active filters | Text shown |
|---|---|
| none | `319 genres` |
| decade only | `120 genres with 1970s – 1990s songs` |
| country only | `40 genres in Colombia` |
| country + decade | `28 genres in Colombia from 1970s – 1990s` |
| genre node selected | `folk latino (175 songs)` |
| genre + decade | `folk latino (175 songs) · 88 from 1970s – 1990s` |
| genre + country | `folk latino (175 songs) · 12 in Colombia` |
| genre + country + decade | `folk latino (175 songs) · 9 in Colombia from 1970s – 1990s` |

The own-filter count always reflects the raw selection (e.g. `Colombia (47 songs)` is every Colombian song), while the trailing `·` segment reports the intersection with the other active dimensions — so the user sees both what each filter contains alone and how much survives the combination.

**Update routing.** A genre node selection takes priority: whenever a node is selected, both the country-release path and the decade-change path delegate back to `updateNetworkStatus(selectedNode)` so the node's titlebar recomputes against the current country and decade rather than being left stale. This delegation must exist in *both* the active-country branch and the released-country (`!country`) branch of `updateNetworkStatusForCountry` — omitting it from the release branch causes the titlebar to keep showing a released country (e.g. still reading `· N in UK` after the UK filter was cleared). Any change to the titlebar functions should be checked against all eight rows in each table above.

---

## Releasing Filters

Every filter has an explicit, predictable release path:

- **Map background click** → releases country filter only
- **Map reset button** → releases country filter only
- **Network background click** → blocked when a genre filter is active (prevents accidental deselection)
- **Network overlay close button** → releases genre filter, restores country dim if still active
- **Network reset button** → releases genre filter, re-applies country dim if still active
- **Reset all filters** (global header) → clears every filter simultaneously, recenters both visuals

When a filter is released, the other visual's dim state is preserved or restored correctly. Resetting one dimension never disrupts the other.

---

## Navigation History

Every filter interaction is captured as a snapshot of the full filter state (country + genre + decade range) and pushed onto a history stack. The back and forward arrows in the global header walk this stack step by step, restoring the complete filter state at each position — including repeated visits to the same state, which are preserved in visit order.

The history dropdown is a **deduplicated view** of that stack, not the stack itself. It renders each distinct state once, at the position of its most recent occurrence, most-recent first. Revisiting a state therefore moves its entry to the top of the dropdown list without adding a duplicate, while the underlying stack still records every visit so back/forward continue to walk the true sequence. The "current" highlight is matched by state, so the single dropdown entry is marked active even when the current stack position is an older occurrence of that same state.

Releasing all filters via **reset all** is itself a recorded state (the no-filter "all songs" snapshot), pushed and shown like any other. Reset does **not** clear the history — it returns the visuals to a clean state and records that as the latest step. The only constraints are the standard ones: a state identical to the current top of the stack is not pushed again, and each distinct state appears only once in the dropdown.

---

## Design Principles Behind These Decisions

**Filters stack, not replace.** The most useful queries are compound — *"what Colombian folk latino do I have?"* — and either visual should be a valid starting point for that question.

**Each visual owns its own filter.** Clicking a new country replaces the old country selection but leaves the genre selection untouched. This makes the system predictable: interactions in one panel never have surprise side effects in the other, except for the intentional cross-dim.

**Hover is never permanent.** The distinction between hover (temporary, exploratory) and click (persistent, filters the table) maps to a natural mental model. Hover lets you scan without committing.

**Visual state always reflects data state.** The background click block on the network was added specifically to prevent the dim from clearing while the filter was still active — a situation where what you see contradicts what the table shows. Consistency between visual and data state was treated as a hard requirement throughout.
