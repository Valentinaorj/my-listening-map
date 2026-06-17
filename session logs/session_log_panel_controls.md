# My Listening Map — Panel Controls Session Log
*Documents all changes made in this session: viz panel expand/collapse, draggable column resizer, decade minimize, song row action buttons, and accessibility tooltip*

---

## Why This Session Happened

The two-column layout established in the previous session worked well but offered no flexibility. The map and network always split the left column at a fixed ratio, the songs column was always 420px wide, and there was no way to give more space to a viz you were actively exploring without the other one competing for room. This session added user control over all of those dimensions.

Separately, the songs table already had a YouTube play button per row (added in a prior session). This session extended the row actions with a copy button and proper accessibility tooltips for both.

---

## Goals Defined

- The map and network panels should be independently expandable/collapsible, with the other panel responding symmetrically
- The songs column width should be draggable from its left edge
- The decades slider should be collapsible to reclaim vertical space in the songs column
- Song rows should have a copy button that puts the track name and artist on the clipboard
- Both row action buttons should have accessible labels and a visible tooltip on hover

---

## Viz Panel Expand / Collapse

### The state machine

The left column has exactly three valid states, managed by CSS classes on `#viz-column`:

| State | Map panel | Network panel |
|---|---|---|
| `normal` (default) | `flex: 1` | `flex: 1.2` |
| `map-maximized` | `flex: 1` (fills all) | `flex: 0 0 25px` (titlebar only) |
| `network-maximized` | `flex: 0 0 25px` (titlebar only) | `flex: 1` (fills all) |

When a panel is collapsed to `flex: 0 0 25px`, only its titlebar remains visible — its content is hidden by `overflow: hidden`. The titlebar stays accessible so the user can read its label and click the restore button.

### Win98 window controls

Three buttons were added to each viz panel titlebar: `−` (minimize) · `❐` (restore) · `□` (maximize). These mirror the classic Windows 98 window control pattern.

The buttons are **symmetric and mutually exclusive**:

- `□` on map → map maximized, network collapses to titlebar
- `□` on network → network maximized, map collapses to titlebar
- `−` on map → map collapses, network maximizes (same result as `□` on network)
- `−` on network → network collapses, map maximizes (same result as `□` on map)
- `❐` on either → both panels return to normal ratio

This means pressing any button always has a well-defined outcome regardless of which panel you're looking at. There is no ambiguous state.

### Button disabled states

`setVizState(newState)` updates disabled attributes on all six buttons every time the state changes:

- In `normal`: both `❐` buttons are disabled (already restored)
- In `map-maximized`: map's `□` is disabled (already maximized), network's `−` is disabled (already minimized)
- In `network-maximized`: network's `□` is disabled, map's `−` is disabled

Disabled buttons get `opacity: 0.3` and no hover effect. This gives the user clear feedback about which actions are available.

### Leaflet invalidation

When the state changes, Leaflet needs to recalculate the map container's dimensions. `setVizState` calls `window._leafletMap.invalidateSize()` after a 50ms timeout — the delay allows the CSS flex transition to begin before the map redraws, preventing a brief render at the wrong size.

### Network panel styling

The network titlebar has a dark background (`#1a1a1a`) with green text (`#00ff88`). The win ctrl buttons inside it inherit this theme via dedicated CSS overrides: transparent background, green stroke color, green hover state at low opacity.

---

## Decades Minimize

The decades slider at the bottom of the songs column has two states, independent of the viz panel states:

- **Normal**: slider body visible (default)
- **Minimized**: `#decade-slider-wrap` hidden via `.minimized` class on `#decade-filter`; only the coral header bar remains

Two buttons on the header: `−` (minimize) and `❐` (restore). The restore button starts disabled since the panel opens in normal state. No maximize — the slider has no meaningful expanded state beyond what it already shows.

This is intentionally simpler than the viz panel controls. Two states, one panel, no cross-panel coordination needed.

---

## Draggable Column Resizer

### What it is

A `<div id="col-resizer">` sits between `#viz-column` and `#songs-column` in the HTML. It is 5px wide, shows a `col-resize` cursor on hover, and turns solid black while dragging.

### How it works

On `mousedown` on the resizer:
1. A `mousemove` listener on `document` tracks cursor position
2. The songs column width is recalculated as `viewport width − cursor X position` — since the songs column is on the right, this is its natural width from the cursor to the right edge
3. Width is clamped between **260px** (minimum usable table width) and **60% of viewport** (prevents the songs column from swallowing the viz panels)
4. `songs-column.style.width` is updated directly on every `mousemove`
5. On `mouseup`, `_leafletMap.invalidateSize()` is called so the map redraws correctly in its new space

### Why this doesn't conflict with expand/collapse

The left column (`#viz-column`) uses `flex: 1` — it always fills whatever horizontal space remains after the songs column takes its share. Resizing the songs column simply shifts how much horizontal space the left column gets. The vertical expand/collapse logic inside `#viz-column` is entirely independent and unaffected.

### Cursor management during drag

`document.body.style.cursor = 'col-resize'` is set on drag start and cleared on mouse up. This prevents the cursor from flickering back to the default arrow when the mouse briefly moves faster than the DOM can update — a standard pattern for drag interactions.

---

## Song Row Action Buttons

### Copy button

A copy button was added to each song row, sitting to the left of the existing YouTube play button, inside the title cell. It is hidden by default and appears on row hover (same logic as the play button).

On click it copies `Track Name — Artist Name(s)` to the clipboard using `navigator.clipboard.writeText()`, with a `document.execCommand('copy')` fallback for older browsers.

