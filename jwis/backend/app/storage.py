from __future__ import annotations

import json
import os
import sqlite3
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


class HistoryStore:
    # Necessary: the DB file must live OUTSIDE the backend cwd — uvicorn --reload
    # watches every file there, so each dispatch write to data/processed/*.db
    # triggered a worker restart (ECONNRESET mid-request + all caches dropped).
    def __init__(self, db_path: Path | str | None = None):
        if db_path is None:
            db_path = os.environ.get("JWIS_DB_PATH") or os.path.join(tempfile.gettempdir(), "jwis_history.db")
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_schema(self) -> None:
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type TEXT NOT NULL,
                        payload_json TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS dispatches (
                        id TEXT PRIMARY KEY,
                        truck_code TEXT NOT NULL,
                        instruction TEXT NOT NULL,
                        manager_id TEXT NOT NULL,
                        field_status TEXT NOT NULL,
                        confirmed_note TEXT NOT NULL DEFAULT '',
                        created_at TEXT NOT NULL,
                        confirmed_at TEXT
                    )
                    """
                )

    def record_event(self, event_type: str, payload: dict[str, Any]) -> None:
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    "INSERT INTO events (event_type, payload_json, created_at) VALUES (?, ?, ?)",
                    (event_type, json.dumps(payload), datetime.now(timezone.utc).isoformat()),
                )

    def list_events(self, limit: int = 50) -> list[dict[str, Any]]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT event_type, payload_json, created_at FROM events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [
            {
                "event_type": row["event_type"],
                "payload": json.loads(row["payload_json"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def save_dispatch(self, truck_code: str, instruction: str, manager_id: str) -> dict[str, Any]:
        dispatch = {
            "id": str(uuid4()),
            "truck_code": truck_code,
            "instruction": instruction,
            "manager_id": manager_id,
            "field_status": "PENDING",
            "confirmed_note": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "confirmed_at": None,
        }
        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    "INSERT INTO dispatches (id, truck_code, instruction, manager_id, "
                    "field_status, confirmed_note, created_at, confirmed_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (dispatch["id"], truck_code, instruction, manager_id, "PENDING",
                     "", dispatch["created_at"], None),
                )
        return dispatch

    def update_dispatch_status(self, dispatch_id: str, status: str, note: str = "") -> dict[str, Any]:
        confirmed_at = datetime.now(timezone.utc).isoformat()
        with closing(self._connect()) as connection:
            with connection:
                cur = connection.execute(
                    "UPDATE dispatches SET field_status=?, confirmed_note=?, confirmed_at=? WHERE id=?",
                    (status, note, confirmed_at, dispatch_id),
                )
                if cur.rowcount == 0:
                    raise KeyError(f"Dispatch {dispatch_id} was not found.")
        return {"id": dispatch_id, "field_status": status, "confirmed_note": note,
                "confirmed_at": confirmed_at}

    def get_dispatch(self, dispatch_id: str) -> dict[str, Any] | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT * FROM dispatches WHERE id=?", (dispatch_id,)
            ).fetchone()
        return dict(row) if row is not None else None

    def list_dispatches(self) -> list[dict[str, Any]]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT * FROM dispatches ORDER BY created_at ASC"
            ).fetchall()
        return [dict(row) for row in rows]

    def pending_dispatches(self, truck_code: str) -> list[dict[str, Any]]:
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT * FROM dispatches WHERE truck_code=? AND field_status='PENDING' "
                "ORDER BY created_at ASC",
                (truck_code,),
            ).fetchall()
        return [dict(row) for row in rows]
