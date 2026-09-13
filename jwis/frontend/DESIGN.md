# JWIS Dashboard — Design System

Operational console for the Dinas Lingkungan Hidup command centre. Data-dense,
evidence-first, and deliberately plain: this is an instrument, not a marketing
page.

`src/styles/tokens.css` is the single source of truth. This document explains
the reasoning behind those values; when the two disagree, the tokens win.

## 0. Design read

- **User:** a DLH dispatcher on a laptop, watching 42 kecamatan and a small fleet.
- **Job:** notice a problem, understand it, act on it — without leaving the screen.
- **Tone:** calm, authoritative, government-grade.
- **Dials:** design variance 3/10 · motion intensity 2/10 · visual density 7/10.

The failure mode this system is built to avoid is the generic admin template:
an indigo accent, a decorative search box, cards nested in cards, status colours
that fail contrast on white, and numbers that do not line up. Each rule below
exists to prevent one of those.

## 1. Colour

**One accent: DLH green.** It marks the primary action, the current navigation
item, and keyboard focus — nothing else. It is not a gradient and not a
decorative wash.

| Role | Token | Value | Notes |
|---|---|---|---|
| Primary / accent | `--ui-primary` | `#176b54` | 5.6:1 on white; white on it is also 5.6:1 |
| Hover / pressed | `--ui-primary-hover` · `--ui-primary-active` | `#12563f` · `#0d4230` | |
| Accent tint | `--ui-accent-soft` · `--ui-accent-line` | `#e8f2ee` · `#bcd8ce` | selection fills |
| Danger | `--ui-danger` | `#b42318` | 7.0:1 — violations, critical only |
| Warning | `--ui-warning` | `#b45309` | 5.0:1 — warnings only |
| Success | `--ui-success` | `#176b54` | 5.6:1 |
| Info | `--ui-info` | `#0e6e88` | external/live sources |

Status colours are the dark, AA-compliant steps — not the bright palette
defaults. `#ef4444` (4.0:1) and `#f59e0b` (**1.9:1**) both fail WCAG AA on
white, and amber at 1.9:1 is close to invisible. Each semantic tone ships with a
`-soft` fill and a `-line` border so a badge reads as one object.

Neutrals are a single cool-grey family (`--ui-ink` → `--ui-ink-2` →
`--ui-muted` → `--ui-muted-soft`) over `--ui-canvas` / `--ui-surface` /
`--ui-surface-muted` / `--ui-surface-sunken`. No warm greys are mixed in.

Data visualisation uses `--ui-viz-1..6`, ordered so the ramp stays separable in
greyscale — a monochrome print of the dashboard still ranks correctly.

**Status is never carried by colour alone.** Every badge, marker, and dot is
rendered beside the word that states its meaning.

## 2. Typography

- **UI:** Geist Sans, bundled locally via `@fontsource` (not a CDN, so an
  offline demo keeps its type ramp).
- **Numerals:** Geist Mono with `tabular-nums`. Every tonnage, wait time,
  percentage, and coordinate is set in it, so a column does not shimmer when a
  value refreshes.
- **Scale:** fixed steps `--ui-text-2xs` (10.5) → `--ui-text-2xl` (22). Type does
  **not** scale with viewport width: a console that reflows its own density
  between a 1280 and a 1920 monitor is a console you cannot learn.
- Sentence case everywhere. Labels are uppercase at 10.5px with 0.05em tracking
  and are reserved for metric captions and table headers.

## 3. Space and shape

- 4px base: `--ui-space-1` (4) → `--ui-space-7` (32). Every gap and pad is one of
  these seven values; there are no magic 14px steps.
- Radii: `--ui-radius-inner` 3 · `--ui-radius-control` 5 · `--ui-radius` 6 ·
  `--ui-radius-surface` 8. Controls read as instruments; surfaces read as
  furniture.
- Control heights: `--ui-control-sm` 26 · `--ui-control` 30 · `--ui-control-lg`
  34, so a toolbar button, a table header, and a panel action share a baseline.
- `--ui-touch` 44 is used **only** in the field app and in the mobile drawer,
  where a thumb replaces a mouse.

## 4. Elevation

The console is flat. `--ui-shadow` is `none` and panels carry a hairline border
instead, so hierarchy comes from type and rules rather than stacked drop shadows.
`--ui-shadow-raised` is for a single lifted element (a popup, a select menu) and
`--ui-shadow-overlay` for true overlays. There is one light source.

## 5. Layout

- Navigation rail: `--ui-sidebar-width` 216px, sticky, its own scroll. It fits
  the longest real label without truncation and gives the map the rest.
- Command bar: `--ui-topbar-height` 48px, sticky. It holds navigation context and
  global actions only — anything workspace-specific belongs in the workspace
  header.
- Canvas: `--ui-canvas-max` 1680px, centred.
- Each workspace opens with `WorkspaceHeader`: title, one sentence of what the
  screen is for, and the controls that scope it.

## 6. Primitives

`src/styles/components.css` holds one definition per component:

- `.panel` / `.panel-title` — a titled surface. Panels never nest; use a section
  or a tab strip instead.
- `.metric-strip` / `.metric-cell` — one instrument row. Values are mono and
  tabular.
- `.pill` — the single status primitive (success / warning / danger / live /
  neutral).
- `.primary-button`, `.ghost-button`, `.danger-button`, `.icon-button`,
  `.text-button` — content-width by default. Forms opt into full-bleed
  explicitly, which is why there is no global `width: 100%`.
- `.table-wrap` — the horizontal scroll container for wide tables. The `<table>`
  itself carries no styling variant.

## 7. Motion

140ms on a single easing curve (`--ui-ease`), on colour and border changes.
Pressing an action moves it 1px; nothing scales. Motion only ever signals a state
change, and `prefers-reduced-motion` disables all of it.

## 8. Accessibility

- Focus: two-tone ring (`--ui-focus`) that survives both white surfaces and
  green fills. Only shown for `:focus-visible`, so a mouse click leaves no ring.
- Contrast: every text/background pair in the system is measured against WCAG
  2.2 AA, and `e2e/dashboard-shell.spec.js` asserts the status and ink pairs at
  4.5:1 so the palette cannot drift below it silently.
- Touch targets are 44px wherever a finger is the input device.
- The mobile drawer traps focus, marks the background `inert`, and restores focus
  to its trigger on close.

## 9. Known limits

- The map needs a WebGL context. Headless Chromium without a GPU refuses to
  create one, which is why `playwright.config.js` enables SwiftShader; on a
  machine where that is unavailable the map area renders blank rather than
  showing an error state.
- MapLibre takes colour strings, not classes, so map paint values are resolved
  from the tokens at runtime by `src/map/palette.js` rather than being declared
  a second time in JavaScript.
