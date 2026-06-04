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

Each panel titlebar shows contextual information that updates with every interaction:

| Panel | At rest | With own filter | With other panel's filter |
|---|---|---|---|
| Map | `81 countries` | `Colombia (47 songs)` | `5 countries with folk latino songs` |
| Network | `319 genres · 490 connections` | `folk latino (175 songs · 8 connections)` | `40 genres in Colombia` |

The counts always reflect the raw selection — not the intersection — so the user always knows what each filter alone contains.

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

Every filter interaction is pushed onto a history stack. The back and forward arrows in the global header walk through this history, restoring both the map and network filter state at each step. Reset all clears the history entirely.

---

## Design Principles Behind These Decisions

**Filters stack, not replace.** The most useful queries are compound — *"what Colombian folk latino do I have?"* — and either visual should be a valid starting point for that question.

**Each visual owns its own filter.** Clicking a new country replaces the old country selection but leaves the genre selection untouched. This makes the system predictable: interactions in one panel never have surprise side effects in the other, except for the intentional cross-dim.

**Hover is never permanent.** The distinction between hover (temporary, exploratory) and click (persistent, filters the table) maps to a natural mental model. Hover lets you scan without committing.

**Visual state always reflects data state.** The background click block on the network was added specifically to prevent the dim from clearing while the filter was still active — a situation where what you see contradicts what the table shows. Consistency between visual and data state was treated as a hard requirement throughout.
