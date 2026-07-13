# JWIS System Impact Evaluation

_Auto-generated contract via `app/impact.py` and `GET /api/impact`. Every metric
below is labeled by classification. NONE represent observed field impact — a live
DLH pilot is required to produce observed metrics._

## Metric classifications

- **simulated** — output of a seeded engine (e.g. discrete-event queue simulation).
- **derived** — computed from geometry/logic (e.g. route deviation distance).
- **modeled** — from the trained forecast model evaluation.
- **reference** — an engineering constant/factor, not a measured saving.

## Metrics

| Metric | Unit | Baseline | JWIS | Classification | Source |
|---|---|---|---|---|---|
| TPA wait reduction | percent | peak-hour crowding | staggered arrivals | simulated | seeded queue simulation |
| Route deviation detection | meters | waypoint-only (false positives) | point-to-polyline | derived | engine geometry suite |
| Forecast hotspot rank | Spearman ρ | 0.0 | 0.998 | modeled | multi-resolution evaluation |
| Fuel per ton | L/ton | 1.8 | 1.8 | reference | engineering factor |

## Removed unsupported claims

The previous fixed "58.6% wait reduction", fixed carbon savings, and
"25 adult trees" equivalence have been removed from leadership outputs. Wait
reduction now comes from the reproducible queue simulation and varies with the
scenario. Carbon/fuel figures are labeled reference factors, not measured
savings.

## To produce OBSERVED impact

Run the eight-week DLH pilot (see `docs/pilot/PILOT_PLAN.md`) and compare
pre/post metrics on real operations. Only then may any figure be presented as
observed field impact.
