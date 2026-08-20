from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from .engine import detect_route_deviation, forecast_waste_risk, recommend_routes
from .osrm import fetch_osrm_route
from .real_data import baseline_tons_for


ASSIGNED_PATHS = {
    # Road-following demo corridors around Jakarta, ordered west/north/south/east.
    "T-001": [(-6.1455, 106.8550), (-6.1490, 106.8700), (-6.1540, 106.8780), (-6.1600, 106.8890)],
    "T-047": [(-6.1649, 106.7415), (-6.1664, 106.7638), (-6.1717, 106.7868), (-6.1753, 106.7988)],
    "T-088": [(-6.2910, 106.7840), (-6.2900, 106.8070), (-6.2870, 106.8290), (-6.2810, 106.8460)],
    "T-112": [(-6.2430, 106.8730), (-6.2290, 106.8870), (-6.2180, 106.9010), (-6.2050, 106.9250)],
    "T-136": [(-6.1800, 106.9130), (-6.1900, 106.9290), (-6.2050, 106.9440), (-6.2190, 106.9580)],
}

ACTUAL_PATHS = {
    "T-001": [(-6.1455, 106.8550), (-6.1490, 106.8700), (-6.1540, 106.8780)],
    # T-047 intentionally leaves the Daan Mogot/Tomang corridor toward Palmerah.
    "T-047": [(-6.1649, 106.7415), (-6.1664, 106.7638), (-6.1828, 106.7812), (-6.1949, 106.7898)],
    "T-088": [(-6.2910, 106.7840), (-6.2900, 106.8070), (-6.2870, 106.8290)],
    "T-112": [(-6.2430, 106.8730), (-6.2290, 106.8870), (-6.2180, 106.9010)],
    "T-136": [(-6.1800, 106.9130), (-6.1900, 106.9290), (-6.2050, 106.9440)],
}

import math
import time

_ACTIVE_T047: dict = {"seq": (), "jam": None, "origin_key": None, "path": []}


def _t047_path_from_plan(plan: dict) -> list[tuple[float, float]]:
    seq = tuple(plan.get("active_route", {}).get("sequence") or ())
    if seq != _ACTIVE_T047["seq"]:
        path_data = plan.get("active_route", {}).get("path") or []
        _ACTIVE_T047["seq"] = seq
        _ACTIVE_T047["path"] = [(p["lat"], p["lng"]) for p in path_data if isinstance(p, dict)]
    return _ACTIVE_T047["path"]


def get_road_following_path(truck_code: str) -> list[tuple[float, float]]:
    if truck_code == "T-047":
        from .astar_routing import is_traffic_jam_active, reroute_payload
        jam = is_traffic_jam_active()
        if not jam:
            # Normal ops: T-047 drives its short road-following collection loop
            # (cached OSRM geometry of ACTUAL_PATHS) — the loop that contains
            # the scripted corridor deviation. The 58 km A*-to-TPA path is only
            # used while the jam demo is active.
            try:
                import json
                from pathlib import Path
                cache_path = Path(__file__).resolve().parent / "road_geometry_cache.json"
                if cache_path.exists():
                    cache = json.loads(cache_path.read_text(encoding="utf-8"))
                    geom = cache.get("T-047-actual", {}).get("geometry")
                    if geom:
                        return [(p["lat"], p["lng"]) for p in geom]
            except Exception:
                pass
        pos = _SIM_STATE.get(truck_code, {}).get("pos")
        origin_key = (round(pos[0], 3), round(pos[1], 3)) if pos else None
        # Reuse plan while jam state and ~110m origin bucket are unchanged:
        # one command-center snapshot recomputes T-047's path ~16x via
        # get_dynamic_trucks(); a fresh A* + OSRM fetch per call costs ~8s.
        if _ACTIVE_T047["jam"] == jam and _ACTIVE_T047["origin_key"] == origin_key and _ACTIVE_T047["path"]:
            return _ACTIVE_T047["path"]
        kw = {"origin_position": {"lat": pos[0], "lng": pos[1]}} if pos else {}
        plan = reroute_payload(jam, **kw)
        pts = _t047_path_from_plan(plan)
        if pts:
            _ACTIVE_T047["jam"] = jam
            _ACTIVE_T047["origin_key"] = origin_key
            return pts
        _ACTIVE_T047["jam"] = jam
        _ACTIVE_T047["origin_key"] = origin_key
    try:
        import json
        from pathlib import Path
        cache_path = Path(__file__).resolve().parent / "road_geometry_cache.json"
        if cache_path.exists():
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            key = f"{truck_code}-actual"
            geom = cache.get(key, {}).get("geometry")
            if geom:
                return [(p["lat"], p["lng"]) for p in geom]
    except Exception:
        pass

    path = ACTUAL_PATHS[truck_code]
    from .osrm import road_route
    r = road_route(path)
    if r.get("geometry"):
        return [(p["lat"], p["lng"]) for p in r["geometry"]]
    return path

