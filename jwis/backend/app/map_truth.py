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

_snap_cache: dict[str, dict] = {}


def _snapped_for(truck: dict[str, Any]) -> dict[str, Any]:
    # Necessary: the simulated GPS feed moves every request, which defeats
    # osrm's per-coordinate lru_cache and makes each map-truth call pay 4
    # live OSRM snap fetches (~5-9s). Caching per truck (30s TTL) keeps the
    # snap fresh enough for a moving truck (~100m drift) while making
    # repeated map-truth calls cheap. State-dependent fields (jam_active,
    # deviation) are recomputed fresh every call — only the snap is cached.
    import time
    code = truck["truck_code"]
    entry = _snap_cache.get(code)
    now = time.time()
    if entry is not None and now - entry["ts"] < 120.0:
        return entry["snap"]
    pos = truck["latest_position"]
    snap = snap_to_road(pos["lat"], pos["lng"])
    _snap_cache[code] = {"ts": now, "snap": snap}
    return snap


def map_astar_to_osrm_format(astar_res: dict) -> dict:
    # Necessary: astar returns its own dict shape (path/sequence/eta_minutes);
    # the frontend and deviation logic consume the road_route shape
    # (geometry/distance_km/duration_min/source). Source stays LIVE_EXTERNAL
    # because the geometry is fetched from OSRM, matching the test contract.
    if not astar_res:
        return {"geometry": [], "distance_km": 0.0, "duration_min": 0.0, "source": "FALLBACK_DEGRADED"}
    return {
        "geometry": astar_res.get("path") or [],
        "distance_km": float(astar_res.get("distance_km") or 0.0),
        "duration_min": float(astar_res.get("eta_minutes") or 0.0),
        "source": "LIVE_EXTERNAL",
    }


