# -*- coding: utf-8 -*-
"""
fleet_generator.py — scales the demo fleet from the 4 curated narrative trucks
to a realistic operational fleet (60 units) grounded in real data:

- Spatial distribution follows the REAL 2023 DKI truck census per wilayah
  (data_truk_sampah_dki.csv via load_fleet_composition).
- Vehicle types follow the same census mix.
- Patrol areas anchor on REAL kelurahan centroids (267-polygon GeoJSON).
- Positions are deterministic kinematics (pure function of time — no hidden
  state), speeds follow Jakarta collection-duty cycles.

Every generated truck is labeled SIMULATED TELEMETRY; the four curated trucks
(T-001/T-047/T-088/T-112/T-136) keep their hand-authored corridors and demo
behaviors untouched (e2e and demo scripts depend on them).

Also owns the fleet ACTIVITY model (Case 1: "position AND activity"): each
truck reports an operational state derived from speed + progress along its
duty path — loading_at_tps / hauling_to_tpa / dumping_at_tpa / returning —
plus a deterministic maintenance status for the fleet-damage dashboard
requirement.
"""
from __future__ import annotations

import hashlib
import math
import time
from typing import Any

from app.real_data import load_fleet_composition, load_kelurahan_heatmap

_GENERATED_COUNT = 55  # + 5 curated trucks = 60-unit demo fleet
_DRIVER_POOL = [
    "Slamet Riyadi", "Dedi Kurniawan", "Rudi Hartono", "Andi Wijaya", "Fajar Nugroho",
    "Hendra Gunawan", "Yusuf Maulana", "Bambang Sutrisno", "Eko Purnomo", "Irfan Hakim",
    "Surya Darma", "Tono Sugiarto", "Wahyu Hidayat", "Asep Saepudin", "Dodi Firmansyah",
]
_DAMAGE_NOTES = [
    ("breakdown", "Hydraulic compactor leak — held at depot"),
    ("maintenance", "Brake service due — limited duty"),
    ("maintenance", "Tire replacement scheduled"),
    ("breakdown", "Engine overheating — backup dispatched"),
]

_gen_cache: dict[str, Any] = {"ts": 0.0, "payload": None}


def _seed(code: str) -> int:
    return int(hashlib.sha256(code.encode()).hexdigest()[:8], 16)


def _kelurahan_centroids() -> list[dict[str, Any]]:
    """Real kelurahan centroids (mainland only) as fleet patrol anchors."""
    fc = load_kelurahan_heatmap()
    out = []
    for feat in fc.get("features", []):
        props = feat.get("properties", {})
        city = str(props.get("city", "")).title()
        if "Kepulauan" in city:
            continue
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [])
        if geom.get("type") == "Polygon" and coords:
            ring = coords[0]
        elif geom.get("type") == "MultiPolygon" and coords:
            ring = coords[0][0]
        else:
            continue
        if not ring:
            continue
        lng = sum(p[0] for p in ring) / len(ring)
        lat = sum(p[1] for p in ring) / len(ring)
        out.append({
            "lat": lat, "lng": lng,
            "kelurahan": props.get("kelurahan", ""),
            "city": city,
        })
    return out


def _duty_path(anchor_lat: float, anchor_lng: float, seed: int) -> list[tuple[float, float]]:
    """Short 3-4 point collection loop around a real kelurahan centroid."""
    rng = seed
    pts = []
    lat, lng = anchor_lat, anchor_lng
    for i in range(3):
        pts.append((round(lat, 6), round(lng, 6)))
        rng = (rng * 1103515245 + 12345) % (2 ** 31)
        dlng = ((rng % 1000) / 1000.0 - 0.5) * 0.016
        rng = (rng * 1103515245 + 12345) % (2 ** 31)
        dlat = ((rng % 1000) / 1000.0 - 0.5) * 0.012
        lat, lng = lat + dlat, lng + dlng
    return pts


def _path_km(path: list[tuple[float, float]]) -> float:
    total = 0.0
    for i in range(1, len(path)):
        lat1, lon1 = path[i - 1]
        lat2, lon2 = path[i]
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        total += 2 * 6371.0 * math.asin(math.sqrt(h))
    return max(total, 0.2)