# Realistic per-truck cruising speed (km/h). Waste collectors in Jakarta crawl
# (stop-and-go at pickup points); see COMPETITION_CHECKLIST_STATUS.md audits.
TRUCK_SPEEDS_KMH = {
    "T-001": 16.0,
    "T-047": 16.0,
    "T-088": 15.0,
    "T-112": 13.0,
    "T-136": 17.0,
}

# Demo narrative seeding: T-047 starts 70% into its 14 km collection loop —
# measured against the road-following assigned corridor that is squarely inside
# the scripted off-corridor section (~1.7 km drift) — so the route-violation
# story is visible from the first minute of any demo/test run instead of
# depending on wall-clock luck.
TRUCK_INITIAL_PHASE = {"T-047": 0.7}


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(h))


def _path_cumulative_km(path: list[tuple[float, float]]) -> list[float]:
    cum = [0.0]
    for i in range(1, len(path)):
        cum.append(cum[-1] + _haversine_km(path[i - 1], path[i]))
    return cum


def _path_km(path: list[tuple[float, float]]) -> float:
    return _path_cumulative_km(path)[-1] if path else 0.0


_SIM_STATE: dict[str, dict] = {}


def _path_sig(path: list[tuple[float, float]]):
    if not path:
        return None
    mid = path[len(path) // 2]
    return (len(path), path[0], path[-1], round(mid[0], 4), round(mid[1], 4))


def get_dynamic_position_at_time(truck_code: str, t_sec: float, update_state: bool = True) -> tuple[float, float, float]:
    """Continuous forward drive along the truck's route.

    Replaces the old ping-pong (which reversed direction mid-route every 90 s
    and looked broken on the live map). The truck now advances monotonically at
    a realistic collection speed and wraps only after a FULL loop — typically
    15+ minutes, so a 5-10 minute demo never shows a restart.

    Route swaps (jam ON/OFF) remap the truck to the nearest point on the new
    route, so toggling traffic never teleports the marker across the city.

    update_state=False is a pure read: it derives the position at t_sec from
    the existing sim state (t_sec may be in the past) without advancing it.
    Used by breadcrumb history so polling never accelerates the truck.
    """
    path = get_road_following_path(truck_code)
    if not path:
        return -6.2088, 106.8456, 0.0
    if len(path) < 2:
        return path[0][0], path[0][1], 0.0

    cum = _path_cumulative_km(path)
    total_km = cum[-1]
    base_speed = TRUCK_SPEEDS_KMH.get(truck_code, 20.0)
    sig = _path_sig(path)

    st = _SIM_STATE.get(truck_code)
    if st is None:
        if not update_state:
            return path[0][0], path[0][1], 0.0
        dist_km = total_km * TRUCK_INITIAL_PHASE.get(truck_code, 0.0)
    elif not update_state:
        dt = t_sec - st["last_t"]
        dist_km = (st["dist_km"] + base_speed * dt / 3600.0) % max(total_km, 1e-9)
    elif st["sig"] != sig:
        prev_pos = st.get("pos")
        if prev_pos:
            best_i, best_d = 0, float("inf")
            for i, (la, ln) in enumerate(path):
                d = _haversine_km(prev_pos, (la, ln))
                if d < best_d:
                    best_i, best_d = i, d
            dist_km = cum[best_i]
            dt = max(0.0, t_sec - st["last_t"])
            dist_km = (dist_km + base_speed * dt / 3600.0) % max(total_km, 1e-9)
        else:
            dist_km = st["dist_km"] % max(total_km, 1e-9)
    else:
        dt = max(0.0, t_sec - st["last_t"])
        dist_km = (st["dist_km"] + base_speed * dt / 3600.0) % max(total_km, 1e-9)

    idx = 1
    while idx < len(cum) - 1 and cum[idx] < dist_km:
        idx += 1
    seg_len = max(cum[idx] - cum[idx - 1], 1e-9)
    frac = (dist_km - cum[idx - 1]) / seg_len

    lat = path[idx - 1][0] + (path[idx][0] - path[idx - 1][0]) * frac
    lng = path[idx - 1][1] + (path[idx][1] - path[idx - 1][1]) * frac

    # T-047 demo narrative: constrain the loop to the violation zone (60-95%
    # of the full path) so the off-corridor story is always visible — the
    # truck wraps back to 60% instead of driving through the compliant start.
    if truck_code == "T-047" and total_km > 5.0:
        v_start = 0.60 * total_km
        v_span = 0.35 * total_km
        dist_in_zone = v_start + (dist_km % v_span)
        idx = 1
        while idx < len(cum) - 1 and cum[idx] < dist_in_zone:
            idx += 1
        seg_len = max(cum[idx] - cum[idx - 1], 1e-9)
        frac = (dist_in_zone - cum[idx - 1]) / seg_len
        lat = path[idx - 1][0] + (path[idx][0] - path[idx - 1][0]) * frac
        lng = path[idx - 1][1] + (path[idx][1] - path[idx - 1][1]) * frac

    speed = base_speed * (0.82 + 0.18 * math.sin(t_sec / 9.0) + 0.08 * math.sin(t_sec / 3.2 + 1.7))
    speed = max(6.0, min(60.0, speed))

    if update_state:
        _SIM_STATE[truck_code] = {"last_t": t_sec, "dist_km": dist_km, "sig": sig, "pos": (lat, lng)}
    return round(lat, 6), round(lng, 6), round(speed, 1)

def get_dynamic_position(truck_code: str) -> tuple[float, float, float]:
    return get_dynamic_position_at_time(truck_code, time.time())

class DynamicPositionsDict(dict):
    def __getitem__(self, key):
        lat, lng, _ = get_dynamic_position(key)
        return lat, lng

LATEST_POSITIONS = DynamicPositionsDict()

def _assigned_reference_path(truck_code: str) -> list[tuple[float, float]]:
    """Road-following assigned corridor for deviation measurement.

    Measuring against the 4-point polyline false-flags trucks whose real route
    legitimately curves with the road network (T-112 read ~800m 'off' while
    perfectly on-route). The cached OSRM corridor geometry is the true
    reference; the polyline is only a fallback when the cache is absent.
    """
    try:
        import json
        from functools import lru_cache
        from pathlib import Path

        @lru_cache(maxsize=8)
        def _load(code: str):
            cache_path = Path(__file__).resolve().parent / "road_geometry_cache.json"
            if cache_path.exists():
                cache = json.loads(cache_path.read_text(encoding="utf-8"))
                geom = cache.get(f"{code}-assigned", {}).get("geometry")
                if geom:
                    return [(p["lat"], p["lng"]) for p in geom]
            return None

        cached = _load(truck_code)
        if cached:
            return cached
    except Exception:
        pass
    return ASSIGNED_PATHS[truck_code]


def _truck(truck_code: str, plate: str, driver: str, zone: str, status: str,
           damaged: bool, vehicle_type: str = "Compactor Besar") -> dict[str, Any]:
    lat, lng, speed = get_dynamic_position(truck_code)
    deviation = detect_route_deviation(_assigned_reference_path(truck_code), (lat, lng), speed_kmh=speed)
    from app.deviation_state import apply_hysteresis
    latched = apply_hysteresis(truck_code, deviation["distance_meters"])
    if latched and not deviation["violated"]:
        deviation = {**deviation, "violated": True, "severity": "warning",
                     "rule_flags": [*deviation["rule_flags"], "sustained_deviation"],
                     "message": "Truck remains off the assigned corridor (sustained-deviation latch, clears under 50 m)."}
    curr_status = "deviation" if deviation["violated"] else ("damaged" if damaged else "active")

    from app.fleet_generator import activity_for, damage_status_for, _path_km
    from app.engine import detect_violation_types
    st = _SIM_STATE.get(truck_code, {})
    total_km = max(_path_km(ACTUAL_PATHS[truck_code]), 1e-9)
    progress = min(1.0, (st.get("dist_km", 0.0) % total_km) / total_km)
    damage = damage_status_for(truck_code)
    if damaged and damage["state"] == "ok":
        damage = {"state": "breakdown", "note": "Compactor fault reported by driver", "operational": False}
    activity = activity_for(speed, progress, damaged)
    violation_types = detect_violation_types(speed, activity["state"], deviation["violated"], deviation["distance_meters"])
    if violation_types:
        deviation["violation_types"] = violation_types

    return {
        "truck_code": truck_code,
        "plate_number": plate,
        "driver_name": driver,
        "assigned_zone": zone,
        "vehicle_type": vehicle_type,
        "status": curr_status,
        "is_damaged": damaged,
        "damage_status": damage,
        "activity": activity,
        "latest_position": {
            "lat": lat,
            "lng": lng,
            "speed_kmh": round(speed, 1),
            "updated_seconds_ago": int(time.time() % 30),
        },
        "assigned_path": [{"lat": lat_p, "lng": lng_p} for lat_p, lng_p in ASSIGNED_PATHS[truck_code]],
        "actual_path": [{"lat": lat_p, "lng": lng_p} for lat_p, lng_p in ACTUAL_PATHS[truck_code]],
        "deviation": deviation,
    }


_fleet_cache: dict[str, Any] = {"ts": 0.0, "payload": None}


def get_dynamic_trucks() -> list[dict[str, Any]]:
    """Curated narrative trucks + generated fleet (60 units total).

    Cached 2s: one command-center snapshot reads the fleet ~16x; without the
    TTL each read re-runs deviation detection for every unit.
    """
    now = time.time()
    if _fleet_cache["payload"] is not None and now - _fleet_cache["ts"] < 2.0:
        return _fleet_cache["payload"]
    from app.fleet_generator import get_generated_fleet
    curated = [
        _truck("T-001", "B 1234 CD", "Budi Santoso", "Jakarta Utara", "active", False, "Dump Truck Besar"),
        _truck("T-047", "B 5678 EF", "Agus Pratama", "Jakarta Barat", "deviation", False, "Compactor Besar"),
        _truck("T-088", "B 9012 GH", "Joko Wijaya", "Jakarta Selatan", "active", False, "Arm Roll Besar"),
        _truck("T-112", "B 4410 KL", "Rizky Maulana", "Jakarta Timur", "active", True, "Compactor Kecil"),
    ]
    _fleet_cache["payload"] = curated + get_generated_fleet()
    _fleet_cache["ts"] = now
    return _fleet_cache["payload"]

class DynamicTruckList(list):
    def __iter__(self):
        return iter(get_dynamic_trucks())
    def __getitem__(self, index):
        return get_dynamic_trucks()[index]
    def __len__(self):
        return len(get_dynamic_trucks())

TRUCKS = DynamicTruckList()

ROUTE_OPTIONS = [
    {
        "name": "Route A - Original Corridor",
        "eta_minutes": 62,
        "traffic_level": 0.7,
        "flood_risk": 0.2,
        "permit_compliant": True,
        "path": [{"lat": -6.1949, "lng": 106.7898}, {"lat": -6.1840, "lng": 106.7940}, {"lat": -6.1753, "lng": 106.7988}],
    },
    {
        "name": "Route B - Daan Mogot Recovery",
        "eta_minutes": 48,
        "traffic_level": 0.35,
        "flood_risk": 0.05,
        "permit_compliant": True,
        "path": [{"lat": -6.1949, "lng": 106.7898}, {"lat": -6.1880, "lng": 106.8070}, {"lat": -6.1753, "lng": 106.7988}],
    },
    {
        "name": "Route C - Restricted Shortcut",
        "eta_minutes": 38,
        "traffic_level": 0.1,
        "flood_risk": 0.0,
        "permit_compliant": False,
        "path": [{"lat": -6.1949, "lng": 106.7898}, {"lat": -6.1870, "lng": 106.7720}, {"lat": -6.1753, "lng": 106.7988}],
    },
]


# Necessary: build_predictions runs 7x42 model calls (~23s cold, ~4s warm), and
# it is called on every command-center snapshot — without this TTL cache each
# snapshot would recompute it. 300s is safe: forecasts are daily-resolution
# data, and startup warms the cache before any browser connects.
_predictions_cache: dict[str, Any] = {"ts": 0.0, "payload": None}

def build_predictions() -> list[dict[str, Any]]:
    cached = _predictions_cache
    if cached["payload"] is not None and time.time() - cached["ts"] < 300.0:
        return cached["payload"]
    result = _build_predictions_uncached()
    cached["payload"] = result
    cached["ts"] = time.time()
    return result


def _build_predictions_uncached() -> list[dict[str, Any]]:
    from .weather import fetch_jakarta_weather_forecast
    from .real_data import load_kecamatan_map, load_official_events
    from .engine import predict_waste_hybrid, _haversine_meters

    today = date.today()
    weather_data = fetch_jakarta_weather_forecast()
    forecasts = weather_data.get("forecast", [])
    
    weather_map = {}
    for f in forecasts:
        weather_map[f["date"]] = {
            "rainfall_mm": f.get("rainfall_mm", 0.0),
            "temp_max_c": f.get("temperature_max_c", 31.0),
            "wind_max_kmh": f.get("wind_speed_kmh", 10.0),
        }
        
    kecs = load_kecamatan_map()
    events = load_official_events()
    
    predictions = []
    for day in range(1, 8):
        target_date = today + timedelta(days=day)
        target_date_str = target_date.isoformat()
        
        w_day = weather_map.get(target_date_str, {"rainfall_mm": 0.0, "temp_max_c": 31.0, "wind_max_kmh": 10.0})
        rainfall_mm = w_day["rainfall_mm"]
        temp_max_c = w_day["temp_max_c"]
        wind_max_kmh = w_day["wind_max_kmh"]
        
        is_weekend = target_date.weekday() >= 5
        is_holiday = False
        
        day_events = [ev for ev in events if ev.get("date_raw") == target_date_str]
        
        target_slugs = {}
        for ev in day_events:
            att = ev.get("expected_attendance") or 0.0
            if att > 0:
                evt_name = ev.get("name", "").lower()
                evt_loc = ev.get("location", "").lower()
                elat, elng = -6.2183, 106.8022
                if "monas" in evt_name or "monas" in evt_loc:
                    elat, elng = -6.1754, 106.8272
                elif "hi" in evt_name or "sudirman" in evt_loc:
                    elat, elng = -6.1950, 106.8230
                
                closest_kec = None
                min_dist = float("inf")
                for k in kecs:
                    klat = k.get("lat")
                    klng = k.get("lng")
                    if klat is not None and klng is not None:
                        dist = _haversine_meters((elat, elng), (klat, klng))
                        if dist <= 3500.0:
                            target_slugs[k["slug"]] = max(target_slugs.get(k["slug"], 0), int(att))
                        if dist < min_dist:
                            min_dist = dist
                            closest_kec = k
                if not target_slugs and closest_kec:
                    target_slugs[closest_kec["slug"]] = max(target_slugs.get(closest_kec["slug"], 0), int(att))

        kec_preds = []
        for k in kecs:
            k_att = target_slugs.get(k["slug"], 0)
            pred = predict_waste_hybrid(
                kelurahan=k["slug"],
                rainfall_mm=rainfall_mm,
                temp_max_c=temp_max_c,
                wind_max_kmh=wind_max_kmh,
                is_weekend=is_weekend,
                is_holiday=is_holiday,
                event_attendance=k_att,
                target_date=target_date_str,
            )
            kec_preds.append({
                "city": k["city"],
                "baseline_tons": pred["prophet_baseline_tons"],
                "predicted_tons": pred["predicted_tons"],
                "crews_required": pred["crews_required"],
                "man_hours_required": pred["man_hours_required"],
                "disposal_bins_required": pred["disposal_bins_required"],
            })
            
        cities = ["Jakarta Barat", "Jakarta Utara", "Jakarta Timur", "Jakarta Selatan", "Jakarta Pusat"]
        for city in cities:
            city_kecs = [p for p in kec_preds if p["city"] == city]
            if not city_kecs:
                continue
            base_tons = sum(p["baseline_tons"] for p in city_kecs)
            pred_tons = sum(p["predicted_tons"] for p in city_kecs)
            
            spike_pct = round(((pred_tons - base_tons) / base_tons * 100)) if base_tons > 0 else 0
            
            factors = []
            if rainfall_mm >= 30:
                factors.append("Heavy rainfall adds flood-related waste and slows collection.")
            elif rainfall_mm >= 10:
                factors.append("Rainfall may slow collection and increase wet waste.")
            if any(target_slugs.get(k["slug"], 0) > 0 for k in kecs if k["city"] == city):
                factors.append("Permitted event increases waste around crowded areas.")
            if is_weekend:
                factors.append("Weekend activity raises commercial and public-space waste.")
                
            risk_level = "normal"
            if spike_pct >= 30:
                risk_level = "critical"
            elif spike_pct >= 20:
                risk_level = "high"
            elif spike_pct >= 10:
                risk_level = "watch"
                
            extra_trucks = max(0, round((pred_tons - base_tons) / 18))
            
            predictions.append({
                "district": city,
                "date": target_date_str,
                "baseline_tons": round(base_tons, 1),
                "predicted_tons": round(pred_tons, 1),
                "spike_percent": spike_pct,
                "risk_level": risk_level,
                "factors": factors or ["No unusual driver detected."],
                "recommended_extra_trucks": extra_trucks,
                "recommended_extra_crews": max(0, round(extra_trucks / 2)),
                "man_hours_required": sum(p["man_hours_required"] for p in city_kecs),
                "crews_required": sum(p["crews_required"] for p in city_kecs),
                "disposal_bins_required": sum(p["disposal_bins_required"] for p in city_kecs),
                "fuel_consumption_liters": round(pred_tons * 1.8, 1),
                "co2_emissions_kg": round(pred_tons * 1.8 * 2.68, 1),
            })
            
    return predictions


def build_alerts() -> list[dict[str, Any]]:
    alerts = []
    for truck in TRUCKS:
        if truck["deviation"]["violated"]:
            alerts.append(
                {
                    "id": f"ALT-{truck['truck_code']}",
                    "type": "route_deviation",
                    "severity": truck["deviation"]["severity"],
                    "truck_code": truck["truck_code"],
                    "title": f"{truck['truck_code']} deviated from assigned corridor",
                    "description": truck["deviation"]["message"],
                    "recommended_routes": recommend_routes(ROUTE_OPTIONS),
                    "status": "active",
                }
            )
        if truck["is_damaged"]:
            alerts.append(
                {
                    "id": f"DMG-{truck['truck_code']}",
                    "type": "fleet_damage",
                    "severity": "warning",
                    "truck_code": truck["truck_code"],
                    "title": f"{truck['truck_code']} reports compactor issue",
                    "description": "Move this truck to lower-priority pickups and assign backup capacity.",
                    "recommended_routes": [],
                    "status": "active",
                }
            )
    return alerts


# Necessary: Route B is a static demo recovery corridor, but its OSRM fetch can
# take 13s+ when the public service is slow. A single-slot 300s cache (origin
# ignored after first fill; warmed at startup) guarantees the dashboard never
# pays that cost during a live session.
_route_b_cache: dict[str, Any] = {"ts": 0.0, "payload": None}

def _route_b_osrm() -> dict[str, Any]:
    import time as _t
    cached = _route_b_cache
    if cached["payload"] is not None and _t.time() - cached["ts"] < 300.0:
        return cached["payload"]
    cached["payload"] = fetch_osrm_route(
        "Route B - Daan Mogot Recovery",
        origin=LATEST_POSITIONS["T-047"],
        destination=ASSIGNED_PATHS["T-047"][-1],
    )
    cached["ts"] = _t.time()
    return cached["payload"]


def command_center_snapshot(dispatches: list[dict[str, Any]], weather: dict[str, Any] | None = None) -> dict[str, Any]:
    import time
    from .queue_simulation import simulate_queue

    predictions = build_predictions()
    critical_predictions = [item for item in predictions if item["risk_level"] in {"critical", "high"}]
    active_alerts = build_alerts()
    weather_forecast = weather or {"source": "not-loaded", "forecast": []}
    weather_peak = max(
        weather_forecast.get("forecast", []),
        key=lambda item: item.get("waste_impact_percent", 0),
        default={},
    )

    hour = time.localtime().tm_hour
    base_trucks = 47 if (8 <= hour <= 10 or 14 <= hour <= 16) else 14
    sim = simulate_queue(base_trucks, weighbridges=2, service_rate_per_hour=4.5, seed=42)
    wait_time = int(sim["mean_wait_minutes"])
    tpa_status = "red" if wait_time >= 90 else "yellow" if wait_time >= 45 else "green"
    tpa_rec = (
        "Delay departures of non-essential trucks by 30-45 minutes to relieve Bantargebang gridlock."
        if tpa_status != "green"
        else "Green corridor clear. Normal dispatch speed approved."
    )

    peak_pred = max(predictions, key=lambda item: item["predicted_tons"] - item["baseline_tons"], default=None)
    if peak_pred:
        peak_district = peak_pred["district"]
        peak_spike = peak_pred["spike_percent"]
        extra_trucks_needed = sum(item["recommended_extra_trucks"] for item in predictions if item["date"] == peak_pred["date"])
        extra_crews_needed = sum(item["recommended_extra_crews"] for item in predictions if item["date"] == peak_pred["date"])
        
        headline = f"{peak_district} requires immediate capacity reinforcement."
        points = [
            f"Largest forecasted spike is +{peak_spike}% in {peak_district}, driven by weather/event conditions; weather impact peaks at +{weather_peak.get('waste_impact_percent', 16)}%.",
            "T-047 is outside the assigned corridor and should be redirected through Route B.",
            f"TPA Bantargebang queue is currently {wait_time} mins; dispatch timing should be staggered." if wait_time > 45 else "TPA Bantargebang corridor is clear.",
            f"Recommended action: add {extra_trucks_needed} trucks and {extra_crews_needed} crews across high-risk districts.",
        ]
    else:
        headline = "Logistics corridor operating normally."
        points = [
            "All districts stable within baseline capacity.",
            "T-047 is outside the assigned corridor and should be redirected through Route B.",
            "Queue times at Bantargebang are normal.",
        ]

    return {
        "generated_at": date.today().isoformat(),
        "kpis": {
            "active_trucks": sum(1 for truck in TRUCKS if truck["status"] in {"active", "deviation"}),
            "trucks_with_issues": sum(1 for truck in TRUCKS if truck["deviation"]["violated"] or truck["is_damaged"]),
            "tpa_queue_trucks": base_trucks,
            "tpa_wait_minutes": wait_time,
            "predicted_spike_percent": max([item["spike_percent"] for item in predictions]) if predictions else 0,
            "pending_dispatches": sum(1 for item in dispatches if item["field_status"] == "PENDING"),
        },
        "tpa_queue": {
            "status": tpa_status,
            "trucks_waiting": base_trucks,
            "estimated_wait_minutes": wait_time,
            "throughput_trucks_per_hour": 30,
            "recommendation": tpa_rec,
        },
        "trucks": list(TRUCKS),
        "alerts": active_alerts,
        "osrm_route": _route_b_osrm(),
        "predictions": predictions,
        "critical_predictions": critical_predictions[:8],
        "weather": weather_forecast,
        "dispatches": dispatches,
        "executive_summary": {
            "headline": headline,
            "points": points,
        },
    }


_CURATED_DRIVERS = {
    "T-001": "Budi Santoso",
    "T-047": "Agus Pratama",
    "T-088": "Joko Wijaya",
    "T-112": "Rizky Maulana",
}

_FUEL_L_PER_KM = 0.42  # compactor-truck diesel factor (reference constant)


def _curated_trip_record(code: str, driver: str, t_date: str) -> dict[str, Any]:
    """Engine-derived trip record for a curated truck."""
    assigned = ASSIGNED_PATHS[code]
    actual = ACTUAL_PATHS[code]
    distance_km = round(_path_km(actual), 1)
    speed = TRUCK_SPEEDS_KMH.get(code, 18.0)
    duration_min = max(10.0, distance_km / speed * 60.0)

    n = len(actual)
    start_hour = 7 + (abs(hash(code)) % 2)
    points = []
    for i, (la, ln) in enumerate(actual):
        minute_offset = duration_min * i / max(n - 1, 1)
        hh = int(start_hour + minute_offset // 60)
        mm = int(minute_offset % 60)
        points.append({"lat": la, "lng": ln, "timestamp": f"{t_date}T{hh:02d}:{mm:02d}:00Z"})

    deviation_hits = 0
    for la, ln in actual[1:]:
        res = detect_route_deviation(_assigned_reference_path(code), (la, ln), speed_kmh=speed)
        if res["violated"]:
            deviation_hits += 1

    return {
        "truck_code": code,
        "driver_name": driver,
        "date": t_date,
        "fuel_consumed_liters": round(distance_km * _FUEL_L_PER_KM, 1),
        "distance_km": distance_km,
        "points": points,
        "deviations_detected": deviation_hits,
        "deviations_count": deviation_hits,
        "record_type": "system_generated_from_corridor_model",
        "record_note": "Reconstructed by the routing engine from corridor geometry; not archived AVL telemetry.",
    }


def _generated_trip_record(truck: dict[str, Any], t_date: str) -> dict[str, Any]:
    """Trip record for a generated fleet unit, derived from its duty path."""
    from app.fleet_generator import _path_km as _gen_path_km
    path = [(p["lat"], p["lng"]) for p in truck.get("actual_path", [])]
    if not path:
        return None
    distance_km = round(_gen_path_km(path), 1)
    speed = truck["latest_position"]["speed_kmh"] or 15.0
    duration_min = max(8.0, distance_km / speed * 60.0)
    start_hour = 6 + (abs(hash(truck["truck_code"])) % 4)

    points = []
    for i, (la, ln) in enumerate(path):
        minute_offset = duration_min * i / max(len(path) - 1, 1)
        hh = int(start_hour + minute_offset // 60)
        mm = int(minute_offset % 60)
        points.append({"lat": la, "lng": ln, "timestamp": f"{t_date}T{hh:02d}:{mm:02d}:00Z"})

    return {
        "truck_code": truck["truck_code"],
        "driver_name": truck["driver_name"],
        "date": t_date,
        "fuel_consumed_liters": round(distance_km * _FUEL_L_PER_KM, 1),
        "distance_km": distance_km,
        "points": points,
        "deviations_detected": 0,
        "deviations_count": 0,
        "record_type": "system_generated_from_duty_path",
        "record_note": "Derived from simulated duty path; not archived AVL telemetry.",
    }


def fleet_history_payload(truck_code: str | None = None, date: str | None = None) -> list[dict[str, Any]]:
    """Trip history for the full fleet (curated + generated).

    Curated trucks get corridor-reconstructed records with real deviation
    detection; generated units get duty-path-derived records.
    """
    from datetime import datetime, timedelta
    from app.fleet_generator import get_generated_fleet

    t_date = date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    trips: list[dict[str, Any]] = []

    for code, driver in _CURATED_DRIVERS.items():
        trips.append(_curated_trip_record(code, driver, t_date))

    for truck in get_generated_fleet():
        rec = _generated_trip_record(truck, t_date)
        if rec:
            trips.append(rec)

    if truck_code:
        trips = [t for t in trips if t["truck_code"] == truck_code]
    return trips


def tpa_queue_status_payload(scenario: str = "live") -> dict[str, Any]:
    import time
    from app.queue_simulation import simulate_queue

    # Service rate 4.5 trucks/h per weighbridge (~13 min weighbridge+dump cycle)
    # reproduces the documented DLH observation: 47 peak arrivals -> ~117 min
    # mean wait. One rate is used across every queue surface (consistency).
    if scenario == "peak":
        base_trucks = 47
        arrival_profile = "peak_hour_scenario (documented DLH peak: 47 trucks/h)"
    else:
        hour = time.localtime().tm_hour
        base_trucks = 47 if (8 <= hour <= 10 or 14 <= hour <= 16) else 14
        arrival_profile = "live_clock"

    sim = simulate_queue(base_trucks, weighbridges=2, service_rate_per_hour=4.5, seed=42)
    wait_time = sim["mean_wait_minutes"]
    status_label = "CRITICAL (Antrian Padat)" if wait_time > 60 else "NORMAL (Lancar)" if wait_time < 30 else "WARNING (Padat Merayap)"

    return {
        "trucks_in_queue": base_trucks,
        "lat": -6.3310,
        "lng": 106.9910,
        "facility_name": "TPST Bantargebang",
        "avg_wait_minutes": wait_time,
        "p95_wait_minutes": sim["p95_wait_minutes"],
        "max_queue": sim["max_queue"],
        "utilization": sim["utilization"],
        "wait_ci95": sim["wait_ci95"],
        "weighbridge_status": "OPERATIONAL" if wait_time < 80 else "DEGRADED (Overload)",
        "processing_rate_tph": 120,
        "status_label": status_label,
        "scenario": scenario,
        "arrival_profile": arrival_profile,
        "method": "seeded discrete-event queue simulation",
        "scale_logs": [
            {"time": "15:30", "truck": "T-088", "weight_ton": 18.2, "status": "Cleared"},
            {"time": "15:34", "truck": "T-112", "weight_ton": 17.5, "status": "Cleared"},
            {"time": "15:42", "truck": "T-001", "weight_ton": 19.1, "status": "Weighing"},
        ]
    }


def events_permits_payload() -> list[dict[str, Any]]:
    events = [
        {
            "id": "EV-001",
            "name": "Pesta Rakyat Monas",
            "permit_number": "PR-2026-0899",
            "location_name": "Kawasan Monas, Jakarta Pusat",
            "lat": -6.1754,
            "lng": 106.8272,
            "expected_attendance": 45000,
            "predicted_waste_tons": 54.0,
            "man_hours_required": 144,
            "crews_required": 18,
            "backup_trucks_required": 3,
            "large_bins_required": 12,
            "status": "APPROVED",
        },
        {
            "id": "EV-002",
            "name": "Konser Musik GBK",
            "permit_number": "PR-2026-1124",
            "location_name": "Gelora Bung Karno, Senayan",
            "lat": -6.2183,
            "lng": 106.8022,
            "expected_attendance": 65000,
            "predicted_waste_tons": 78.5,
            "man_hours_required": 208,
            "crews_required": 26,
            "backup_trucks_required": 5,
            "large_bins_required": 18,
            "status": "APPROVED",
        },
        {
            "id": "EV-003",
            "name": "Car Free Day Bundaran HI",
            "permit_number": "PR-2026-CFD",
            "location_name": "Bundaran HI - Jl. Sudirman",
            "lat": -6.1950,
            "lng": 106.8230,
            "expected_attendance": 25000,
            "predicted_waste_tons": 18.2,
            "man_hours_required": 48,
            "crews_required": 6,
            "backup_trucks_required": 1,
            "large_bins_required": 6,
            "status": "ACTIVE_SUNDAY",
        },
    ]
    # Fixture events: permit numbers/attendance are illustrative, not official
    # DLH permit data. Label each so the UI never presents them as real permits.
    for e in events:
        e["data_class"] = "SIMULATED"
        e["data_note"] = "Illustrative event; not official DLH permit data."
    return events


def unlicensed_collectors_payload() -> dict[str, Any]:
    from app.collector_registry import scan_observed_vehicles

    observed = [
        {"plate": "B 9876 XX", "lat": -6.1670, "lng": 106.7630},
        {"plate": "Z 8842 KX", "lat": -6.1602, "lng": 106.8351},
        {"plate": "F 5521 QN", "lat": -6.2410, "lng": 106.9012},
    ]
    alerts = scan_observed_vehicles(observed)
    return {
        "observed_count": len(observed),
        "unauthorized_count": len(alerts),
        "alerts": alerts,
        "data_class": "SIMULATED",
        "data_note": "Illustrative observed vehicles; registry match against real DLH fleet plates.",
    }