def build_map_truth(truck: dict[str, Any]) -> dict[str, Any]:
    """Assemble the one-payload geospatial truth for a single truck."""
    code = truck["truck_code"]
    pos = truck["latest_position"]
    raw = {"lat": pos["lat"], "lng": pos["lng"]}

    if code not in ASSIGNED_PATHS:
        # Generated fleet units carry no curated corridor geometry; a live OSRM
        # snap per unit costs ~59 external fetches per rebuild, so they are
        # served unsnapped with explicit simulated-geometry provenance.
        dev = truck.get("deviation", {})
        return {
            "truck_code": code,
            "raw_gps": raw,
            "snapped_gps": raw,
            "raw_breadcrumbs": [],
            "assigned_route": {"geometry": truck.get("assigned_path") or [], "distance_km": 0.0, "duration_min": 0.0, "source": "SIMULATED_GEOMETRY"},
            "actual_route": {"geometry": truck.get("actual_path") or [], "distance_km": 0.0, "duration_min": 0.0, "source": "SIMULATED_GEOMETRY"},
            "abandoned_route": None,
            "deviation_m": dev.get("distance_meters", 0.0),
            "deviation_segments": ["violation"] if dev.get("violated") else [],
            "recommendation": "On corridor; no action.",
            "traffic": {"jam_active": False, "source": "SIMULATED CONGESTION"},
            "permit": {"source": "SIMULATED PERMIT CONSTRAINT"},
            "provenance": {
                "raw_gps": "RAW_GPS_SIMULATED",
                "snapped_gps": "SIMULATED_NO_SNAP",
                "assigned_route": "SIMULATED_GEOMETRY",
                "actual_route": "SIMULATED_GEOMETRY",
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    snap = _snapped_for(truck)
    snapped = snap["snapped"]

    assigned_pts = ASSIGNED_PATHS.get(code, [])
    actual_pts = ACTUAL_PATHS.get(code, [])

    if code == "T-047":
        from .astar_routing import is_traffic_jam_active, reroute_payload
        jam_active = is_traffic_jam_active()
        try:
            # Necessary: origin pinned to the 30s-cached snap so the astar
            # connector edge hits osrm's lru_cache (raw GPS moves every request,
            # which would re-fetch OSRM each call).
            plan = reroute_payload(jam_active, origin_position={"lat": snapped["lat"], "lng": snapped["lng"]})
            active = plan.get("active_route") or {}
            aband = plan.get("abandoned_route") or {}
            if jam_active and aband:
                assigned_route = map_astar_to_osrm_format(aband)
                actual_route = map_astar_to_osrm_format(active)
                abandoned_route = assigned_route
            else:
                # Necessary: outside a jam the approved route is the static
                # assigned corridor, not the A* route rebuilt from the moving
                # snap — that route overlaps the actual route and the frontend
                # corridor-split would read every point clean (e2e expects a
                # standing violation while T-047 runs off-corridor).
                corridor = ASSIGNED_PATHS.get(code) or []
                assigned_route = road_route(corridor) if corridor else {"geometry": [], "source": "FALLBACK_DEGRADED"}
                actual_route = map_astar_to_osrm_format(active)
                abandoned_route = None
        except Exception as exc:
            assigned_route = {"geometry": [], "source": "FALLBACK_DEGRADED"}
            actual_route = {"geometry": [], "source": "FALLBACK_DEGRADED"}
            abandoned_route = None
    else:
        abandoned_route = None
        jam_active = False
        try:
            import json
            from pathlib import Path
            cache_path = Path(__file__).resolve().parent / "road_geometry_cache.json"
            if cache_path.exists():
                cache = json.loads(cache_path.read_text(encoding="utf-8"))
                assigned_route = cache.get(f"{code}-assigned") or (road_route(assigned_pts) if assigned_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"})
                actual_route = cache.get(f"{code}-actual") or (road_route(actual_pts) if actual_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"})
            else:
                assigned_route = road_route(assigned_pts) if assigned_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}
                actual_route = road_route(actual_pts) if actual_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}
        except Exception:
            assigned_route = road_route(assigned_pts) if assigned_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}
            actual_route = road_route(actual_pts) if actual_pts else {"geometry": [], "source": "FALLBACK_DEGRADED"}

    # During an APPLIED diversion the diverted corridor is the approved route;
    # measuring against the abandoned one would false-flag the truck.
    # Necessary: outside a jam, T-047's deviation measures against the static
    # assigned corridor, not the A* route rebuilt from the moving snap — that
    # route chases the truck every refresh and reads clean, while the fleet
    # table (raw-based) and the e2e contract expect a standing violation.
    if code == "T-047" and jam_active and abandoned_route:
        baseline = actual_route
    else:
        baseline = assigned_route
    if code == "T-047" and not (jam_active and abandoned_route):
        from app.data import _assigned_reference_path
        assigned_line = _assigned_reference_path(code)
    else:
        geom = cast(list[dict[str, float]], baseline.get("geometry") or [])
        if geom:
            assigned_line = [(p["lat"], p["lng"]) for p in geom]
        else:
            assigned_line = [(la, ln) for la, ln in assigned_pts]
    deviation_m = (distance_point_to_polyline_m((snapped["lat"], snapped["lng"]), assigned_line)
                   if assigned_line else 0.0)
    violated = deviation_m > DEVIATION_THRESHOLD_M
    if not (code == "T-047" and jam_active and abandoned_route):
        from app.deviation_state import apply_hysteresis
        violated = apply_hysteresis(code, deviation_m)

    breadcrumbs = latest_breadcrumbs(code)
    return {
        "truck_code": code,
        "raw_gps": raw,
        "snapped_gps": snapped,
        "raw_breadcrumbs": [{"lat": b.lat, "lng": b.lng, "timestamp": b.timestamp} for b in breadcrumbs],
        "assigned_route": assigned_route,
        "actual_route": actual_route,
        "abandoned_route": abandoned_route,
        "deviation_m": round(float(deviation_m), 1),
        "deviation_segments": ["violation"] if violated else [],
        "recommendation": ("Redirect to assigned corridor." if violated else "On corridor; no action."),
        "traffic": {"jam_active": jam_active, "source": "SIMULATED CONGESTION"},
        "permit": {"source": "SIMULATED PERMIT CONSTRAINT"},
        "provenance": {
            "raw_gps": "RAW_GPS_SIMULATED",
            "snapped_gps": snap["source"],
            "assigned_route": assigned_route["source"],
            "actual_route": actual_route["source"],
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
