"""Vehicle service history and next-due tracking (Fase 3)."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)

HEAVY_COMPONENTS = {"rem", "mesin", "ban"}


@dataclass
class ServiceRecord:
    record_id: str
    truck_code: str
    service_date: str
    component: str
    description: str
    cost_idr: int | None
    odometer_km: float | None
    technician: str
    source: str  # admin | damage_resolve
    next_due_date: str | None
    created_at: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_persist_path() -> str:
    db_path = os.environ.get("JWIS_DB_PATH")
    if db_path:
        return os.path.join(os.path.dirname(db_path), "jwis_service_history.json")
    return os.path.join(tempfile.gettempdir(), "jwis_service_history.json")


def due_date_for(component: str, from_date: date) -> str:
    days = 90 if component in HEAVY_COMPONENTS else 180
    return (from_date + timedelta(days=days)).isoformat()


class ServiceStore:
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
            logger.exception("service store corrupt at %s; starting empty", self._path)
            self._records = []

    def _save(self) -> None:
        try:
            with open(self._path, "w", encoding="utf-8") as fh:
                json.dump(self._records, fh, ensure_ascii=False, indent=1)
        except Exception:  # noqa: BLE001
            logger.exception("failed to persist service store to %s", self._path)

    def create(self, truck_code: str, service_date: str, component: str,
               description: str, cost_idr: int | None = None,
               odometer_km: float | None = None, technician: str = "",
               source: str = "admin",
               next_due_date: str | None = None) -> ServiceRecord:
        with self._lock:
            rec = ServiceRecord(
                record_id=uuid4().hex[:12], truck_code=truck_code,
                service_date=service_date, component=component,
                description=description, cost_idr=cost_idr,
                odometer_km=odometer_km, technician=technician,
                source=source, next_due_date=next_due_date,
                created_at=_utc_now())
            self._records.append(asdict(rec))
            self._save()
            return rec

    def list(self, truck_code: str | None = None) -> list[ServiceRecord]:
        with self._lock:
            items = [ServiceRecord(**raw) for raw in self._records]
        items.reverse()
        if truck_code is None:
            return items
        return [r for r in items if r.truck_code == truck_code]

    def latest_per_truck(self) -> dict[str, ServiceRecord]:
        latest: dict[str, ServiceRecord] = {}
        with self._lock:
            for raw in self._records:
                rec = ServiceRecord(**raw)
                prev = latest.get(rec.truck_code)
                if prev is None or rec.service_date >= prev.service_date:
                    latest[rec.truck_code] = rec
        return latest

    def due_soon(self, days: int = 30, today: str | None = None) -> list[dict]:
        ref = date.fromisoformat(today) if today else date.today()
        due: list[dict] = []
        for truck_code, rec in self.latest_per_truck().items():
            if not rec.next_due_date:
                continue
            try:
                due_date = date.fromisoformat(rec.next_due_date)
            except ValueError:
                continue
            days_left = (due_date - ref).days
            if days_left <= days:
                due.append({"truck_code": truck_code,
                            "component": rec.component,
                            "next_due_date": rec.next_due_date,
                            "days_left": days_left})
        due.sort(key=lambda d: d["days_left"])
        return due


SERVICE_STORE = ServiceStore()
