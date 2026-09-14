"""Pre-trip inspection records (Fase 2 Driver PWA)."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)

PRETRIP_ITEMS = ("rem", "mesin", "ban", "bbm", "oli", "bak_compactor", "lampu")


@dataclass
class PreTripRecord:
    record_id: str
    truck_code: str
    driver_name: str
    date: str
    items: dict[str, bool]
    note: str
    created_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _default_persist_path() -> str:
    db_path = os.environ.get("JWIS_DB_PATH")
    if db_path:
        return os.path.join(os.path.dirname(db_path), "jwis_pretrip.json")
    return os.path.join(tempfile.gettempdir(), "jwis_pretrip.json")


class PreTripStore:
    def __init__(self, persist_path: str | None = None) -> None:
        self._path = persist_path or _default_persist_path()
        self._records: list[dict] = []
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, encoding="utf-8") as fh:
                self._records = json.load(fh)
        except Exception:  # noqa: BLE001
            logger.exception("pretrip store corrupt at %s; starting empty", self._path)
            self._records = []

    def _save(self) -> None:
        try:
            with open(self._path, "w", encoding="utf-8") as fh:
                json.dump(self._records, fh, ensure_ascii=False, indent=1)
        except Exception:  # noqa: BLE001
            logger.exception("failed to persist pretrip store to %s", self._path)

    def submit(self, truck_code: str, driver_name: str,
               items: dict[str, bool], note: str = "") -> PreTripRecord:
        if set(items.keys()) != set(PRETRIP_ITEMS):
            raise ValueError(f"items must contain exactly: {PRETRIP_ITEMS}")
        if any(not v for v in items.values()) and not note.strip():
            raise ValueError("note is required when any inspection item fails")
        with self._lock:
            rec = PreTripRecord(
                record_id=uuid4().hex[:12], truck_code=truck_code,
                driver_name=driver_name, date=_today(),
                items={k: bool(v) for k, v in items.items()},
                note=note.strip(), created_at=_utc_now())
            self._records.append(asdict(rec))
            self._save()
            return rec

    def today(self, truck_code: str) -> PreTripRecord | None:
        today = _today()
        with self._lock:
            for raw in reversed(self._records):
                if raw["truck_code"] == truck_code and raw["date"] == today:
                    return PreTripRecord(**raw)
        return None

    def list_recent(self, truck_code: str, days: int = 30) -> list[PreTripRecord]:
        with self._lock:
            records = [PreTripRecord(**raw) for raw in self._records
                       if raw["truck_code"] == truck_code]
        return list(reversed(records))[:days]


PRETRIP_STORE = PreTripStore()
