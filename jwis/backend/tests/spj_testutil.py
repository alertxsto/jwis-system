"""Shared test helper: clean SQLite-backed SpjStore state for one path.

The SpjStore now persists to SQLite (WAL mode), so a stale database is up
to THREE files: the .db itself plus -wal and -shm sidecars. Removing only
the main file (the old JSON habit) leaves committed rows behind via the
sidecars, which makes tests interfere with each other.
"""

from __future__ import annotations

import os
import tempfile


def fresh_store_path(name: str) -> str:
    """Return a temp path with the store file and sidecars removed."""
    path = os.path.join(tempfile.gettempdir(), name)
    for suffix in ("", "-wal", "-shm"):
        candidate = path + suffix
        if os.path.exists(candidate):
            os.remove(candidate)
    return path
