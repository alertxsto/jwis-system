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

LATEST_POSITIONS = {truck_code: path[-1] for truck_code, path in ACTUAL_PATHS.items()}


def _truck(truck_code: str, plate: str, driver: str, zone: str, status: str,
           damaged: bool, vehicle_type: str = "Compactor Besar") -> dict[str, Any]:
    deviation = detect_route_deviation(ASSIGNED_PATHS[truck_code], LATEST_POSITIONS[truck_code])
    return {
        "truck_code": truck_code,
        "plate_number": plate,
        "driver_name": driver,
        "assigned_zone": zone,
        "vehicle_type": vehicle_type,
        "status": status,
        "is_damaged": damaged,
        "latest_position": {
            "lat": LATEST_POSITIONS[truck_code][0],
            "lng": LATEST_POSITIONS[truck_code][1],
            "speed_kmh": 18 if deviation["violated"] else 34,
            "updated_seconds_ago": 24,
        },
        "assigned_path": [{"lat": lat, "lng": lng} for lat, lng in ASSIGNED_PATHS[truck_code]],
        "actual_path": [{"lat": lat, "lng": lng} for lat, lng in ACTUAL_PATHS[truck_code]],
        "deviation": deviation,
    }


# Vehicle types below are real DKI fleet categories (from data_truk_sampah_dki.csv).
TRUCKS = [
    _truck("T-001", "B 1234 CD", "Budi Santoso", "Jakarta Utara", "active", False, "Dump Truck Besar"),
    _truck("T-047", "B 5678 EF", "Agus Pratama", "Jakarta Barat", "deviation", False, "Compactor Besar"),
    _truck("T-088", "B 9012 GH", "Joko Wijaya", "Jakarta Selatan", "active", False, "Arm Roll Besar"),
    _truck("T-112", "B 4410 KL", "Rizky Maulana", "Jakarta Timur", "active", True, "Compactor Kecil"),
    _truck("T-136", "B 7781 MN", "Sari Nurlaila", "Jakarta Timur", "active", False, "Dump Truck Kecil"),
]

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
    # Baselines are real per-city daily waste generation (timbulan) from SIPSN
    # KLHK when available; the numeric literals are only used as a fallback if
    # the real dataset is missing. Other columns (rainfall/attendance/weekend)
    # remain scenario inputs for the forward-looking forecast.
    districts = [
        ("Jakarta Barat", baseline_tons_for("Jakarta Barat", 1280), 42, 85_000, True),
        ("Jakarta Utara", baseline_tons_for("Jakarta Utara", 1190), 18, 12_000, True),
        ("Jakarta Timur", baseline_tons_for("Jakarta Timur", 1510), 7, 0, False),
        ("Jakarta Selatan", baseline_tons_for("Jakarta Selatan", 1365), 11, 24_000, False),
        ("Jakarta Pusat", baseline_tons_for("Jakarta Pusat", 990), 5, 55_000, True),
    ]
    today = date.today()
    predictions = []
    for day in range(1, 8):
        for district, baseline, rainfall, attendance, weekend_event in districts:
            risk = forecast_waste_risk(
                baseline_tons=baseline + day * 11,
                rainfall_mm=max(0, rainfall - day * 4),
                expected_attendance=attendance if day in (1, 2, 3) else int(attendance * 0.2),
                is_weekend=weekend_event and day <= 2,
            )
            predictions.append(
                {
                    "district": district,
                    "date": (today + timedelta(days=day)).isoformat(),
                    **risk,
                }
            )
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
    predictions = build_predictions()
    critical_predictions = [item for item in predictions if item["risk_level"] in {"critical", "high"}]
    active_alerts = build_alerts()
    weather_forecast = weather or {"source": "not-loaded", "forecast": []}
    weather_peak = max(
        weather_forecast.get("forecast", []),
        key=lambda item: item.get("waste_impact_percent", 0),
        default={},
    )
    return {
        "generated_at": date.today().isoformat(),
        "kpis": {
            "active_trucks": sum(1 for truck in TRUCKS if truck["status"] in {"active", "deviation"}),
            "trucks_with_issues": sum(1 for truck in TRUCKS if truck["deviation"]["violated"] or truck["is_damaged"]),
            "tpa_queue_trucks": 47,
            "tpa_wait_minutes": 116,
            "predicted_spike_percent": max(item["spike_percent"] for item in predictions),
            "pending_dispatches": sum(1 for item in dispatches if item["field_status"] == "PENDING"),
        },
        "tpa_queue": {
            "status": "red",
            "trucks_waiting": 47,
            "estimated_wait_minutes": 116,
            "throughput_trucks_per_hour": 31,
            "recommendation": "Delay non-critical departures by 45 minutes and prioritize West Jakarta event waste.",
        },
        "trucks": TRUCKS,
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
            "headline": "West Jakarta requires immediate capacity reinforcement within 48 hours.",
            "points": [
                f"Largest forecasted spike is driven by heavy rainfall, a large permitted event, and weekend activity; weather impact peaks at +{weather_peak.get('waste_impact_percent', 16)}%.",
                "T-047 is outside the assigned corridor and should be redirected through Route B.",
                "TPA Bantargebang queue is above the operational threshold; dispatch timing should be staggered.",
                "Recommended action: add 28 trucks and 14 crews across high-risk districts for the next two days.",
            ],
        },
    }
