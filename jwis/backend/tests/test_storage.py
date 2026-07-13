import tempfile
import unittest
from pathlib import Path

from app.storage import HistoryStore


class StorageTests(unittest.TestCase):
    def test_history_store_records_dispatch_and_prediction_events(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = HistoryStore(Path(tmp) / "history.db")

            store.record_event("dispatch", {"truck_code": "T-047", "status": "PENDING"})
            store.record_event("prediction", {"district": "Jakarta Barat", "spike_percent": 41})

            events = store.list_events()

            self.assertEqual(len(events), 2)
            self.assertEqual(events[0]["event_type"], "prediction")
            self.assertEqual(events[1]["event_type"], "dispatch")


class DispatchPersistenceTests(unittest.TestCase):
    def test_dispatch_survives_restart(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "history.db"
            store = HistoryStore(db)
            d = store.save_dispatch(truck_code="T-047", instruction="Route B", manager_id="MGR-1")
            # Simulate a backend restart by constructing a fresh store on same DB.
            store2 = HistoryStore(db)
            loaded = store2.list_dispatches()
            self.assertEqual(len(loaded), 1)
            self.assertEqual(loaded[0]["id"], d["id"])
            self.assertEqual(loaded[0]["field_status"], "PENDING")

    def test_confirm_persists_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / "history.db"
            store = HistoryStore(db)
            d = store.save_dispatch(truck_code="T-001", instruction="x", manager_id="m")
            store.update_dispatch_status(d["id"], status="SIAP", note="accepted")
            store2 = HistoryStore(db)
            loaded = store2.list_dispatches()
            self.assertEqual(loaded[0]["field_status"], "SIAP")
            self.assertEqual(loaded[0]["confirmed_note"], "accepted")

    def test_pending_filter(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = HistoryStore(Path(tmp) / "history.db")
            store.save_dispatch(truck_code="T-047", instruction="a", manager_id="m")
            d2 = store.save_dispatch(truck_code="T-047", instruction="b", manager_id="m")
            store.update_dispatch_status(d2["id"], status="SIAP", note="")
            pending = store.pending_dispatches("T-047")
            self.assertEqual(len(pending), 1)


if __name__ == "__main__":
    unittest.main()
