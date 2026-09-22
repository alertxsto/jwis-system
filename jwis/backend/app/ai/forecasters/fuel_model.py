"""Feature H: per-trip fuel & CO2 auto-calculation from GPS breadcrumbs.

All factors are reference values (classification="reference", consistent
with app/impact.py) — not measured fleet telemetry.
"""

from __future__ import annotations

import math
import threading
from datetime import datetime, timezone

from app.ai.base import GpsDataSource

EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


class CarbonCalculator:
    BASE_RATE_EMPTY_L_PER_KM = 0.35
    BASE_RATE_FULL_L_PER_KM = 0.55
    IDLE_RATE_L_PER_H = 1.2
    STOPGO_PENALTY = 0.15
    STOPGO_KMH = 20.0
    IDLE_KMH = 3.0
    CO2_KG_PER_L = 2.68  # diesel B35 reference factor

    def __init__(self, crumb_points: int = 30, crumb_interval_s: float = 6.0) -> None:
        self._crumb_points = crumb_points
        self._crumb_interval_s = crumb_interval_s
        self._latest: dict | None = None
        self._lock = threading.Lock()

    @staticmethod
    def trip_fuel_l(distance_km: float, load_ratio: float, idle_h: float,
                    stopgo_km: float) -> float:
        ratio = max(0.0, min(1.0, load_ratio))
        rate = (CarbonCalculator.BASE_RATE_EMPTY_L_PER_KM
                + (CarbonCalculator.BASE_RATE_FULL_L_PER_KM
                   - CarbonCalculator.BASE_RATE_EMPTY_L_PER_KM) * ratio)
        stopgo_km = min(stopgo_km, distance_km)
        cruise_km = distance_km - stopgo_km
        return (cruise_km * rate
                + stopgo_km * rate * (1 + CarbonCalculator.STOPGO_PENALTY)
                + idle_h * CarbonCalculator.IDLE_RATE_L_PER_H)

    def update(self, source: GpsDataSource) -> dict:
        per_truck: list[dict] = []
        for truck in source.current_positions():
            code = truck["truck_code"]
            crumbs = source.breadcrumbs(code, points=self._crumb_points)
            if len(crumbs) < 2:
                continue
            distance_km = 0.0
            stopgo_km = 0.0
            idle_intervals = 0
            for prev, cur in zip(crumbs, crumbs[1:]):
                seg_km = _haversine_km(prev.lat, prev.lng, cur.lat, cur.lng)
                distance_km += seg_km
                if cur.speed_kmh < self.IDLE_KMH:
                    idle_intervals += 1
                elif cur.speed_kmh < self.STOPGO_KMH:
                    stopgo_km += seg_km
            idle_h = idle_intervals * self._crumb_interval_s / 3600.0
            fuel_l = self.trip_fuel_l(distance_km, load_ratio=0.5,
                                      idle_h=idle_h, stopgo_km=stopgo_km)
            per_truck.append({
                "truck_code": code,
                "distance_km": round(distance_km, 3),
                "fuel_l": round(fuel_l, 3),
                "co2_kg": round(fuel_l * self.CO2_KG_PER_L, 3),
            })

        total_fuel = round(sum(t["fuel_l"] for t in per_truck), 2)
        total_km = round(sum(t["distance_km"] for t in per_truck), 2)
        baseline_fuel = round(total_km * self.BASE_RATE_FULL_L_PER_KM, 2)
        snap = {
            "date": datetime.now(timezone.utc).date().isoformat(),
            "trips": len(per_truck),
            "total_distance_km": total_km,
            "fuel_l": total_fuel,
            "co2_kg": round(total_fuel * self.CO2_KG_PER_L, 2),
            "per_truck": per_truck,
            "baseline_fuel_l": baseline_fuel,
            "fuel_saved_l": round(max(0.0, baseline_fuel - total_fuel), 2),
            "classification": "reference",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._latest = snap
        return snap

    def latest(self) -> dict:
        with self._lock:
            return self._latest if self._latest is not None else {"status": "no_data"}
