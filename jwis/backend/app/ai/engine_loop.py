"""Background engine loop: runs AI detectors/forecasters on a fixed tick.

One daemon thread owned by FastAPI startup. Every module failure is caught
and logged so one broken feature never kills the others. The engine only
starts when JWIS_AI_ENGINE=on (default off keeps tests deterministic).
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Callable

from app.ai.base import GpsDataSource, get_gps_source

logger = logging.getLogger(__name__)

ModuleFn = Callable[[GpsDataSource], None]


class AiEngine:
    def __init__(self, tick_seconds: float = 8.0,
                 source: GpsDataSource | None = None) -> None:
        self._tick_seconds = tick_seconds
        self._source = source or get_gps_source()
        self._modules: list[tuple[str, ModuleFn]] = []
        self._lock = threading.Lock()
        self._running = False
        self._thread: threading.Thread | None = None

    def register(self, name: str, fn: ModuleFn) -> None:
        self._modules.append((name, fn))

    def tick_once(self) -> dict[str, str]:
        results: dict[str, str] = {}
        for name, fn in self._modules:
            try:
                fn(self._source)
                results[name] = "ok"
            except Exception as exc:  # noqa: BLE001 — degradation by design
                logger.exception("AI module %s failed; skipping tick", name)
                results[name] = f"error: {exc}"
        return results

    def start(self) -> None:
        with self._lock:
            if self._running:
                return
            self._running = True
            self._thread = threading.Thread(
                target=self._loop, daemon=True, name="jwis-ai-engine"
            )
            self._thread.start()

    def stop(self) -> None:
        with self._lock:
            self._running = False
        if self._thread is not None:
            self._thread.join(timeout=5)
            self._thread = None

    def is_running(self) -> bool:
        with self._lock:
            return self._running

    def _loop(self) -> None:
        while True:
            with self._lock:
                if not self._running:
                    return
            self.tick_once()
            threading.Event().wait(self._tick_seconds)


def maybe_start_engine() -> AiEngine | None:
    """Start the engine only when explicitly enabled (JWIS_AI_ENGINE=on)."""
    if os.getenv("JWIS_AI_ENGINE", "off").lower() != "on":
        return None
    engine = AiEngine(tick_seconds=8.0)
    engine.start()
    return engine
