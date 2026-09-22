"""Feature E: flag unlicensed collectors by stop patterns far from official sites."""

from __future__ import annotations

import math
import threading
import time
from datetime import datetime, timezone
from typing import Callable

from app.data import unlicensed_collectors_payload
from app.real_data import load_real_tps_coordinates, load_real_wr_coordinates

EARTH_RADIUS_M = 6_371_000.0


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def _default_observer() -> list[dict]:
    return unlicensed_collectors_payload().get("alerts", [])


class StopPatternDetector:
    def __init__(self, stop_radius_m: float = 50.0, stop_minutes: float = 10.0,
                 official_site_m: float = 300.0, dedup_hours: float = 6.0,
                 observer: Callable[[], list[dict]] | None = None,
                 now_fn: Callable[[], float] = time.time) -> None:
        self._stop_radius_m = stop_radius_m
        self._stop_seconds = stop_minutes * 60.0
        self._official_site_m = official_site_m
        self._dedup_seconds = dedup_hours * 3600.0
        self._observe = observer or _default_observer
        self._now = now_fn
        self._observations: dict[str, list[tuple[float, float, float]]] = {}
        self._flags: dict[str, dict] = {}
        self._last_flag_at: dict[str, float] = {}
        self._lock = threading.Lock()

    def scan(self) -> list[dict]:
        now = self._now()
        for entry in self._observe():
            plate = entry.get("plate")
            lat, lng = entry.get("lat"), entry.get("lng")
            if plate is None or lat is None or lng is None:
                continue
            trail = self._observations.setdefault(plate, [])
            if trail and _haversine_m(trail[-1][0], trail[-1][1],
                                      lat, lng) > self._stop_radius_m:
                trail.clear()  # moved — reset stop accumulation
            trail.append((lat, lng, now))
            stopped_seconds = now - trail[0][2]
            if stopped_seconds < self._stop_seconds:
                continue
            nearest_m = self._nearest_official_site_m(lat, lng)
            if nearest_m <= self._official_site_m:
                continue
            if now - self._last_flag_at.get(plate, -1e18) < self._dedup_seconds:
                continue
            self._last_flag_at[plate] = now
            duration_min = round(stopped_seconds / 60.0, 1)
            confidence = round(min(
                0.95,
                0.5 + 0.1 * (duration_min / (self._stop_seconds / 60.0) - 1)
                + 0.2 * (nearest_m / 1000.0),
            ), 2)
            with self._lock:
                self._flags[plate] = {
                    "collector_id": plate,
                    "lat": lat,
                    "lng": lng,
                    "duration_min": duration_min,
                    "nearest_site_m": round(nearest_m, 1),
                    "confidence": confidence,
                    "first_seen": datetime.fromtimestamp(
                        trail[0][2], tz=timezone.utc).isoformat(),
                    "classification": "simulated",
                }
        return self.flags()

    def flags(self) -> list[dict]:
        with self._lock:
            return [dict(f) for f in self._flags.values()]

    def _nearest_official_site_m(self, lat: float, lng: float) -> float:
        best = float("inf")
        for site in load_real_tps_coordinates() + load_real_wr_coordinates():
            d = _haversine_m(lat, lng, site["lat"], site["lng"])
            if d < best:
                best = d
        return best
