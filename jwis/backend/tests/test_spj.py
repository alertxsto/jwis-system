import os
import unittest
from unittest import mock

with mock.patch.dict(os.environ, {"JWIS_SPJ_SEED": "off"}):
    from app.spj import Spj, SpjStore, next_spj_number

from spj_testutil import fresh_store_path


def _store(tmp_name="test_spj_store.json"):
    return SpjStore(persist_path=fresh_store_path(tmp_name))


EVIDENCE = {
    "arrival": {"photo_name": "a.jpg", "photo_b64": "data:image/jpeg;base64,AAA",
                "lat": -6.2, "lng": 106.8, "at": "2026-09-14T08:00:00"},
    "weighing": [],
    "officer": {"photo_name": "p.jpg", "photo_b64": "data:image/jpeg;base64,CCC",
                "name": "Dicky"},
}


class SpjModelTests(unittest.TestCase):
    def test_create_draft(self):
        store = _store()
        spj = store.create(driver_name="Budi Santoso", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=True,
                           priority="normal", note="test")
        self.assertEqual(spj.status, "draft")
        self.assertEqual(spj.stops, [])
        self.assertTrue(spj.spj_number.startswith("DLH-DKI/SPJ/"))
        self.assertEqual(store.get(spj.spj_id).spj_number, spj.spj_number)

    def test_spj_number_increments_same_day(self):
        store = _store("test_spj_num.json")
        a = store.create(driver_name="A", truck_code="T-001",
                         destination="TPST Bantargebang", weigh_on_site=False,
                         priority="normal", note="")
        b = store.create(driver_name="B", truck_code="T-088",
                         destination="RDF Plant Jakarta", weigh_on_site=False,
                         priority="vip", note="")
        seq_a = int(a.spj_number.rsplit("/", 1)[1])
        seq_b = int(b.spj_number.rsplit("/", 1)[1])
        self.assertEqual(seq_b, seq_a + 1)

    def test_add_stop_to_draft_only(self):
        store = _store()
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=False,
                           priority="normal", note="")
        spj = store.add_stop(spj.spj_id, name="TPS A", kecamatan="Cilandak",
                             address="Jl. X", lat=-6.29, lng=106.79)
        self.assertEqual(len(spj.stops), 1)
        self.assertEqual(spj.stops[0].status, "pending")

    def test_activate_requires_stop(self):
        store = _store()
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=False,
                           priority="normal", note="")
        with self.assertRaises(ValueError):
            store.activate(spj.spj_id)

    def test_one_active_spj_per_truck(self):
        store = _store()
        first = store.create(driver_name="A", truck_code="T-001",
                             destination="TPST Bantargebang", weigh_on_site=False,
                             priority="normal", note="")
        store.add_stop(first.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.activate(first.spj_id)
        second = store.create(driver_name="A", truck_code="T-001",
                              destination="TPST Bantargebang", weigh_on_site=False,
                              priority="normal", note="")
        store.add_stop(second.spj_id, name="S2", kecamatan="K", address="A",
                       lat=-6.3, lng=106.9)
        with self.assertRaises(ValueError):
            store.activate(second.spj_id)
        self.assertEqual(store.active_for_truck("T-001").spj_id, first.spj_id)

    def test_complete_all_stops_auto_completes_spj(self):
        store = _store()
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=False,
                           priority="normal", note="")
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.add_stop(spj.spj_id, name="S2", kecamatan="K", address="B",
                       lat=-6.3, lng=106.9)
        store.activate(spj.spj_id)
        spj = store.complete_stop(spj.spj_id, 0, evidence=EVIDENCE)
        self.assertEqual(spj.status, "aktif")
        self.assertEqual(spj.stops[0].status, "completed")
        spj = store.complete_stop(spj.spj_id, 1, evidence=EVIDENCE)
        self.assertEqual(spj.status, "selesai")
        self.assertIsNotNone(spj.completed_at)
        self.assertIsNone(store.active_for_truck("T-001"))

    def test_manual_complete_and_cancel(self):
        store = _store()
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=False,
                           priority="normal", note="")
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.activate(spj.spj_id)
        self.assertEqual(store.complete(
            spj.spj_id, override={"actor": "supervisor", "reason": "test"}).status,
            "selesai")
        draft = store.create(driver_name="B", truck_code="T-088",
                             destination="JRC Pesanggrahan", weigh_on_site=False,
                             priority="normal", note="")
        self.assertEqual(store.cancel(draft.spj_id).status, "batal")

    def test_illegal_transitions_raise(self):
        store = _store()
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=False,
                           priority="normal", note="")
        with self.assertRaises(ValueError):  # complete stop on draft
            store.complete_stop(spj.spj_id, 0)
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.activate(spj.spj_id)
        store.complete(spj.spj_id, override={"actor": "supervisor", "reason": "test"})
        with self.assertRaises(ValueError):  # activate finished
            store.activate(spj.spj_id)

    def test_persistence_round_trip(self):
        path = fresh_store_path("test_spj_persist.json")
        store = SpjStore(persist_path=path)
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=True,
                           priority="vip", note="rt")
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store2 = SpjStore(persist_path=path)
        loaded = store2.get(spj.spj_id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.priority, "vip")
        self.assertEqual(len(loaded.stops), 1)

    def test_list_filter_by_status(self):
        store = _store()
        store.create(driver_name="A", truck_code="T-001",
                     destination="TPST Bantargebang", weigh_on_site=False,
                     priority="normal", note="")
        drafts = store.list(status="draft")
        self.assertEqual(len(drafts), 1)
        self.assertEqual(store.list(status="aktif"), [])


if __name__ == "__main__":
    unittest.main()
