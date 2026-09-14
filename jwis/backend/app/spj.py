"""SPJ (Surat Perintah Jalan) engine — work orders as route ground truth.

An active SPJ becomes the truck's assigned reference path: the existing
deviation detector (rule 500m + IsolationForest + hysteresis) then measures
compliance against the SPJ stops without any change to detection logic.
"""

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

DESTINATIONS = ("TPST Bantargebang", "JRC Pesanggrahan", "RDF Plant Jakarta")


@dataclass
class SpjStop:
    name: str
    kecamatan: str
    address: str
    lat: float
    lng: float
    location_type: str = "Pemukiman Kelas Menengah"
    status: str = "pending"  # pending | completed
    completed_at: str | None = None


@dataclass
class Spj:
    spj_id: str
    spj_number: str
    date: str
    driver_name: str
    truck_code: str
    destination: str
    weigh_on_site: bool = False
    priority: str = "normal"  # normal | vip
    note: str = ""
    stops: list[SpjStop] = field(default_factory=list)
    status: str = "draft"  # draft | aktif | selesai | batal
    created_by: str = "admin"
    created_at: str = ""
    activated_at: str | None = None
    completed_at: str | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def next_spj_number(store: "SpjStore") -> str:
    today = datetime.now(timezone.utc)
    prefix = today.strftime("DLH-DKI/SPJ/%d-%m-%Y/")
    max_seq = 0
    for spj in store.list():
        if spj.spj_number.startswith(prefix):
            try:
                max_seq = max(max_seq, int(spj.spj_number.rsplit("/", 1)[1]))
            except (ValueError, IndexError):
                continue
    return f"{prefix}{max_seq + 1:06d}"


def _default_persist_path() -> str:
    db_path = os.environ.get("JWIS_DB_PATH")
    if db_path:
        return os.path.join(os.path.dirname(db_path), "jwis_spj.json")
    return os.path.join(tempfile.gettempdir(), "jwis_spj.json")


class SpjStore:
    def __init__(self, persist_path: str | None = None) -> None:
        self._path = persist_path or _default_persist_path()
        self._spj: dict[str, Spj] = {}
        self._lock = threading.RLock()  # reentrant: create/activate call locked helpers
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self._path):
            return
        try:
            raw = json.loads(open(self._path, encoding="utf-8").read())
            for item in raw:
                stops = [SpjStop(**s) for s in item.pop("stops", [])]
                spj = Spj(stops=stops, **item)
                self._spj[spj.spj_id] = spj
        except Exception:  # noqa: BLE001
            logger.exception("SPJ store corrupt at %s; starting empty", self._path)
            self._spj = {}

    def _save(self) -> None:
        try:
            payload = [asdict(s) for s in self._spj.values()]
            with open(self._path, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, ensure_ascii=False, indent=1)
        except Exception:  # noqa: BLE001
            logger.exception("failed to persist SPJ store to %s", self._path)

    def create(self, driver_name: str, truck_code: str, destination: str,
               weigh_on_site: bool, priority: str, note: str,
               created_by: str = "admin") -> Spj:
        if destination not in DESTINATIONS:
            raise ValueError(f"destination must be one of {DESTINATIONS}")
        if priority not in ("normal", "vip"):
            raise ValueError("priority must be 'normal' or 'vip'")
        with self._lock:
            spj = Spj(spj_id=uuid4().hex[:12], spj_number=next_spj_number(self),
                      date=_today(), driver_name=driver_name, truck_code=truck_code,
                      destination=destination, weigh_on_site=weigh_on_site,
                      priority=priority, note=note, created_by=created_by,
                      created_at=_utc_now())
            self._spj[spj.spj_id] = spj
            self._save()
            return spj

    def get(self, spj_id: str) -> Spj | None:
        with self._lock:
            return self._spj.get(spj_id)

    def list(self, status: str | None = None) -> list[Spj]:
        with self._lock:
            items = list(self._spj.values())
        if status is None:
            return items
        return [s for s in items if s.status == status]

    def active_for_truck(self, truck_code: str) -> Spj | None:
        with self._lock:
            for spj in self._spj.values():
                if spj.truck_code == truck_code and spj.status == "aktif":
                    return spj
        return None

    def add_stop(self, spj_id: str, name: str, kecamatan: str, address: str,
                 lat: float, lng: float,
                 location_type: str = "Pemukiman Kelas Menengah") -> Spj:
        with self._lock:
            spj = self._require(spj_id)
            if spj.status != "draft":
                raise ValueError("stops can only be added to a draft SPJ")
            spj.stops.append(SpjStop(name=name, kecamatan=kecamatan,
                                     address=address, lat=lat, lng=lng,
                                     location_type=location_type))
            self._save()
            return spj

    def activate(self, spj_id: str) -> Spj:
        with self._lock:
            spj = self._require(spj_id)
            if spj.status != "draft":
                raise ValueError(f"cannot activate SPJ in status '{spj.status}'")
            if not spj.stops:
                raise ValueError("SPJ needs at least one stop before activation")
            if self.active_for_truck(spj.truck_code) is not None:
                raise ValueError(
                    f"truck {spj.truck_code} already has an active SPJ")
            spj.status = "aktif"
            spj.activated_at = _utc_now()
            self._save()
            return spj

    def complete_stop(self, spj_id: str, index: int) -> Spj:
        with self._lock:
            spj = self._require(spj_id)
            if spj.status != "aktif":
                raise ValueError("stops can only be completed on an active SPJ")
            if not 0 <= index < len(spj.stops):
                raise ValueError(f"stop index {index} out of range")
            stop = spj.stops[index]
            if stop.status == "completed":
                return spj
            stop.status = "completed"
            stop.completed_at = _utc_now()
            if all(s.status == "completed" for s in spj.stops):
                spj.status = "selesai"
                spj.completed_at = _utc_now()
            self._save()
            return spj

    def complete(self, spj_id: str) -> Spj:
        with self._lock:
            spj = self._require(spj_id)
            if spj.status != "aktif":
                raise ValueError(f"cannot complete SPJ in status '{spj.status}'")
            spj.status = "selesai"
            spj.completed_at = _utc_now()
            for stop in spj.stops:
                if stop.status != "completed":
                    stop.status = "completed"
                    stop.completed_at = spj.completed_at
            self._save()
            return spj

    def cancel(self, spj_id: str) -> Spj:
        with self._lock:
            spj = self._require(spj_id)
            if spj.status not in ("draft", "aktif"):
                raise ValueError(f"cannot cancel SPJ in status '{spj.status}'")
            spj.status = "batal"
            self._save()
            return spj

    def _require(self, spj_id: str) -> Spj:
        spj = self._spj.get(spj_id)
        if spj is None:
            raise ValueError(f"SPJ {spj_id} not found")
        return spj


