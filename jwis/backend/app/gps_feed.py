# -*- coding: utf-8 -*-
"""GPS breadcrumb pipeline for JWIS fleet.

Produces timestamped position trails per truck. The trail currently walks each
truck along its assigned corridor as a SIMULATED feed — clearly labeled
`source="simulated"`. The contract (GpsBreadcrumb + latest_breadcrumbs) is
identical to what a real DLH AVL/GPS feed would provide, so swapping in real
telemetry at pilot requires no downstream change: replace the body of
`latest_breadcrumbs` with the AVL reader and keep the same return type.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.data import ASSIGNED_PATHS, ACTUAL_PATHS


@dataclass(frozen=True)
class GpsBreadcrumb:
    truck_code: str
    lat: float
    lng: float
    timestamp: str
    speed_kmh: float
    source: str = "simulated"


def latest_breadcrumbs(truck_code: str, points: int = 6,
                       interval_seconds: int = 120) -> list[GpsBreadcrumb]:
    """Timestamped trail for a truck along its assigned corridor (simulated).

    Emits `points` breadcrumbs ending "now", spaced `interval_seconds` apart,
    walking the assigned path geometry. Returns [] for unknown trucks.
    """
    # Trail follows the truck's ACTUAL movement (deviation path); falls back to
    # the assigned corridor only when no actual track exists.
    path = ACTUAL_PATHS.get(truck_code) or ASSIGNED_PATHS.get(truck_code)
    if not path:
        return []

    now = datetime.now(timezone.utc)
    n = min(points, len(path))
    step = max(1, len(path) // n)
    sampled = path[::step][:n] or [path[0]]

    trail: list[GpsBreadcrumb] = []
    count = len(sampled)
    for i, (lat, lng) in enumerate(sampled):
        ts = now - timedelta(seconds=interval_seconds * (count - 1 - i))
        trail.append(GpsBreadcrumb(
            truck_code=truck_code,
            lat=round(lat, 6),
            lng=round(lng, 6),
            timestamp=ts.isoformat(),
            speed_kmh=round(18 + (i % 3) * 6, 1),
            source="simulated",
        ))
    return trail
