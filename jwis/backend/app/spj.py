"""SPJ (Surat Perintah Jalan) engine — work orders as route ground truth.

An active SPJ becomes the truck's assigned reference path: the existing
deviation detector (rule 500m + IsolationForest + hysteresis) then measures
compliance against the SPJ stops without any change to detection logic.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import tempfile
import threading
from contextlib import closing
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from uuid import uuid4

logger = logging.getLogger(__name__)

DESTINATIONS = ("TPST Bantargebang", "JRC Pesanggrahan", "RDF Plant Jakarta")

MAX_EVIDENCE_PHOTO_CHARS = 7_000_000


def _validate_evidence(evidence: dict) -> None:
    arrival = evidence.get("arrival") or {}
    if not arrival.get("photo_name"):
        raise ValueError("evidence.arrival.photo_name is required")
    photos = [arrival.get("photo_b64"), (evidence.get("officer") or {}).get("photo_b64")]
    photos += [w.get("photo_b64") for w in (evidence.get("weighing") or [])]
    for photo in photos:
        if photo and len(photo) > MAX_EVIDENCE_PHOTO_CHARS:
            raise ValueError("evidence photo_b64 exceeds 7,000,000 chars")


def spj_summary_payload(spj: Spj) -> dict:
    """List projection: stop evidence and the receipt photo stay out.

    Receipt metadata is small and drives the driver's pending-receipt task;
    the image bytes are served only by the detail endpoint.
    """
    payload = {key: value for key, value in vars(spj).items() if key != "stops"}
    payload["stops"] = []
    for stop in spj.stops:
        item = {key: value for key, value in vars(stop).items() if key != "evidence"}
        evidence = stop.evidence
        if evidence is None:
            item["evidence_summary"] = None
        else:
            weighing = evidence.get("weighing") or []
            item["evidence_summary"] = {
                "has_evidence": True,
                "weighing_count": len(weighing),
                "total_weight_kg": round(
                    sum(float(w.get("weight_kg") or 0) for w in weighing), 1),
            }
        payload["stops"].append(item)
    return payload


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
    evidence: dict | None = None


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
    receipt: dict | None = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def next_spj_number(store: "SpjStore") -> str:
    """Next daily sequence number, read from the database (not the cache).

    Reading from SQLite is what makes the number multi-process safe: every
    worker sees committed numbers from other workers.
    """
    today = datetime.now(timezone.utc)
    prefix = today.strftime("DLH-DKI/SPJ/%d-%m-%Y/")
    with closing(store._connect()) as connection:
        row = connection.execute(
            "SELECT MAX(CAST(SUBSTR(spj_number, ?) AS INTEGER)) AS max_seq "
            "FROM spj WHERE spj_number LIKE ?",
            (len(prefix) + 1, prefix + "%"),
        ).fetchone()
    max_seq = row["max_seq"] or 0
    return f"{prefix}{max_seq + 1:06d}"


def _default_persist_path() -> str:
    db_path = os.environ.get("JWIS_DB_PATH")
    if db_path:
        return os.path.join(os.path.dirname(db_path), "jwis_spj.db")
    return os.path.join(tempfile.gettempdir(), "jwis_spj.db")


def _legacy_json_path(db_path: str) -> str:
    """Where the pre-SQLite store kept its whole-file JSON state."""
    return os.path.splitext(db_path)[0] + ".json"


class SpjStore:
    """SQLite-backed SPJ store, safe across worker processes.

    Every mutation runs inside one SQLite transaction (BEGIN IMMEDIATE),
    so concurrent workers serialize on the database itself rather than an
    in-process lock. The daily spj_number is allocated inside the same
    transaction as the INSERT, guarded by a UNIQUE constraint; a conflict
    retries with a fresh number.
    """

    _BUSY_TIMEOUT_MS = 10_000

    def __init__(self, persist_path: str | None = None) -> None:
        self._path = persist_path or _default_persist_path()
        self._spj: dict[str, Spj] = {}  # read cache; SQLite is the source of truth
        self._lock = threading.RLock()
        self._init_schema()
        self._migrate_legacy_json()
        self._reload_cache()

    # -- connection helpers -------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=self._BUSY_TIMEOUT_MS / 1000)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(f"PRAGMA busy_timeout={self._BUSY_TIMEOUT_MS}")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def _init_schema(self) -> None:
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS spj (
                        spj_id TEXT PRIMARY KEY,
                        spj_number TEXT NOT NULL UNIQUE,
                        date TEXT NOT NULL,
                        driver_name TEXT NOT NULL,
                        truck_code TEXT NOT NULL,
                        destination TEXT NOT NULL,
                        weigh_on_site INTEGER NOT NULL DEFAULT 0,
                        priority TEXT NOT NULL DEFAULT 'normal',
                        note TEXT NOT NULL DEFAULT '',
                        status TEXT NOT NULL DEFAULT 'draft',
                        created_by TEXT NOT NULL DEFAULT 'admin',
                        created_at TEXT NOT NULL,
                        activated_at TEXT,
                        completed_at TEXT
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS spj_stops (
                        spj_id TEXT NOT NULL REFERENCES spj(spj_id) ON DELETE CASCADE,
                        idx INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        kecamatan TEXT NOT NULL,
                        address TEXT NOT NULL,
                        lat REAL NOT NULL,
                        lng REAL NOT NULL,
                        location_type TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'pending',
                        completed_at TEXT,
                        evidence TEXT,
                        PRIMARY KEY (spj_id, idx)
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS spj_receipts (
                        spj_id TEXT PRIMARY KEY REFERENCES spj(spj_id) ON DELETE CASCADE,
                        photo_name TEXT NOT NULL,
                        photo_b64 TEXT NOT NULL,
                        total_weight_kg REAL NOT NULL,
                        weight_source TEXT NOT NULL,
                        submitted_by TEXT NOT NULL,
                        operation_id TEXT,
                        recorded_at TEXT NOT NULL
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS spj_audit (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        spj_id TEXT NOT NULL,
                        action TEXT NOT NULL,
                        actor TEXT NOT NULL,
                        reason TEXT NOT NULL DEFAULT '',
                        payload TEXT NOT NULL DEFAULT '{}',
                        created_at TEXT NOT NULL
                    )
                    """
                )
                self._migrate_receipt_columns(connection)

    @staticmethod
    def _migrate_receipt_columns(connection: sqlite3.Connection) -> None:
        """Add columns introduced after a database was first created."""
        columns = {row["name"] for row in
                   connection.execute("PRAGMA table_info(spj_receipts)")}
        if columns and "operation_id" not in columns:
            connection.execute("ALTER TABLE spj_receipts ADD COLUMN operation_id TEXT")

    @staticmethod
    def _audit(connection: sqlite3.Connection, spj_id: str, action: str,
               actor: str, reason: str = "", payload: dict | None = None) -> None:
        connection.execute(
            "INSERT INTO spj_audit (spj_id, action, actor, reason, payload, created_at) "
            "VALUES (?,?,?,?,?,?)",
            (spj_id, action, actor, reason, json.dumps(payload or {}),
             _utc_now()),
        )

    def audit_log(self, spj_id: str) -> list[dict]:
        """Audit entries for one SPJ, oldest first."""
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT action, actor, reason, payload, created_at FROM spj_audit "
                "WHERE spj_id=? ORDER BY id", (spj_id,)).fetchall()
        return [
            {"action": r["action"], "actor": r["actor"], "reason": r["reason"],
             "payload": json.loads(r["payload"]), "created_at": r["created_at"]}
            for r in rows
        ]

    def _migrate_legacy_json(self) -> None:
        """One-time import from the pre-SQLite whole-file JSON store."""
        legacy = _legacy_json_path(self._path)
        if not os.path.exists(legacy):
            return
        with open(legacy, "rb") as fh:
            head = fh.read(16)
        if head.startswith(b"SQLite format 3"):
            return  # the "legacy" path is itself a SQLite file (test habit)
        try:
            with closing(self._connect()) as connection:
                row = connection.execute("SELECT COUNT(*) AS n FROM spj").fetchone()
                if row["n"] > 0:
                    return  # DB already populated; JSON is stale
                raw = json.loads(open(legacy, encoding="utf-8").read())
                with connection:
                    for item in raw:
                        stops = item.pop("stops", [])
                        connection.execute(
                            "INSERT INTO spj (spj_id, spj_number, date, driver_name, "
                            "truck_code, destination, weigh_on_site, priority, note, "
                            "status, created_by, created_at, activated_at, completed_at) "
                            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            (item.get("spj_id"), item.get("spj_number"), item.get("date"),
                             item.get("driver_name"), item.get("truck_code"),
                             item.get("destination"), int(bool(item.get("weigh_on_site"))),
                             item.get("priority", "normal"), item.get("note", ""),
                             item.get("status", "draft"), item.get("created_by", "admin"),
                             item.get("created_at", ""), item.get("activated_at"),
                             item.get("completed_at")),
                        )
                        for idx, stop in enumerate(stops):
                            connection.execute(
                                "INSERT INTO spj_stops (spj_id, idx, name, kecamatan, "
                                "address, lat, lng, location_type, status, completed_at, "
                                "evidence) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                                (item["spj_id"], idx, stop.get("name"),
                                 stop.get("kecamatan"), stop.get("address"),
                                 stop.get("lat"), stop.get("lng"),
                                 stop.get("location_type", "Pemukiman Kelas Menengah"),
                                 stop.get("status", "pending"), stop.get("completed_at"),
                                 json.dumps(stop["evidence"]) if stop.get("evidence") else None),
                            )
            logger.info("migrated legacy SPJ JSON %s into %s", legacy, self._path)
        except Exception:  # noqa: BLE001
            logger.exception("legacy SPJ JSON migration failed for %s", legacy)

    # -- row <-> dataclass ---------------------------------------------------

    @staticmethod
    def _row_to_spj(spj_row: sqlite3.Row, stop_rows: list,
                    receipt_row: sqlite3.Row | None = None) -> Spj:
        return Spj(
            spj_id=spj_row["spj_id"], spj_number=spj_row["spj_number"],
            date=spj_row["date"], driver_name=spj_row["driver_name"],
            truck_code=spj_row["truck_code"], destination=spj_row["destination"],
            weigh_on_site=bool(spj_row["weigh_on_site"]),
            priority=spj_row["priority"], note=spj_row["note"],
            stops=[SpjStop(
                name=r["name"], kecamatan=r["kecamatan"], address=r["address"],
                lat=r["lat"], lng=r["lng"], location_type=r["location_type"],
                status=r["status"], completed_at=r["completed_at"],
                evidence=json.loads(r["evidence"]) if r["evidence"] else None,
            ) for r in sorted(stop_rows, key=lambda r: r["idx"])],
            status=spj_row["status"], created_by=spj_row["created_by"],
            created_at=spj_row["created_at"], activated_at=spj_row["activated_at"],
            completed_at=spj_row["completed_at"],
            receipt=({**{key: receipt_row[key] for key in
                        ("photo_name", "total_weight_kg", "weight_source",
                         "submitted_by", "recorded_at")},
                      "has_photo": bool(receipt_row["has_photo"])}
                     if receipt_row is not None else None),
        )

    def _load_spj(self, connection: sqlite3.Connection, spj_id: str) -> Spj | None:
        row = connection.execute("SELECT * FROM spj WHERE spj_id=?", (spj_id,)).fetchone()
        if row is None:
            return None
        stops = connection.execute(
            "SELECT * FROM spj_stops WHERE spj_id=? ORDER BY idx", (spj_id,)
        ).fetchall()
        receipt = connection.execute(
            "SELECT photo_name, total_weight_kg, weight_source, submitted_by, "
            "recorded_at, (photo_b64 IS NOT NULL AND photo_b64 != '') AS has_photo "
            "FROM spj_receipts WHERE spj_id=?", (spj_id,)).fetchone()
        return self._row_to_spj(row, stops, receipt)

    def _reload_cache(self) -> None:
        with closing(self._connect()) as connection:
            rows = connection.execute("SELECT spj_id FROM spj").fetchall()
            self._spj = {}
            for row in rows:
                spj = self._load_spj(connection, row["spj_id"])
                if spj is not None:
                    self._spj[spj.spj_id] = spj

    def _save(self) -> None:  # kept for API compat; SQLite persists per mutation
        self._reload_cache()

    # -- public API (transactional, multi-process safe) -----------------------

    def create(self, driver_name: str, truck_code: str, destination: str,
               weigh_on_site: bool, priority: str, note: str,
               created_by: str = "admin") -> Spj:
        if destination not in DESTINATIONS:
            raise ValueError(f"destination must be one of {DESTINATIONS}")
        if priority not in ("normal", "vip"):
            raise ValueError("priority must be 'normal' or 'vip'")
        with self._lock:
            for _attempt in range(20):
                spj_id = uuid4().hex[:12]
                now = _utc_now()
                spj = None
                connection = self._connect()
                connection.isolation_level = None  # explicit transactions
                try:
                    with closing(connection):
                        connection.execute("BEGIN IMMEDIATE")
                        number = next_spj_number(self)
                        try:
                            connection.execute(
                                "INSERT INTO spj (spj_id, spj_number, date, driver_name, "
                                "truck_code, destination, weigh_on_site, priority, note, "
                                "status, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                                (spj_id, number, _today(), driver_name, truck_code,
                                 destination, int(bool(weigh_on_site)), priority, note,
                                 "draft", created_by, now),
                            )
                            connection.execute("COMMIT")
                        except sqlite3.IntegrityError:
                            connection.execute("ROLLBACK")
                            continue  # daily-number race: retry with a fresh number
                        spj = self._load_spj(connection, spj_id)
                except sqlite3.OperationalError:
                    raise
                if spj is not None:
                    self._spj[spj_id] = spj
                    return spj
            raise RuntimeError("SPJ create failed after repeated number conflicts")

    def get(self, spj_id: str) -> Spj | None:
        with self._lock:
            return self._spj.get(spj_id)

    def list(self, status: str | None = None) -> list[Spj]:
        """Newest first, so a client can rely on position instead of guessing.

        Ordering by created_at descending is part of the contract: the driver
        app picks the newest receipt-pending SPJ from this response.
        """
        with self._lock:
            items = list(self._spj.values())
        items.sort(key=lambda s: (s.created_at, s.spj_number), reverse=True)
        if status is None:
            return items
        return [s for s in items if s.status == status]

    def active_for_truck(self, truck_code: str) -> Spj | None:
        with self._lock:
            for spj in self._spj.values():
                if spj.truck_code == truck_code and spj.status == "aktif":
                    return spj
        return None

    def _mutate(self, spj_id: str, mutate_fn) -> Spj:
        """Run mutate_fn(connection, row) inside BEGIN IMMEDIATE, then reload."""
        with self._lock:
            connection = self._connect()
            connection.isolation_level = None
            try:
                with closing(connection):
                    connection.execute("BEGIN IMMEDIATE")
                    try:
                        mutate_fn(connection)
                    except Exception:
                        connection.execute("ROLLBACK")
                        raise
                    else:
                        connection.execute("COMMIT")
            except sqlite3.OperationalError:
                raise
            spj = self._load_fresh(spj_id)
            self._spj[spj_id] = spj
            return spj

    def _fetch_status(self, connection: sqlite3.Connection, spj_id: str) -> sqlite3.Row:
        row = connection.execute("SELECT * FROM spj WHERE spj_id=?", (spj_id,)).fetchone()
        if row is None:
            raise ValueError(f"SPJ {spj_id} not found")
        return row

    def add_stop(self, spj_id: str, name: str, kecamatan: str, address: str,
                 lat: float, lng: float,
                 location_type: str = "Pemukiman Kelas Menengah") -> Spj:
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] != "draft":
                raise ValueError("stops can only be added to a draft SPJ")
            idx = connection.execute(
                "SELECT COALESCE(MAX(idx)+1, 0) FROM spj_stops WHERE spj_id=?",
                (spj_id,)).fetchone()[0]
            connection.execute(
                "INSERT INTO spj_stops (spj_id, idx, name, kecamatan, address, "
                "lat, lng, location_type, status) VALUES (?,?,?,?,?,?,?,?,?)",
                (spj_id, idx, name, kecamatan, address, lat, lng,
                 location_type, "pending"),
            )
        return self._mutate(spj_id, mutate)

    def activate(self, spj_id: str) -> Spj:
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] != "draft":
                raise ValueError(f"cannot activate SPJ in status '{row['status']}'")
            stop_count = connection.execute(
                "SELECT COUNT(*) FROM spj_stops WHERE spj_id=?", (spj_id,)).fetchone()[0]
            if stop_count < 1:
                raise ValueError("SPJ needs at least one stop before activation")
            active = connection.execute(
                "SELECT spj_id FROM spj WHERE truck_code=? AND status='aktif'",
                (row["truck_code"],)).fetchone()
            if active is not None:
                raise ValueError(f"truck {row['truck_code']} already has an active SPJ")
            connection.execute(
                "UPDATE spj SET status='aktif', activated_at=? WHERE spj_id=?",
                (_utc_now(), spj_id))
            self._audit(connection, spj_id, "activate", row["created_by"])
        return self._mutate(spj_id, mutate)

    def complete_stop(self, spj_id: str, index: int,
                      evidence: dict | None = None) -> Spj:
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] != "aktif":
                raise ValueError("stops can only be completed on an active SPJ")
            stops = connection.execute(
                "SELECT idx, status FROM spj_stops WHERE spj_id=? ORDER BY idx",
                (spj_id,)).fetchall()
            if not 0 <= index < len(stops):
                raise ValueError(f"stop index {index} out of range")
            if stops[index]["status"] == "completed":
                return  # idempotent
            if evidence is None:
                raise ValueError(
                    "stop completion requires field evidence "
                    "(arrival, weighing, officer)")
            _validate_evidence(evidence)
            connection.execute(
                "UPDATE spj_stops SET status='completed', completed_at=?, "
                "evidence=? WHERE spj_id=? AND idx=?",
                (_utc_now(), json.dumps(evidence), spj_id, index))
            self._audit(connection, spj_id, "complete_stop", row["created_by"],
                        payload={"stop_index": index})
            pending = connection.execute(
                "SELECT COUNT(*) FROM spj_stops WHERE spj_id=? "
                "AND status != 'completed'", (spj_id,)).fetchone()[0]
            if pending == 0:
                connection.execute(
                    "UPDATE spj SET status='selesai', completed_at=? WHERE spj_id=?",
                    (_utc_now(), spj_id))
        return self._mutate(spj_id, mutate)

    def record_receipt(self, spj_id: str, photo_name: str, photo_b64: str,
                       total_weight_kg: float, weight_source: str,
                       submitted_by: str = "driver",
                       operation_id: str | None = None) -> Spj:
        """Attach the weighbridge receipt exactly once.

        The photo lives in its own table: the SPJ cache reloads every record
        on mutation, and a multi-megabyte image must not ride along.

        Retrying with the same operation_id returns the original receipt
        unchanged; a different submission for an SPJ that already has one is
        a conflict rather than a silent overwrite of handover evidence.
        """
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] != "selesai":
                raise ValueError("receipt can only be submitted after the SPJ is selesai")
            if not photo_name.strip() or not photo_b64.strip():
                raise ValueError("receipt photo_name and photo_b64 are required")
            existing = connection.execute(
                "SELECT * FROM spj_receipts WHERE spj_id=?", (spj_id,)).fetchone()
            if existing is not None:
                if operation_id and existing["operation_id"] == operation_id:
                    return  # client retry of an accepted submission
                raise ValueError("receipt already submitted")
            connection.execute(
                "INSERT INTO spj_receipts (spj_id, photo_name, photo_b64, "
                "total_weight_kg, weight_source, submitted_by, operation_id, "
                "recorded_at) VALUES (?,?,?,?,?,?,?,?)",
                (spj_id, photo_name, photo_b64, total_weight_kg, weight_source,
                 submitted_by, operation_id, _utc_now()))
            self._audit(connection, spj_id, "receipt", submitted_by,
                        payload={"total_weight_kg": total_weight_kg,
                                 "weight_source": weight_source,
                                 "photo_name": photo_name,
                                 "operation_id": operation_id})
        return self._mutate(spj_id, mutate)

    def receipt_photo(self, spj_id: str) -> str | None:
        """Receipt image bytes, read only when a detail view asks for them."""
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT photo_b64 FROM spj_receipts WHERE spj_id=?", (spj_id,)).fetchone()
        return row["photo_b64"] if row else None

    def complete(self, spj_id: str, override: dict | None = None) -> Spj:
        """Close an active SPJ.

        Normal completion requires every stop to be completed WITH field
        evidence — the same invariant the driver workflow enforces. A
        supervisor override ({"actor": ..., "reason": ...}) forces closure
        and is recorded in the audit trail; the reason must be non-empty.
        """
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] != "aktif":
                raise ValueError(f"cannot complete SPJ in status '{row['status']}'")
            unevidenced = connection.execute(
                "SELECT COUNT(*) FROM spj_stops WHERE spj_id=? "
                "AND (status != 'completed' OR evidence IS NULL)",
                (spj_id,)).fetchone()[0]
            actor = None
            reason = None
            if unevidenced:
                if override is None:
                    raise ValueError(
                        f"cannot complete: {unevidenced} stop(s) lack field evidence; "
                        "a supervisor override with a reason is required")
                actor = (override or {}).get("actor") or "unknown"
                reason = str((override or {}).get("reason") or "").strip()
                if not reason:
                    raise ValueError("override requires a non-empty reason")
            now = _utc_now()
            connection.execute(
                "UPDATE spj_stops SET status='completed', completed_at=? "
                "WHERE spj_id=? AND status != 'completed'", (now, spj_id))
            connection.execute(
                "UPDATE spj SET status='selesai', completed_at=? WHERE spj_id=?",
                (now, spj_id))
            if unevidenced:
                self._audit(connection, spj_id, "override", actor, reason,
                            payload={"forced_stops": unevidenced})
            else:
                self._audit(connection, spj_id, "complete", row["created_by"])
        return self._mutate(spj_id, mutate)

    def cancel(self, spj_id: str) -> Spj:
        def mutate(connection):
            row = self._fetch_status(connection, spj_id)
            if row["status"] not in ("draft", "aktif"):
                raise ValueError(f"cannot cancel SPJ in status '{row['status']}'")
            connection.execute("UPDATE spj SET status='batal' WHERE spj_id=?", (spj_id,))
            self._audit(connection, spj_id, "cancel", row["created_by"])
        return self._mutate(spj_id, mutate)

    def _load_fresh(self, spj_id: str) -> Spj:
        with closing(self._connect()) as connection:
            spj = self._load_spj(connection, spj_id)
        if spj is None:
            raise ValueError(f"SPJ {spj_id} not found")
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
