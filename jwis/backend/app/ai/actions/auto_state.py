"""Shared AI event feed — single source of truth for frontend notifications."""

from __future__ import annotations

import copy
import threading
from collections import deque
from dataclasses import asdict, dataclass


@dataclass
class AiEvent:
    event_type: str            # e.g. "auto_reroute", "auto_replay", "forecast_update"
    truck_code: str | None
    title: str
    detail: dict
    confidence: float
    created_at: str            # ISO 8601
    status: str = "new"        # "new" | "acknowledged"


class EventFeed:
    def __init__(self, maxlen: int = 200) -> None:
        self._events: deque[dict] = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def append(self, event: AiEvent) -> None:
        with self._lock:
            self._events.append(asdict(event))

    def snapshot(self) -> list[dict]:
        with self._lock:
            return copy.deepcopy(list(self._events))

    def acknowledge(self, event_index: int) -> bool:
        with self._lock:
            if 0 <= event_index < len(self._events):
                self._events[event_index]["status"] = "acknowledged"
                return True
            return False

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


EVENT_FEED = EventFeed(maxlen=200)
