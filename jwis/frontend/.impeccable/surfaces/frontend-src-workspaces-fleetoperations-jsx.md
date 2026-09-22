---
version: 1
slug: "frontend-src-workspaces-fleetoperations-jsx"
primary_target: "frontend/src/workspaces/FleetOperations.jsx"
related_targets: ["frontend/src/LiveFleetMap.jsx","frontend/src/workspaces/ActionCard.jsx"]
---

# Surface brief — Fleet Operations (Armada)

Scope: the Armada workspace (FleetOperations.jsx, LiveFleetMap, ActionCard, evidence tabs, fleet table, TPA queue, SPJ/damage/history/carbon surfaces). Visitor mode: Operate. Audience: DLH command-center dispatcher on shift and competition judges; task is triage of live disruptions and dispatch of a route/instruction.

## Direction contract

THESIS: The map is the desk. Everything the operator needs to decide sits on or immediately beside the live map — never in a separate drawer, rail, or buried tab. Refuses the split-grid template (map panel + static side card + detached controls) that fleet dashboards always ship.

OWN-WORLD: Inherits JWIS civic-operations identity — deep forest command rail, light operational canvas, single orange accent, semantic status colors, Indonesian-first copy. Composition is new: full-bleed operational canvas with floating instrument layers, not boxed panels.

STORY: Operator opens Armada, sees the whole city's fleet state and the one problem that matters most, acts on it from the map itself, then drills into evidence. Nothing requires remembering which of eight tabs holds an answer.

FIRST VIEWPORT: Metric strip compressed into a thin status bar across the top of the workspace. Below it the map fills the remaining viewport height edge to edge. Map controls (search, layers, basemap, fit) are pinned inside the map's own top edge. A problem strip sits directly under the status bar as chips (deviasi, kerusakan, antrean TPA); clicking a chip filters the map and focuses the worst item. When a problem is active, one decision card floats over the map's right edge with full context and the single primary action. Clicking any truck marker or table row retargets that card.

FORM: Operate mode, restrained color, structural motion only (overlay enter/exit, map focus, sheet drag). Decision card is an instrument panel layered on the map, not a card in a grid.

MEMORABLE MOMENT: The decision overlay retargeting live as you click trucks on the map — the map and the action visibly one system.

SEED KEY: 9d49c75c (roll dealt indices 4, 5, 3; user locked the map-led command deck as `pick`).