The text is stored in a `data-copy` attribute on the button. HTML entities inserted by the `esc()` helper are decoded via a temporary `<textarea>` before writing to clipboard, so the user gets plain text without `&amp;` or `&quot;`.

A **copy toast** (`#copy-toast`) appears near the cursor for 1.5 seconds confirming the action. It is `position: fixed`, styled with the double border and VT323 font matching the rest of the aesthetic.

### SVG icon

The copy button uses an inline SVG of two overlapping squares — the standard copy metaphor. It is defined once as a `COPY_ICON` constant at the top of `app.js` and concatenated into the button HTML in both row builders (`renderTable` and `filterSongsRaw`).

The SVG uses `stroke="currentColor"` so it inherits the button's text color automatically — cream on the black row hover state, black on the mint button hover state — with no extra CSS needed.

### Event delegation

All row button interactions (click for copy, mouseover/mouseout for tooltip) use a single delegated listener on `#songs-tbody` rather than attaching individual listeners to each of the ~2,200 rows. The handler uses `e.target.closest('.copy-btn')` and `e.target.closest('.copy-btn, .yt-play-btn')` to identify which button was interacted with. This is the correct pattern for dynamically rendered lists — it stays performant regardless of how many rows are visible, and survives table re-renders without needing to re-attach listeners.

---

## Accessibility Tooltips

### The problem with `::after`

The first implementation used a CSS `::after` pseudo-element on `.copy-btn` to show a tooltip on hover, reading from `aria-label` via `content: attr(aria-label)`. This failed silently because `overflow: hidden` on `#songs-table td` clips all pseudo-element content that extends outside the cell bounds. The tooltip rendered but was immediately cut off — invisible to the user.

### The solution: fixed-position JS tooltip

A `<div id="btn-tooltip">` sits at the bottom of `index.html`, `position: fixed`, outside the entire overflow stack. `showBtnTooltip(text, x, y)` positions it near the cursor using `clientX / clientY`, then fires after a **1-second delay** via `setTimeout`. `hideBtnTooltip()` cancels the timer and removes the `.visible` class immediately on mouse leave.

The 1-second delay prevents the tooltip from flashing on quick cursor passes — it only appears for deliberate hovers.

### Why `aria-label` is still the right attribute

Even though the tooltip is now JS-driven, `aria-label` remains on the buttons as the source of truth for the tooltip text. This serves two purposes:

1. Screen readers announce it as the button's accessible name (essential since the button has no visible text label — just an SVG icon)
2. `showBtnTooltip` reads it via `btn.getAttribute('aria-label')`, so the display text and the accessible name are always in sync from a single declaration

### Suppressing the native browser tooltip

The title cells have `title="Song Name"` for ellipsis overflow context. This propagates to child elements, causing the browser's native tooltip to appear over the buttons and blocking the custom one. Adding `title=""` on each button explicitly clears the inherited value for that element only, without affecting the `<td>` title elsewhere.

### Both buttons share the same tooltip system

The `mouseover`/`mouseout` delegation covers both `.copy-btn` and `.yt-play-btn` with a single selector string: `e.target.closest('.copy-btn, .yt-play-btn')`. Each button has its own `aria-label` (`"copy song and artist"` and `"open in youtube"` respectively), so the same handler shows the right text for whichever button is hovered.

---

## Design Decisions

**Why the panel states are mutually exclusive**
Allowing both panels to be maximized simultaneously would create a contradiction — there is only one left column, and it can't give its full height to two panels at once. Three states (normal, map-maximized, network-maximized) cover every meaningful configuration without ambiguity.

**Why the collapsed panel stays visible as a titlebar**
Hiding the panel entirely would make it harder to restore — the user would have no visible affordance to click. Keeping the titlebar visible also shows which panel is collapsed without requiring the user to remember. It mirrors the classic Win98 behavior of minimizing to a taskbar entry.

**Why the resizer computes width as `viewport − cursorX` rather than tracking a delta**
Delta-based dragging (tracking how far the cursor moved since last event) can drift over time if events are missed or throttled. Computing the absolute width from cursor position on every event is stateless and always correct — the column width is exactly what the cursor position implies.

**Why a dedicated `#btn-tooltip` div instead of reusing `#copy-toast`**
The copy toast is tied to a specific action (clipboard write confirmed) and has a fixed 1.5s auto-dismiss. The button tooltip is tied to hover state and must disappear instantly on mouse leave. Merging them into one element would require tracking which mode it's in. Separate elements are cleaner and allow each to be styled and timed independently.

**Why inline SVG for the copy icon**
Icon fonts (Font Awesome, etc.) have rendering inconsistencies and accessibility quirks. Unicode glyphs (like the `⊞` originally used) render differently across OSes and browsers. A short inline SVG is the current industry standard for UI icons: crisp at any size, consistent everywhere, and `currentColor` makes it participate in CSS color transitions for free.

---

## Files Changed This Session

- `index.html` — win ctrl buttons on map/network titlebars, win ctrl buttons on decades header, `#col-resizer` div between columns, `#copy-toast` div, `#btn-tooltip` div
- `style.css` — viz panel state classes (`.map-maximized`, `.network-maximized`), network titlebar dark theme overrides for ctrl buttons, `#col-resizer` styles, `.minimized` state for decade filter, `.copy-btn` SVG sizing, `#btn-tooltip` fixed-position styles, removed dead `::after` tooltip block
- `app.js` — `COPY_ICON` SVG constant, `showCopyToast` and `showBtnTooltip`/`hideBtnTooltip` helpers, `setVizState` and `setDecadeState` functions, column resizer drag logic, delegated copy click + tooltip hover listeners on `#songs-tbody`
