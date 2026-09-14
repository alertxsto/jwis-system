"""Driver damage reports with fleet-status override (Fase 2 Driver PWA)."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)

SEVERITIES = ("ringan", "berat")


@dataclass
class DamageReport:
    report_id: str
    truck_code: str
    driver_name: str
    component: str
    severity: str  # ringan | berat
    note: str
    photo_name: str | None
    photo_b64: str | None
    source: str  # driver_pwa | pretrip
    status: str  # baru | selesai
    created_at: str
    resolved_at: str | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_persist_path() -> str:
    db_path = os.environ.get("JWIS_DB_PATH")
    if db_path:
        return os.path.join(os.path.dirname(db_path), "jwis_damage_reports.json")
    return os.path.join(tempfile.gettempdir(), "jwis_damage_reports.json")


class DamageReportStore:
    def __init__(self, persist_path: str | None = None) -> None:
        self._path = persist_path or _default_persist_path()
        self._reports: list[dict] = []
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            with open(self._path, encoding="utf-8") as fh:
                self._reports = json.load(fh)
        except Exception:  # noqa: BLE001
            logger.exception("damage report store corrupt at %s; starting empty",
                             self._path)
            self._reports = []

    def _save(self) -> None:
        try:
            with open(self._path, "w", encoding="utf-8") as fh:
                json.dump(self._reports, fh, ensure_ascii=False, indent=1)
        except Exception:  # noqa: BLE001
            logger.exception("failed to persist damage reports to %s", self._path)

    def create(self, truck_code: str, driver_name: str, component: str,
               severity: str, note: str, photo_name: str | None = None,
               photo_b64: str | None = None,
               source: str = "driver_pwa") -> DamageReport:
        if severity not in SEVERITIES:
            raise ValueError(f"severity must be one of {SEVERITIES}")
        with self._lock:
            rep = DamageReport(
                report_id=uuid4().hex[:12], truck_code=truck_code,
                driver_name=driver_name, component=component,
                severity=severity, note=note, photo_name=photo_name,
                photo_b64=photo_b64, source=source, status="baru",
                created_at=_utc_now())
            self._reports.append(asdict(rep))
            self._save()
            return rep

    def list(self, status: str | None = None) -> list[DamageReport]:
        with self._lock:
            items = [DamageReport(**raw) for raw in self._reports]
        items.reverse()
        if status is None:
            return items
        return [r for r in items if r.status == status]

    def resolve(self, report_id: str) -> DamageReport:
        with self._lock:
            for raw in self._reports:
                if raw["report_id"] == report_id:
                    if raw["status"] == "selesai":
                        raise ValueError(f"report {report_id} already resolved")
                    raw["status"] = "selesai"
                    raw["resolved_at"] = _utc_now()
                    self._save()
                    return DamageReport(**raw)
        raise ValueError(f"report {report_id} not found")

    def active_override_for(self, truck_code: str) -> DamageReport | None:
        with self._lock:
            for raw in reversed(self._reports):
                if (raw["truck_code"] == truck_code
                        and raw["severity"] == "berat"
                        and raw["status"] != "selesai"):
                    return DamageReport(**raw)
        return None


DAMAGE_STORE = DamageReportStore()
