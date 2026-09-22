"""Feature C: emit auto-replay events on the rising edge of route deviation."""

from __future__ import annotations

import time
from datetime import datetime, timezone

from app.ai.actions.auto_state import AiEvent, EventFeed
from app.ai.base import GpsDataSource


class DeviationTrigger:
    def __init__(self, feed: EventFeed, cooldown_seconds: float = 300.0) -> None:
        self._feed = feed
        self._cooldown = cooldown_seconds
        self._prev: dict[str, bool] = {}
        self._last_emit: dict[str, float] = {}

    def check(self, source: GpsDataSource) -> list[str]:
        now = time.time()
        fired: list[str] = []
        for truck in source.current_positions():
            code = truck["truck_code"]
            deviation = truck.get("deviation") or {}
            violated = bool(deviation.get("violated"))
            was = self._prev.get(code, False)
            self._prev[code] = violated
            if not violated or was:
                continue
            if now - self._last_emit.get(code, 0.0) < self._cooldown:
                continue
            self._last_emit[code] = now
            fired.append(code)
            self._feed.append(AiEvent(
                event_type="auto_replay",
                truck_code=code,
                title=f"Replay otomatis: {code} menyimpang dari koridor",
                detail={
                    "distance_meters": deviation.get("distance_meters"),
                    "severity": deviation.get("severity"),
                },
                confidence=0.9,
                created_at=datetime.now(timezone.utc).isoformat(),
            ))
        return fired
