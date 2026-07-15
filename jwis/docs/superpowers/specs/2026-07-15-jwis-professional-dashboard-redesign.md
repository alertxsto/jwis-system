# JWIS Professional Dashboard Redesign

**Date:** 2026-07-15  
**Status:** Approved direction, pending written-spec review

## Objective

Redesign the complete JWIS frontend into a coherent professional operations product. Use the supplied SaaSAble screenshots as the full visual-language reference for app-shell structure, spacing, typography, borders, tabs, metric strips, tables, charts, toolbars, and information density. Do not copy its branding, logo, people, content, or source code.

The redesign must preserve all working JWIS functionality and backend contracts. It must not replace React, Vite, MapLibre, or Lucide.

## Design Read

Product dashboard for DLH operators and competition judges, with an authoritative, restrained, evidence-first visual language. The reference is translated into a public-infrastructure operations product rather than a generic SaaS admin template.

Design dials:

- design variance: 3/10;
- motion intensity: 2/10;
- visual density: 7/10.

## Visual System

### Composition

- Fixed light sidebar with compact grouped navigation.
- Slim white topbar with breadcrumb, freshness state, simulation indicator, field-app access, and operator menu.
- Neutral page canvas with white operational surfaces.
- Thin cool-gray borders, restrained shadows, and 6-8px radii.
- Consistent 4/8px spacing rhythm and compact 36-40px controls.
- No decorative gradients, glass effects, giant headings, nested cards, or ornamental motion.

### Color

The reference's light indigo/lavender selection language is used for navigation selection, tabs, focus rings, and selected rows. It must not dominate the full application. JWIS green remains the identity and primary-action color. Red, amber, cyan, and green are reserved for operational semantics such as violations, warnings, routes, and compliance.

Every text/background combination must meet WCAG 2.2 AA contrast. Status cannot rely on color alone.

### Typography

Use one professional sans-serif family throughout. UI headings use a compact fixed scale; body text remains 13-14px; tables and metadata remain readable at 12-13px. Typography must not scale with viewport width. Letter spacing is zero except where an existing logo asset requires otherwise.

### Component Vocabulary

Standardize buttons, icon buttons, segmented controls, tabs, inputs, selects, toggles, status badges, tooltips, tables, metric cells, alerts, skeletons, empty states, and error states. Every interactive component requires default, hover, focus, active, disabled, and loading behavior.

Lucide icons are used for familiar actions. Text buttons remain for explicit commands such as approve, dispatch, run simulation, and export.

## Information Architecture

The current long dashboard becomes three persistent workspaces:

1. **Fleet Operations** for Case 1.
2. **Waste Forecast** for Case 2.
3. **Integrated Planning** for cross-case optimization.

The sidebar switches workspaces without losing the selected truck or current scenario during the session. Secondary content within a workspace uses tabs or contextual panels, not a single vertical stream of unrelated sections.

## Fleet Operations

Fleet Operations opens by default because route monitoring and live-map evidence are the strongest prototype interaction.

Layout:

- compact metric strip across the top;
- large map-led operational workspace;
- fleet/alert inspector beside the map on desktop and below it on narrow screens;
- contextual decision drawer for the selected truck;
- lower tabbed surface for fleet table, trip history, queue, route evidence, and carbon impact.

Selecting a truck synchronizes marker focus, assigned and actual paths, route deviation, A* recommendation, vehicle metadata, and action controls. Traffic simulation and route-layer controls remain attached to the map workflow instead of living in unrelated cards.

## Waste Forecast

Layout:

- metric strip for forecast horizon, highest spike, resources, and data freshness;
- one dominant forecast chart;
- weather and event drivers in a supporting column;
- segmented controls for horizon and scenario;
- ranked operational table for district/kecamatan demand and facility readiness;
- contextual resource panel for crews, trucks, bins, and man-hours.

Scenario controls update the chart, ranking, and resource panel as one coordinated workspace. Forecast provenance and model fallback status stay visible.

## Integrated Planning

Use a three-stage decision flow:

1. scenario inputs and constraints;
2. optimizer recommendation and assignments;
3. evidence, unmet constraints, approval, and dispatch.

Permit, ETA, queue, capacity, weather, and demand evidence must be scannable without opening nested cards. Approval is unavailable while critical constraints remain unmet, and the interface explains why.

## Login And Field App

The login page adopts the same typography, controls, borders, and brand tokens without becoming a marketing hero. The field app receives the same status vocabulary and action styles, optimized for touch targets and narrow screens.

## Responsive Behavior

- Wide desktop: persistent sidebar and map inspector.
- Laptop: compact sidebar and narrower inspector.
- Tablet: collapsible sidebar; map remains primary.
- Mobile: workspace navigation becomes a compact menu; panels stack; tables use deliberate horizontal scrolling or responsive row layouts; map controls and legend cannot occlude the active route.

No text may overflow, overlap, or become unreadable at supported widths.

## Architecture Boundaries

Split the existing frontend monolith by responsibility while preserving behavior:

- app shell and navigation;
- shared design-system primitives;
- Fleet Operations workspace;
- Waste Forecast workspace;
- Integrated Planning workspace;
- existing map renderer;
- API hooks and data-state utilities.

`LiveFleetMap` retains map lifecycle and layer rendering only. Workspace controls, evidence, and decision panels live outside the map component. No backend endpoint or payload is changed solely for visual redesign.

## State And Failure Handling

- Initial loading uses layout-preserving skeletons.
- Partial endpoint failures affect only the owning surface.
- Error states identify the failed source and provide a retry action.
- Empty states explain the required next action.
- Cached, simulated, modeled, live-external, and stale data remain distinguishable.
- Destructive or dispatch actions retain explicit confirmation behavior.

## Verification

Testing is staged to avoid Codex desktop instability:

1. component and utility tests;
2. frontend production build and TypeScript diagnostics;
3. backend contract regression tests;
4. headless Playwright with one worker and no in-app browser;
5. numeric map assertions for feature geometry, bounds, and marker/route synchronization;
6. one final desktop and mobile visual review outside the in-app browser.

Required acceptance checks:

- all existing user actions remain reachable;
- no workspace renders as one long unstructured page;
- selected navigation, tabs, filters, and rows have consistent states;
- map remains usable with controls and inspector present;
- loading, error, empty, stale, and disabled states are visible and accessible;
- keyboard navigation and WCAG AA contrast pass;
- no console errors, React warnings, clipped text, or incoherent overlap;
- existing backend and browser workflow tests remain green.

## Out Of Scope

- Backend algorithms and data-model changes.
- Replacing MapLibre or routing services.
- Proposal and prototype-video content.
- Copying proprietary assets or code from the supplied template.
