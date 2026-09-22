"""Feature A: automatically activate A* rerouting when the AI detects a jam.

The reroute happens in state immediately (set_traffic_jam_active) — the
frontend notification is acknowledge-only, not a gate.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone

from app.ai.actions.auto_state import AiEvent, EventFeed
from app.ai.base import GpsDataSource
from app.ai.detectors.speed_anomaly import SpeedAnomalyDetector
from app.astar_routing import (
    is_traffic_jam_active,
    route_from_truck,
    set_traffic_jam_active,
)

logger = logging.getLogger(__name__)

MANUAL_JAM_OVERRIDE_HOLD_SECONDS = 90.0
_manual_override_until = 0.0
_manual_override_lock = threading.Lock()


def note_manual_override(hold_seconds: float = MANUAL_JAM_OVERRIDE_HOLD_SECONDS) -> None:
    global _manual_override_until
    with _manual_override_lock:
        _manual_override_until = time.time() + hold_seconds


def manual_override_active() -> bool:
    with _manual_override_lock:
        return time.time() < _manual_override_until


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AutoRerouter:
    def __init__(self, detector: SpeedAnomalyDetector, feed: EventFeed) -> None:
        self._detector = detector
        self._feed = feed

    def run(self, source: GpsDataSource) -> dict:
        signals = self._detector.evaluate(source)
        jammed = [code for code, sig in signals.items() if sig.jammed]
        jam_active = is_traffic_jam_active()
        rerouted: list[str] = []
        cleared = False

        if manual_override_active():
            return {"jammed_trucks": jammed, "jam_active": jam_active,
                    "rerouted": rerouted, "cleared": cleared,
                    "manual_override": True}

        if jammed and not jam_active:
            set_traffic_jam_active(True)
            jam_active = True
            trucks = {t["truck_code"]: t for t in source.current_positions()}
            for code in jammed:
                truck = trucks.get(code, {})
                position = truck.get("latest_position", {})
                try:
                    route = route_from_truck(position) if position else {"success": False}
                except Exception as exc:  # noqa: BLE001
                    logger.exception("auto-reroute failed for %s", code)
                    route = {"success": False, "message": str(exc)}
                if route.get("success"):
                    rerouted.append(code)
                self._feed.append(AiEvent(
                    event_type="auto_reroute",
                    truck_code=code,
                    title=f"Kemacetan terdeteksi — {code} dialihkan otomatis",
                    detail={
                        "avg_speed_kmh": signals[code].avg_speed_kmh,
                        "reroute_success": bool(route.get("success")),
                        "new_distance_km": route.get("distance_km"),
                        "new_eta_minutes": route.get("eta_minutes"),
                        "reason": "avg speed below 15 km/h for 3 consecutive ticks",
                    },
                    confidence=0.85,
                    created_at=_utc_now(),
                ))
        elif not jammed and jam_active:
            set_traffic_jam_active(False)
            jam_active = False
            cleared = True
            self._feed.append(AiEvent(
                event_type="jam_cleared",
                truck_code=None,
                title="Kemacetan teratasi — koridor kembali normal",
                detail={"reason": "speed above 25 km/h for 2 consecutive ticks"},
                confidence=0.85,
                created_at=_utc_now(),
            ))

        return {"jammed_trucks": jammed, "jam_active": jam_active,
                "rerouted": rerouted, "cleared": cleared}
