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

import time
import numpy as np

def get_road_following_path(truck_code: str) -> list[tuple[float, float]]:
    try:
        import json
        from pathlib import Path
        cache_path = Path(__file__).resolve().parent / "road_geometry_cache.json"
        if cache_path.exists():
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
            if truck_code == "T-047":
                from .astar_routing import is_traffic_jam_active
                key = "astar-diverted" if is_traffic_jam_active() else "astar-normal"
                active = cache.get(key, {})
                if active and active.get("path"):
                    return [(p["lat"], p["lng"]) for p in active["path"]]
            
            key = f"{truck_code}-actual"
            geom = cache.get(key, {}).get("geometry")
            if geom:
                return [(p["lat"], p["lng"]) for p in geom]
    except Exception:
        pass

    if truck_code == "T-047":
        from .astar_routing import is_traffic_jam_active
        from .astar_routing import reroute_payload
        res = reroute_payload(is_traffic_jam_active())
        if isinstance(res, dict):
            active_route = res.get("active_route")
            if isinstance(active_route, dict):
                path_data = active_route.get("path")
                if isinstance(path_data, list):
                    pts = [(p["lat"], p["lng"]) for p in path_data if isinstance(p, dict)]
                    if pts:
                        return pts

    path = ACTUAL_PATHS[truck_code]
    from .osrm import road_route
    r = road_route(path)
    if r.get("geometry"):
        return [(p["lat"], p["lng"]) for p in r["geometry"]]
    return path

def get_dynamic_position_at_time(truck_code: str, t_sec: float) -> tuple[float, float, float]:
    path = get_road_following_path(truck_code)
    n_segs = len(path) - 1
    if n_segs <= 0:
        return path[0][0], path[0][1], 30.0
        
    cycle_time = 90.0
    t = (t_sec % (2 * cycle_time)) / cycle_time
    if t > 1.0:
        t = 2.0 - t
        
    pos = t * n_segs
    idx = int(pos)
    frac = pos - idx
    if idx >= n_segs:
        return path[-1][0], path[-1][1], 0.0
        
    p1 = path[idx]
    p2 = path[idx+1]
    
    lat = p1[0] + (p2[0] - p1[0]) * frac
    lng = p1[1] + (p2[1] - p1[1]) * frac
    
    speed = 30.0 + 8.0 * np.sin(t_sec / 5.0)
    return lat, lng, float(speed)

def get_dynamic_position(truck_code: str) -> tuple[float, float, float]:
    return get_dynamic_position_at_time(truck_code, time.time())

class DynamicPositionsDict(dict):
    def __getitem__(self, key):
        lat, lng, _ = get_dynamic_position(key)
        return lat, lng

LATEST_POSITIONS = DynamicPositionsDict()

def _truck(truck_code: str, plate: str, driver: str, zone: str, status: str,
           damaged: bool, vehicle_type: str = "Compactor Besar") -> dict[str, Any]:
    lat, lng, speed = get_dynamic_position(truck_code)
    deviation = detect_route_deviation(ASSIGNED_PATHS[truck_code], (lat, lng), speed_kmh=speed)
    curr_status = "deviation" if deviation["violated"] else ("damaged" if damaged else "active")
    
    return {
        "truck_code": truck_code,
        "plate_number": plate,
        "driver_name": driver,
        "assigned_zone": zone,
        "vehicle_type": vehicle_type,
        "status": curr_status,
        "is_damaged": damaged,
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

def get_dynamic_trucks() -> list[dict[str, Any]]:
    return [
        _truck("T-001", "B 1234 CD", "Budi Santoso", "Jakarta Utara", "active", False, "Dump Truck Besar"),
        _truck("T-047", "B 5678 EF", "Agus Pratama", "Jakarta Barat", "deviation", False, "Compactor Besar"),
        _truck("T-088", "B 9012 GH", "Joko Wijaya", "Jakarta Selatan", "active", False, "Arm Roll Besar"),
        _truck("T-112", "B 4410 KL", "Rizky Maulana", "Jakarta Timur", "active", True, "Compactor Kecil"),
    ]

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


def build_predictions() -> list[dict[str, Any]]:
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
    base_trucks = 32 if (8 <= hour <= 10 or 14 <= hour <= 16) else 14
    sim = simulate_queue(base_trucks, weighbridges=2, service_rate_per_hour=30.0, seed=42)
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
        "osrm_route": fetch_osrm_route(
            "Route B - Daan Mogot Recovery",
            origin=LATEST_POSITIONS["T-047"],
            destination=ASSIGNED_PATHS["T-047"][-1],
        ),
        "predictions": predictions,
        "critical_predictions": critical_predictions[:8],
        "weather": weather_forecast,
        "dispatches": dispatches,
        "executive_summary": {
            "headline": headline,
            "points": points,
        },
    }


def fleet_history_payload(truck_code: str | None = None, date: str | None = None) -> list[dict[str, Any]]:
    from datetime import datetime, timedelta

    t_date = date or (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

    mock_trips = [
        {
            "truck_code": "T-001",
            "driver_name": "Budi Santoso",
            "date": t_date,
            "fuel_consumed_liters": 22.4,
            "distance_km": 68.2,
            "points": [
                {"lat": -6.1455, "lng": 106.8550, "timestamp": f"{t_date}T08:12:00Z"},
                {"lat": -6.1490, "lng": 106.8700, "timestamp": f"{t_date}T08:45:00Z"},
                {"lat": -6.1540, "lng": 106.8780, "timestamp": f"{t_date}T09:15:00Z"},
            ],
            "deviations_detected": 0, "deviations_count": 0
        },
        {
            "truck_code": "T-047",
            "driver_name": "Agus Pratama",
            "date": t_date,
            "fuel_consumed_liters": 31.8,
            "distance_km": 94.6,
            "points": [
                {"lat": -6.1649, "lng": 106.7415, "timestamp": f"{t_date}T07:44:00Z"},
                {"lat": -6.1664, "lng": 106.7638, "timestamp": f"{t_date}T08:10:00Z"},
                {"lat": -6.1949, "lng": 106.7898, "timestamp": f"{t_date}T08:35:00Z"},
            ],
            "deviations_detected": 1, "deviations_count": 1
        },
        {
            "truck_code": "T-088",
            "driver_name": "Joko Wijaya",
            "date": t_date,
            "fuel_consumed_liters": 19.5,
            "distance_km": 54.1,
            "points": [
                {"lat": -6.2910, "lng": 106.7840, "timestamp": f"{t_date}T08:05:00Z"},
                {"lat": -6.2900, "lng": 106.8070, "timestamp": f"{t_date}T08:38:00Z"},
                {"lat": -6.2870, "lng": 106.8290, "timestamp": f"{t_date}T09:02:00Z"},
            ],
            "deviations_detected": 0, "deviations_count": 0
        }
    ]

    if truck_code:
        mock_trips = [t for t in mock_trips if t["truck_code"] == truck_code]
    return mock_trips


def tpa_queue_status_payload() -> dict[str, Any]:
    import time
    from app.queue_simulation import simulate_queue

    hour = time.localtime().tm_hour
    base_trucks = 32 if (8 <= hour <= 10 or 14 <= hour <= 16) else 14

    sim = simulate_queue(base_trucks, weighbridges=2, service_rate_per_hour=30.0, seed=42)
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
