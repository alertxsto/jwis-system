"""Feature A: detect corridor jams from GPS speed drops, with hysteresis."""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.base import GpsDataSource


@dataclass
class JamSignal:
    truck_code: str
    avg_speed_kmh: float
    jammed: bool
    ticks_below: int


class SpeedAnomalyDetector:
    def __init__(self, slow_kmh: float = 15.0, clear_kmh: float = 25.0,
                 slow_ticks: int = 3, clear_ticks: int = 2,
                 crumb_points: int = 6) -> None:
        self._slow_kmh = slow_kmh
        self._clear_kmh = clear_kmh
        self._slow_ticks = slow_ticks
        self._clear_ticks = clear_ticks
        self._crumb_points = crumb_points
        self._state: dict[str, dict] = {}  # truck_code -> {"jammed","below","above"}

    def reset(self) -> None:
        self._state.clear()

    def evaluate(self, source: GpsDataSource) -> dict[str, JamSignal]:
        signals: dict[str, JamSignal] = {}
        for truck in source.current_positions():
            code = truck["truck_code"]
            crumbs = source.breadcrumbs(code, points=self._crumb_points)
            if not crumbs:
                continue
            avg_speed = sum(c.speed_kmh for c in crumbs) / len(crumbs)
            st = self._state.setdefault(
                code, {"jammed": False, "below": 0, "above": 0})
            if avg_speed < self._slow_kmh:
                st["below"] += 1
                st["above"] = 0
            elif avg_speed > self._clear_kmh:
                st["above"] += 1
                st["below"] = 0
            else:
                st["below"] = 0
                st["above"] = 0
            if not st["jammed"] and st["below"] >= self._slow_ticks:
                st["jammed"] = True
            elif st["jammed"] and st["above"] >= self._clear_ticks:
                st["jammed"] = False
            signals[code] = JamSignal(truck_code=code,
                                      avg_speed_kmh=round(avg_speed, 2),
                                      jammed=st["jammed"],
                                      ticks_below=st["below"])
        return signals
