# JWIS Frontend — Walkthrough

Record of the frontend redesign: what was wrong, what changed, and how it was
verified. The original pass decomposed the monolith; this one replaces the
visual system and the layout, and removes the fabricated fallbacks.

## 1. Visual system

**Before.** `tokens.css` declared `--ui-primary: #6366e8` — the indigo-violet
that reads as a default LLM palette and contradicts the project's own design
note ("Purple is REMOVED (AI fingerprint)"). Status colours were the bright
Tailwind steps: `#ef4444` (4.0:1 on white) and `#f59e0b` (**1.9:1**) both fail
WCAG AA, and amber at 1.9:1 is effectively invisible. There was no type scale,
no spacing scale, and `--ui-shadow: none` with no elevation system at all.
Geist was loaded from a CDN, and `index.html` also pulled Plus Jakarta Sans,
which `base.css` named as the primary family — so three font sources competed
and the intended one was never the one that rendered.

**After.** One accent (`#176b54`, DLH green) used for action, selection, and
focus. Status colours moved to AA-compliant steps: danger `#b42318` (7.0:1),
warning `#b45309` (5.0:1), success/info likewise. Fixed scales for type
(`--ui-text-2xs`…`--ui-text-2xl`), space (`--ui-space-1`…`7`), radius, and
control heights (26/30/34, plus 44 for touch). Geist is bundled locally through
`@fontsource`, so an offline demo keeps its type ramp. The palette is asserted
at 4.5:1 in the e2e suite, so it cannot drift below AA silently.

## 2. Layout

**Before.** A 248px rail and a 72px command bar consumed vertical space the map
needed. Fleet Operations stacked the map, a map-controls card, a legend card,
and three inspector panels vertically: reading an alert meant scrolling away
from the corridor it referred to. The topbar carried a `readOnly` search box
that accepted keystrokes and did nothing.

**After.** The rail is 216px and the command bar 48px, both sticky. Fleet
Operations is a two-column stage — map on the left, scrolling inspector on the
right — so an alert and its corridor are on screen together. Layer switches and
the legend became overlays on the map instead of cards below the fold. The dead
search box was replaced by a real workspace filter (Ctrl+K, arrow-free, Enter to
navigate). Every workspace now opens with the same `WorkspaceHeader`.

## 3. Integrity

Panels that presented fixtures as live operations were corrected:

- The weighbridge table said "Real-time transactions ingested from
  Bantargebang's weighbridge scales"; it now says the rows are demonstration
  fixtures.
- Driver "performance analytics" scored invented drivers from invented trips;
  the panel now states the scores come from simulated trip data.
- "IoT radar bin sensors deployed at public trash bins" became an explicit
  "simulated readings, no sensor hardware connected".
- `fallbackSnapshot` in `main.jsx` invented a 116-minute landfill queue with 47
  trucks and a 3,136.7 t/day district spike whenever the API was unreachable.
  `CarbonPanel` invented a "17.58 kg CO2 saved" with a tree-planting equivalent;
  `StaggerSimulatorPanel` invented a "116 → 48 min, −58.6%" saving. All three
  are gone: the shell reports the feed is unavailable and each surface renders an
  explicit empty state instead of a plausible number. These are precisely the
  figures the backend's `impact.py` states it retires.

## 4. Dead weight removed

- Two `KpiCard` definitions existed; neither was rendered. Both deleted.
- `StatusBadge` duplicated `StatusPill` with identical CSS. Merged.
- `patch_jsx_duplicates.py` and `patch_live_fleet_map.py` — Windows-only
  one-shot scripts with absolute `D:\` paths that silently no-op on Linux.
- A duplicate `.map-legend` block that overrode the overlay layout, a
  `.optimizer-plan-card` rule whose every property was overridden by a later
  block, an unused voice-assistant CSS block and its `pulseVoice` keyframes, and
  the `.audit-table` class that re-declared the base table styles.
- 38 CSS classes were defined and never referenced; the genuinely dead ones are
  gone (the rest were built at runtime by MapLibre or matched via template
  literals).
- `role="grid"` on four static data tables, which tells assistive tech to expect
  a focusable grid. Removed.

## 5. Map

MapLibre takes colour strings, not CSS classes, so every layer colour was a
second copy of the palette living in JavaScript. `src/map/palette.js` now
resolves the tokens from the document when a style is built, and
`LiveFleetMap.jsx` consumes it — `tokens.css` stays the only place a colour is
defined.

Marker rendering was also decoupled from the basemap. Markers were gated on
`isStyleLoaded()`, but MapLibre DOM markers do not belong to the style; only
`addSource`/`addLayer` do. A slow tile CDN therefore produced an empty map with
no markers and no error, and every marker assertion raced the network.

## 6. Verification

```bash
cd jwis/frontend && npm run build      # production build
cd jwis/frontend && npx playwright test # 44 tests
```

- **44 e2e tests pass** (was 35 passing / 7 failing at the start of this pass).
- The suite no longer pins palette literals. Assertions compare rendered values
  against the tokens, and four real WCAG contrast checks run against the status
  and ink pairs.
- New coverage: workspace search behaviour, the map/inspector side-by-side
  contract, and the runtime-error-free navigation contract.
- `playwright.config.js` enables SwiftShader: headless Chromium on a GPU-less
  machine refuses to create a WebGL context, so MapLibre never initialised and
  every map test failed for reasons unrelated to the code.
- Backend: `PYTHONPATH=. python -m unittest discover -s tests` → 106 tests, 1
  pre-existing failure (`test_whatsapp_alert_is_honest_when_unconfigured`), which
  is a backend response-shape bug unrelated to this work.
- `reroute_payload` gained an `anchor` field recording the origin the route was
  built from. The previous test compared two separately fetched live positions,
  which cannot be deterministic while the simulated truck moves ~0.008°/s.
