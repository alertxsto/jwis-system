import os
import tempfile
import unittest

from app.pretrip import PRETRIP_ITEMS, PreTripStore


def _store(name="test_pretrip.json"):
    path = os.path.join(tempfile.gettempdir(), name)
    if os.path.exists(path):
        os.remove(path)
    return PreTripStore(persist_path=path)


ALL_OK = {k: True for k in PRETRIP_ITEMS}


class PreTripTests(unittest.TestCase):
    def test_submit_all_ok(self):
        store = _store()
        rec = store.submit("T-088", "Joko Wijaya", dict(ALL_OK))
        self.assertEqual(rec.truck_code, "T-088")
        self.assertEqual(len(rec.items), 7)
        self.assertEqual(rec.note, "")
        self.assertIsNotNone(rec.record_id)

    def test_items_must_be_exactly_seven_known_keys(self):
        store = _store()
        with self.assertRaises(ValueError):
            store.submit("T-088", "Joko", {"rem": True})
        bad = dict(ALL_OK, mesin2=True)
        with self.assertRaises(ValueError):
            store.submit("T-088", "Joko", bad)

    def test_note_required_when_any_item_fails(self):
        store = _store()
        items = dict(ALL_OK, rem=False)
        with self.assertRaises(ValueError):
            store.submit("T-088", "Joko", items, note="")
        rec = store.submit("T-088", "Joko", items, note="Rem blong")
        self.assertFalse(rec.items["rem"])

    def test_today_returns_todays_record_only(self):
        store = _store()
        self.assertIsNone(store.today("T-088"))
        store.submit("T-088", "Joko", dict(ALL_OK))
        self.assertIsNotNone(store.today("T-088"))
        self.assertIsNone(store.today("T-001"))

    def test_list_recent_orders_newest_first(self):
        store = _store()
        store.submit("T-088", "Joko", dict(ALL_OK), note="first")
        store.submit("T-088", "Joko", dict(ALL_OK), note="second")
        recent = store.list_recent("T-088")
        self.assertEqual(len(recent), 2)
        self.assertEqual(recent[0].note, "second")

    def test_persistence_round_trip(self):
        path = os.path.join(tempfile.gettempdir(), "test_pretrip_persist.json")
        if os.path.exists(path):
            os.remove(path)
        store = PreTripStore(persist_path=path)
        rec = store.submit("T-088", "Joko", dict(ALL_OK, oli=False), note="Oli rembes")
        store2 = PreTripStore(persist_path=path)
        loaded = store2.today("T-088")
        self.assertEqual(loaded.record_id, rec.record_id)
        self.assertFalse(loaded.items["oli"])


if __name__ == "__main__":
    unittest.main()
