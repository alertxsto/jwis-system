# -*- coding: utf-8 -*-
"""Single source of geospatial truth for the JWIS map.

Composes, per truck, the raw GPS, OSRM-snapped GPS, road-following assigned and
actual routes, meter-based deviation, traffic, permit, and provenance labels.
The frontend renders this payload verbatim — no client-side geometry guessing.
Simulated inputs are labeled; nothing here is presented as live telemetry.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, cast

from app.data import ASSIGNED_PATHS, ACTUAL_PATHS
from app.engine import distance_point_to_polyline_m
from app.gps_feed import latest_breadcrumbs
from app.osrm import road_route, snap_to_road

DEVIATION_THRESHOLD_M = 500.0


def build_map_truth(truck: dict[str, Any]) -> dict[str, Any]:
    """Assemble the one-payload geospatial truth for a single truck."""
    code = truck["truck_code"]
    pos = truck["latest_position"]
    raw = {"lat": pos["lat"], "lng": pos["lng"]}

    snap = snap_to_road(raw["lat"], raw["lng"])
    snapped = snap["snapped"]

    assigned_pts = ASSIGNED_PATHS.get(code, [])
    actual_pts = ACTUAL_PATHS.get(code, [])
    assigned_route = road_route(assigned_pts) if assigned_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}
    actual_route = road_route(actual_pts) if actual_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}

    # Meter deviation of snapped position vs assigned road geometry (point-to-segment).
    geom = cast(list[dict[str, float]], assigned_route.get("geometry") or [])
    if geom:
        assigned_line = [(p["lat"], p["lng"]) for p in geom]
    else:
        assigned_line = [(la, ln) for la, ln in assigned_pts]
    deviation_m = (distance_point_to_polyline_m((snapped["lat"], snapped["lng"]), assigned_line)
                   if assigned_line else 0.0)
    violated = deviation_m > DEVIATION_THRESHOLD_M

    breadcrumbs = latest_breadcrumbs(code)
    return {
        "truck_code": code,
        "raw_gps": raw,
        "snapped_gps": snapped,
        "raw_breadcrumbs": [{"lat": b.lat, "lng": b.lng, "timestamp": b.timestamp} for b in breadcrumbs],
        "assigned_route": assigned_route,
        "actual_route": actual_route,
        "deviation_m": round(float(deviation_m), 1),
        "deviation_segments": ["violation"] if violated else [],
        "recommendation": ("Redirect to assigned corridor." if violated else "On corridor; no action."),
        "traffic": {"jam_active": False, "source": "SIMULATED CONGESTION"},
        "permit": {"source": "SIMULATED PERMIT CONSTRAINT"},
        "provenance": {
            "raw_gps": "RAW_GPS_SIMULATED",
            "snapped_gps": snap["source"],
            "assigned_route": assigned_route["source"],
            "actual_route": actual_route["source"],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
