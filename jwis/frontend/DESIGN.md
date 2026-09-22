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
- Deep forest command rail with a light operational canvas.
- Compact top context bar; page purpose and decision context remain visible.
- One primary action per screen; evidence and secondary controls recede.
- Flat joined metric strips instead of repeated KPI card grids.
- Orange is the only product accent; status colors remain semantic.
- No decorative gradients, marketing hero inside the app, or oversized empty cards.
- Indonesian is the default operator language; English remains available through the global switch.
## 1. Command-Center Composition Contract

Hierarchy is task-first:

1. Persistent command rail: five role-relevant workspaces.
2. Compact context bar: current workspace, language, assistant, operator.
3. Workspace heading: purpose and operational freshness.
4. Joined metric strip: scan context, not four competing cards.
5. Primary decision surface: map, district demand, plan, table, or registry.
6. Decision rail: one problem and one action, or supporting evidence.
7. Detail records: tabs/tables below the decision surface.

Secondary evidence must never compete with the primary task. On narrow screens,
the decision rail moves before the primary surface when an urgent action exists.
Fixed bottom navigation replaces a compressed desktop sidebar on mobile.

## 2. Color

The redesign uses a civic operations palette:

- Canvas: `#f2f5f3`
- Surface: `#ffffff`
- Muted surface: `#e9eeeb`
- Command rail: `#13211d`
- Ink: `#14201c`
- Body text: `#33443e`
- Muted text: `#65746e`
- Hairline border: `#dce3df`
- Accent: `#e85d32`
- Success: `#177a57`
- Warning: `#b76516`
- Critical: `#c43d39`

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

- Page padding: 24px desktop, 16px tablet/mobile.
- Command rail: 232px desktop.
- Main canvas: fluid up to 1600px.
- Gap: 16px between operational surfaces.
- Surface padding: 22px desktop, 16px mobile.
- Radius: 12px major surfaces, 8px controls.
- Border: 1px hairline; shadows reserved for overlays and mobile task cards.

Dashboard rows:
- Metrics: one joined 4-cell strip desktop, 2×2 mobile.
- Fleet: map/decision split at roughly 70/30.
- Forecast: demand/context split at roughly 70/30.
- Planning: scenario/allocation split, approval full-width below.
- Audit: registry/evidence split.

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
1. Workspace purpose and automatic-refresh state.
2. Joined operational metrics.
3. Live map / priority decision split.
4. Collapsible map controls and operational context.
5. Evidence tabs and records below.

The map anchors the screen; the dark decision rail contains exactly one urgent
problem and one primary action.

### Waste Forecast

Order:
1. Workspace purpose, horizon, and report action.
2. Joined forecast metrics.
3. District demand surface / weather-event context split.
4. Model evidence below.

District demand stays primary. Permit and facility context share the remaining
space rather than creating a long stack. Secondary panels become two columns on
tablet and one column on mobile.

### Integrated Planning

Order:
1. Visible three-step progress: scenario, allocation, approval.
2. Scenario and allocation surfaces side-by-side on desktop.
3. Approval summary and authority evidence below.

The allocation surface must never be blank. Before generation it shows demand,
fleet need, TPA queue, and a plain-language explanation of the next action.

### Driver Analytics

Order:
1. KPI strip.
2. Trend/score chart.
3. Driver table with risk reasons and recommended coaching.

### Data & Model Audit

Order:
1. Evidence-readiness metric strip.
2. Data provenance registry as the primary surface.
3. Supported resolution and model-suitability evidence rail.
4. Export/report actions after the evidence, not before it.

Opening this page must never show a blank white workspace.

## 8. Responsive Behavior

Desktop:
- Command rail fixed at 232px.
- Context bar remains sticky.
- Primary/evidence splits use the full remaining canvas.

Tablet:
- Command rail becomes a fixed bottom workspace navigator.
- Primary/evidence splits become one column.
- Supporting panels may use two columns when each remains at least 280px.

Mobile:
- Fixed five-item bottom navigation.
- Priority action appears before the map.
- Metrics become a 2×2 joined strip.
- Tables scroll horizontally; field and supervisor routes use dedicated layouts.

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