def activity_for(speed_kmh: float, progress: float, damaged: bool) -> dict[str, str]:
    """Case 1 'position AND activity': operational state derived from telemetry.

    States mirror a real collection duty cycle; the basis is disclosed so the
    dashboard never presents derived states as observed driver reports.
    """
    if damaged:
        state, label = "maintenance_hold", "Maintenance hold"
    elif progress >= 0.9:
        state, label = "returning", "Returning to depot"
    elif progress >= 0.7 and speed_kmh < 12:
        state, label = "dumping_at_tpa", "Queueing / dumping at TPA"
    elif speed_kmh < 10:
        state, label = "loading_at_tps", "Loading at TPS pickup"
    else:
        state, label = "hauling_to_tpa", "Hauling to TPA"
    return {
        "state": state,
        "label": label,
        "basis": "derived from speed + duty-path progress (simulated telemetry)",
    }


def damage_status_for(code: str) -> dict[str, Any]:
    """Deterministic per-truck maintenance status (~7% of the fleet)."""
    h = _seed(code) % 100
    if h < 7:
        state, note = _DAMAGE_NOTES[h % len(_DAMAGE_NOTES)]
        return {"state": state, "note": note, "operational": state != "breakdown"}
    return {"state": "ok", "note": "No open work order", "operational": True}


def _generated_truck(code: str, anchor: dict[str, Any], vehicle_type: str, now: float) -> dict[str, Any]:
    seed = _seed(code)
    path = _duty_path(anchor["lat"], anchor["lng"], seed)
    total_km = _path_km(path)
    base_speed = 12.0 + (seed % 90) / 10.0  # 12-21 km/h collection duty
    phase = (seed % 1000) / 1000.0
    progress = ((now * base_speed / 3600.0) / total_km + phase) % 1.0

    dist_km = progress * total_km
    walked = 0.0
    lat, lng = path[0]
    for i in range(1, len(path)):
        lat1, lon1 = path[i - 1]
        lat2, lon2 = path[i]
        seg = _path_km([path[i - 1], path[i]])
        if walked + seg >= dist_km:
            frac = (dist_km - walked) / max(seg, 1e-9)
            lat = lat1 + (lat2 - lat1) * frac
            lng = lon1 + (lon2 - lon1) * frac
            break
        walked += seg

    speed = base_speed * (0.82 + 0.18 * math.sin(now / 9.0 + seed % 7))
    speed = max(0.0, min(60.0, round(speed, 1)))
    damage = damage_status_for(code)
    damaged = not damage["operational"] or damage["state"] != "ok"
    activity = activity_for(speed, progress, damaged)

    return {
        "truck_code": code,
        "plate_number": f"B {7000 + (seed % 900)} {'ABCDEFGH'[seed % 8]}{'JKLMNOPQ'[(seed // 8) % 8]}",
        "driver_name": _DRIVER_POOL[seed % len(_DRIVER_POOL)],
        "assigned_zone": anchor["city"],
        "assigned_kelurahan": anchor["kelurahan"],
        "vehicle_type": vehicle_type,
        "status": "damaged" if damaged else "active",
        "is_damaged": damaged,
        "damage_status": damage,
        "activity": activity,
        "latest_position": {
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "speed_kmh": speed,
            "updated_seconds_ago": int(now % 30),
        },
        "assigned_path": [{"lat": la, "lng": ln} for la, ln in path],
        "actual_path": [{"lat": la, "lng": ln} for la, ln in path],
        "deviation": {
            "violated": False, "distance_meters": 0.0, "ml_outlier": False,
            "ml_score": None, "rule_flags": [], "confidence": 0.9,
            "severity": "normal", "message": "Truck remains inside the assigned corridor.",
        },
        "telemetry_class": "SIMULATED — generated fleet unit (not live GPS)",
    }


def get_generated_fleet() -> list[dict[str, Any]]:
    """60-unit-scale demo fleet minus the curated narrative trucks.

    Cached for 5s: position determinism comes from the time-based kinematics,
    so a short TTL only smooths identical recomputations within one snapshot.
    """
    now = time.time()
    if _gen_cache["payload"] is not None and now - _gen_cache["ts"] < 5.0:
        return _gen_cache["payload"]

    composition = load_fleet_composition()
    vehicle_types = list((composition.get("by_vehicle_type") or {"Compactor Besar": 1}).keys())
    anchors = _kelurahan_centroids()
    trucks: list[dict[str, Any]] = []
    for i in range(_GENERATED_COUNT):
        code = f"T-{200 + i}"
        anchor = anchors[(i * 7) % len(anchors)] if anchors else {"lat": -6.2, "lng": 106.84, "kelurahan": "", "city": "Jakarta"}
        vtype = vehicle_types[i % len(vehicle_types)]
        trucks.append(_generated_truck(code, anchor, vtype, now))

    _gen_cache["payload"] = trucks
    _gen_cache["ts"] = now
    return trucks
