# JWIS Dashboard - Design System

Operational command dashboard for DLH Jakarta. This is not a landing page and not a
decorative analytics mockup. The interface must feel like a professional dispatch,
forecasting, and evidence-review product.

Primary visual reference:
`https://styles.refero.design/style/47cb86b6-cb2d-41c8-94ba-8607cd7c41cd`

## 0. Design Read

JWIS is a data-dense operations dashboard used under time pressure. Judges should
immediately understand that this is a serious public-sector logistics system:
structured, calm, readable, and evidence-first.

Design direction:
- Minimal white dashboard shell.
- Thin borders, generous whitespace, restrained shadow.
- Clear left navigation, top command bar, and content canvas.
- One accent color only.
- No decorative gradients, no marketing hero, no oversized empty cards.
- English UI copy only, except official institution names and proper nouns.

## 1. Refero Composition Contract

The reference style works because the hierarchy is strict. JWIS must follow the
same ordering:

1. Fixed sidebar: navigation first, not decoration.
2. Top bar: breadcrumb/search/actions/profile; compact and quiet.
3. Page title row: one clear title, optional small action group.
4. KPI strip: single horizontal row, equal-height cells, no nested cards.
5. Primary work surface: the widest and most important content.
6. Secondary evidence rail: narrower support panels on the right.
7. Tables/logs: full-width operational detail after the decision surface.

Never let secondary cards become taller or visually heavier than the primary
surface. If a panel has a lot of text, make it wider or move it below the main
decision row; do not let it become a long hanging column.

## 2. Color

The current target is Refero-like light product UI adapted for JWIS:

- Canvas: `#f8f8f6`
- Surface: `#ffffff`
- Muted surface: `#efeeeb`
- Ink: `#121212`
- Body text: `#3f3f3f`
- Muted text: `#777777`
- Hairline border: `#e7e4de`
- Accent: `#d97757`
- Success: `#15803d`
- Warning: `#b45309`
- Critical: `#b42318`

Rules:
- Accent is for selected nav, primary buttons, active tabs, and key chart lines.
- Status colors are semantic only.
- Do not use purple/blue as the dominant product accent.
- Do not use gradients for text, panels, or buttons.

## 3. Typography Hierarchy

Product UI needs a tight, predictable scale. No fluid type for dashboard text.

| Role | Size | Weight | Usage |
| --- | ---: | ---: | --- |
| Page title | 28px | 650 | Main workspace title only |
| Section title | 20px | 600 | Main panel headings |
| Panel title | 16px | 600 | Card/table/list titles |
| KPI value | 24px | 650 | Metric values |
| Table body | 14px | 450 | Rows and dense data |
| Body copy | 14px | 450 | Descriptions and summaries |
| UI label | 12px | 600 | Labels, chips, metadata |
| Microcopy | 12px | 450 | Helper text |

Rules:
- Titles must always be visually larger than their content.
- Data values use tabular numbers.
- Labels are short and muted.
- Buttons use 14px/600.
- Avoid Title Case except names, official labels, and navigation items.

## 4. Layout Grid

Base rhythm:
- Page padding: 24px desktop, 16px tablet/mobile.
- Main content max width: none inside the app shell; use the available canvas.
- Gap: 16px inside workspace rows.
- Panel padding: 20px.
- Radius: 14px for major surfaces, 8px for controls.
- Border: 1px solid hairline.

Dashboard rows:
- KPI strip: 4 columns desktop, 2 tablet, 1 mobile.
- Main operational row: 8/3 or 7/5 split depending on content.
- Evidence rail: 320-420px target width.
- Full-width tables/logs must sit below the main operational row.

Do not create equal card grids for unrelated content. Data importance decides
width, not component convenience.

## 5. Surface Rules

Use surfaces deliberately:

- App shell: sidebar + topbar are structural, not cards.
- KPI strip: one joined surface with internal dividers.
- Main map/forecast/planning panels: large surfaces.
- Repeated records: small bordered rows inside a surface.
- Tables: one surface, no card per row.

Banned:
- Card inside card.
- Random standalone cards with different padding/radius.
- Long single-column cards when the content should be a table or two-column row.
- Panel headings smaller than body text.
- Mixed Indonesian/English UI copy.

## 6. Buttons and Controls

Button vocabulary:
- Primary: filled accent, 8px radius, 40px height.
- Secondary: white surface, hairline border, 40px height.
- Ghost/icon: transparent, 36-40px square.
- Danger: only for destructive actions.

Control rules:
- Same radius, height, and font across filters, tabs, inputs, and buttons.
- Disabled/loading state must keep layout stable.
- Never use oversized full-width buttons unless it is the single primary action
  of that panel.

## 7. Page Composition Maps

### Fleet Operations

Order:
1. KPI strip: active trucks, route efficiency, queue delay, coverage.
2. Live map: dominant full-width or 8/4 split with inspector.
3. Route evidence: selected vehicle, planned route, wrong-route alert.
4. Operational table: vehicles, drivers, status, latest event.

Map must be the visual anchor. Tables and evidence support the map, not the other
way around.

### Waste Forecast

Order:
1. KPI strip: forecast spike, high-risk districts, peak rainfall, readiness.
2. Main row:
   - Left 70-75%: district forecast grid/table.
   - Right 25-30%: weather risk, event driver, planning note.
3. AI/report tools below the forecast row.

The district list must not create a long left column while the right rail is short.
If the list grows, use a scrollable table or two-column compact records with a
fixed max height.

### Integrated Planning

Order:
1. Scenario inputs: compact left/control column.
2. Recommended plan: dominant center column with preflight metrics, generated plan,
   route assignments, crew/truck changes, and handoff actions.
3. Evidence and approval: right rail with executive summary and decision authority.

The recommended plan column must never be blank. Before generation, show a
preflight plan preview and expected outputs.

### Driver Analytics

Order:
1. KPI strip.
2. Trend/score chart.
3. Driver table with risk reasons and recommended coaching.

### Weighbridge Logs

Order:
1. KPI strip.
2. Filter/search row.
3. Full-width table.
4. Anomaly/evidence rail only if a row is selected.

Opening this page must never show a blank white workspace.

## 8. Responsive Behavior

Desktop:
- Sidebar fixed at 248px.
- Topbar fixed height.
- Workspace grid uses full remaining width.

Tablet:
- Sidebar may collapse.
- Main/evidence split becomes 1 column when evidence would be under 300px.

Mobile:
- Sidebar becomes drawer/bottom entry.
- KPI strip becomes stacked.
- Tables become horizontally scrollable, not broken card stacks unless specifically
  designed as mobile records.

## 9. Acceptance Checklist

Every UI pass must satisfy:
- Page title larger than all panel titles.
- Panel titles larger than body text.
- KPI values are visually dominant but not oversized.
- Primary content is the widest panel in the first decision row.
- Secondary evidence does not hang lower than the primary panel without purpose.
- No card-inside-card.
- No mixed Indonesian/English UI labels.
- No blank workspace pages.
- Data-loaded state is validated before screenshot approval.
- Desktop and mobile screenshots are checked before calling it complete.