from app.astar_routing import NODES as _ASTAR_NODES

_TPA = _ASTAR_NODES["TPA_BANTARGEBANG"]
# JRC/RDF coordinates are approximate, non-official placeholders.
DESTINATION_COORDS: dict[str, tuple[float, float]] = {
    "TPST Bantargebang": (_TPA[0], _TPA[1]),
    "JRC Pesanggrahan": (-6.2594, 106.7640),
    "RDF Plant Jakarta": (-6.1340, 106.8850),
}


def spj_polyline(spj: Spj) -> list[tuple[float, float]]:
    """Stops in order + destination as a straight-segment polyline.

    Straight segments are sufficient for the 500 m deviation detector —
    SPJ stops in Jakarta are typically >1 km apart and deviation is measured
    to the nearest segment. Upgrading each leg to road-following OSRM
    geometry is the Fase 4 live-integration path.
    """
    points: list[tuple[float, float]] = []
    for stop in spj.stops:
        pt = (stop.lat, stop.lng)
        if not points or points[-1] != pt:
            points.append(pt)
    dest = DESTINATION_COORDS[spj.destination]
    if not points or points[-1] != dest:
        points.append(dest)
    return points


def active_path_for(truck_code: str) -> list[tuple[float, float]] | None:
    try:
        spj = SPJ_STORE.active_for_truck(truck_code)
        if spj is None:
            return None
        line = spj_polyline(spj)
        if len(line) < 2:
            return None
        return line
    except Exception:  # noqa: BLE001
        logger.exception("active_path_for(%s) failed; using corridor fallback",
                         truck_code)
        return None


def _maybe_seed(store: SpjStore) -> None:
    if os.path.exists(store._path) or os.getenv("JWIS_SPJ_SEED", "on") == "off":
        return
    seed = store.create(
        driver_name="Joko Wijaya", truck_code="T-088",
        destination="TPST Bantargebang", weigh_on_site=True,
        priority="normal", note="Seed demo SPJ", created_by="seed")
    for name, kec, addr, lat, lng in [
        ("APARTEMEN ICON - PPPSRS", "Kebayoran Lama",
         "Jl. Ciledug Raya No 35, Cipulir", -6.2379, 106.7826),
        ("APARTEMENT BONA VISTA - PPPSRS", "Cilandak",
         "Bona Vista Raya", -6.2917, 106.7975),
        ("APT PERMATA SURYA", "Kalideres",
         "Jl. Boulevard Raya, Taman Surya 5, Pegadungan", -6.1590, 106.7160),
    ]:
        store.add_stop(seed.spj_id, name=name, kecamatan=kec, address=addr,
                       lat=lat, lng=lng)
    store.activate(seed.spj_id)


def _init_store() -> SpjStore:
    store = SpjStore()
    _maybe_seed(store)
    return store


SPJ_STORE = _init_store()
