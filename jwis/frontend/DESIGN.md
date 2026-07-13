# JWIS Dashboard — Design System

Operational command dashboard (data-dense, not marketing). Taste lane: restrained,
professional, evidence-first. Codifies existing tokens + the redesign upgrades.

## 0. Design read
Operational B2B dashboard for DLH Jakarta operators. Vibe: calm, authoritative,
government-grade. Aesthetic family: neutral utilitarian with ONE green accent (no
purple, no AI-gradient). Reference discipline: `taste-skill` (dashboards).

## 1. Color
Single accent = green (DLH environmental identity). Purple is REMOVED (AI fingerprint).
- `--green` #176b54 (primary accent, actions)
- `--green-strong` #0f4d3b (hover/pressed)
- `--green-soft` #e7f2ee (tint surfaces, KPI icon bg)
- `--red` #b42318 / `--red-soft` #fbeae7 (violations/critical only)
- `--amber` #b45309 / `--amber-soft` #fdf1e3 (warnings only)
- Neutrals (one cool-gray family, no warm/cool mix):
  - `--bg` #eef2f6, `--surface` #ffffff, `--surface-soft` #f6f9fb
  - `--ink` #10202b (headings), `--text` #26323d (body), `--text-muted` #5b6a78
  - `--border` #dbe3ea (hairline), `--border-strong` #c6d2dc
- Semantic status = red/amber/green only. Charts use green ramp, never purple.

## 2. Typography
- Display/UI: **Geist** (var font) → fallback system. Replaces Inter (AI default).
- Mono/data: **Geist Mono** for all numbers (tabular figures) — tonnage, wait mins, %.
- Scale: h1 clamp(26px,3.2vw,38px)/-0.02em tight; h2 16px/600; body 14px/1.5.
- Numbers use `font-variant-numeric: tabular-nums` in data cells + KPI values.
- Sentence case for section titles (no Title Case). Labels: 12px uppercase, muted.

## 3. Spacing & layout
- 4px base. Panel padding 20px. Grid gap 16px. Section rhythm 20px.
- 12-col grid; panels align to it. Consistent min-heights per row band.
- max-width container ~1440px. Radius: containers 12px, inner elements 8px.

## 4. Elevation
- Tinted shadow (green-cool hue, not pure black): `0 12px 30px rgba(15,40,32,.06)`.
- Cards: hairline border + soft shadow. Hover lifts translateY(-1px) + shadow bump.
- One consistent light source (top). No random dark section in the light page.

## 5. Primitives
- `.kpi` — icon + label + tabular value + helper. 4-up desktop.
- `.panel` / `.panel.wide` — titled surface, hairline border, tinted shadow.
- `.pill` — status chip (green/amber/red tints). Square-ish radius 6px.
- `.primary-button` — green, 8px radius, hover lift + press scale(0.98).
- Data table — tabular-nums, zebra-free, hairline row separators.

## 6. Motion
- 180ms ease on interactive elements. Press = scale(0.98). GPU only (transform/opacity).
- No decorative motion. Motion only signals interaction/state.

## 7. Accessibility
- Focus ring: 3px green @25% opacity, 2px offset. Min tap 44px.
- Contrast: text #26323d on white ≥ AA. Status never color-only (icon + label).

## 8. Accepted debt
- Map panel renders blank if MapLibre tiles fail (network) — needs empty/fallback state.
- Geist loaded via CDN font; offline demo falls back to system font (acceptable).
