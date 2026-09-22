# -*- coding: utf-8 -*-
"""
deviation_state.py — alert hysteresis for corridor deviation (Case 1).

detect_route_deviation is intentionally stateless. Live dashboards, however,
must not flicker an alert off when a GPS ping briefly drifts under the
threshold while the truck is still mid-detour. This module adds the standard
monitoring-system latch: an alert OPENS above 500 m and only CLEARS once the
truck returns within 50 m of its corridor (its normal loop start clears it).
Both fleet surfaces (_truck and map_truth) share this one latch so panels
never disagree.
"""
from __future__ import annotations

OPEN_THRESHOLD_M = 500.0
CLEAR_THRESHOLD_M = 50.0

_states: dict[str, bool] = {}


def apply_hysteresis(truck_code: str, distance_m: float) -> bool:
    """Latched violation state for a truck: open >=500m, clear <=50m, else hold."""
    state = _states.get(truck_code, False)
    if distance_m >= OPEN_THRESHOLD_M:
        state = True
    elif distance_m <= CLEAR_THRESHOLD_M:
        state = False
    _states[truck_code] = state
    return state


def reset_hysteresis() -> None:
    _states.clear()
