"""Feature B: live TPA Bantargebang queue prediction from real truck positions."""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from datetime import datetime, timezone

from app.ai.base import GpsDataSource
from app.astar_routing import NODES
from app.queue_simulation import simulate_queue

# NODES values are (lat, lng, label) tuples; only the coordinates are needed here.
TPA_LAT, TPA_LNG = NODES["TPA_BANTARGEBANG"][0], NODES["TPA_BANTARGEBANG"][1]
EARTH_RADIUS_KM = 6371.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _congestion_level(wait_min: float) -> str:
    if wait_min < 10:
        return "low"
    if wait_min < 25:
        return "moderate"
    if wait_min < 45:
        return "high"
    return "severe"


class TpaQueuePredictor:
    def __init__(self, geofence_radius_m: float = 800.0, stopped_kmh: float = 3.0,
                 eta_window_min: float = 30.0, weighbridges: int = 2,
                 service_rate_per_hour: float = 30.0, trend_window: int = 20) -> None:
        self._radius_km = geofence_radius_m / 1000.0
        self._stopped_kmh = stopped_kmh
        self._eta_window_min = eta_window_min
        self._weighbridges = weighbridges
        self._service_rate = service_rate_per_hour
        self._wait_history: deque[float] = deque(maxlen=trend_window)
        self._arrivals: deque[float] = deque(maxlen=500)  # arrival epochs
        self._inside_prev: set[str] = set()
        self._latest: dict | None = None
        self._lock = threading.Lock()

    def update(self, source: GpsDataSource) -> dict:
        now = time.time()
        in_queue = 0
        arriving = 0
        inside_now: set[str] = set()
        for truck in source.current_positions():
            pos = truck.get("latest_position") or {}
            lat, lng = pos.get("lat"), pos.get("lng")
            if lat is None or lng is None:
                continue
            dist_km = _haversine_km(lat, lng, TPA_LAT, TPA_LNG)
            speed = pos.get("speed_kmh") or 0.0
            if dist_km <= self._radius_km:
                inside_now.add(truck["truck_code"])
                if speed < self._stopped_kmh:
                    in_queue += 1
                else:
                    arriving += 1
            elif truck.get("status") == "active" and speed > 0:
                eta_min = (dist_km / speed) * 60.0
                if eta_min <= self._eta_window_min:
                    arriving += 1

        for _ in (inside_now - self._inside_prev):
            self._arrivals.append(now)
        self._inside_prev = inside_now
        cutoff = now - 15 * 60
        while self._arrivals and self._arrivals[0] < cutoff:
            self._arrivals.popleft()
        arrival_rate_per_h = len(self._arrivals) * 4.0

        sim = simulate_queue(arrival_count=in_queue + arriving,
                             weighbridges=self._weighbridges,
                             service_rate_per_hour=self._service_rate)
        wait = round(sim["mean_wait_minutes"], 1)
        trend = self._trend()
        self._wait_history.append(wait)
        snap = {
            "trucks_in_queue": in_queue,
            "arriving_soon": arriving,
            "arrival_rate_per_h": arrival_rate_per_h,
            "predicted_wait_min": wait,
            "wait_ci95": sim["wait_ci95"],
            "trend": trend,
            "congestion_level": _congestion_level(wait),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            self._latest = snap
        return snap

    def latest(self) -> dict:
        with self._lock:
            return self._latest if self._latest is not None else {"status": "no_data"}

    def _trend(self) -> str:
        history = list(self._wait_history)
        if len(history) < 10:
            return "stable"
        prev = sum(history[-10:-5]) / 5
        recent = sum(history[-5:]) / 5
        if prev == 0:
            return "stable"
        delta = (recent - prev) / prev
        if delta > 0.10:
            return "rising"
        if delta < -0.10:
            return "falling"
        return "stable"
