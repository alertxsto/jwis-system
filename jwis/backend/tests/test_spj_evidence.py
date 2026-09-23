import os
import tempfile
import unittest

from app.spj import SpjStore

from spj_testutil import fresh_store_path


def _store(name="test_spj_evidence.json"):
    return SpjStore(persist_path=fresh_store_path(name))


EVIDENCE = {
    "arrival": {"photo_name": "datang.jpg", "photo_b64": "data:image/jpeg;base64,AAA",
                "lat": -6.2379, "lng": 106.7826, "at": "2026-09-14T08:00:00"},
    "weighing": [{"fraction": "Residu", "weight_kg": 37.2,
                  "photo_name": "timbang1.jpg", "photo_b64": "data:image/jpeg;base64,BBB"}],
    "officer": {"photo_name": "petugas.jpg", "photo_b64": "data:image/jpeg;base64,CCC",
                "name": "Dicky"},
}


class SpjEvidenceTests(unittest.TestCase):
    def _active_spj(self, store):
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=True,
                           priority="normal", note="")
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.activate(spj.spj_id)
        return spj

    def test_complete_stop_with_evidence(self):
        store = _store()
        spj = self._active_spj(store)
        spj = store.complete_stop(spj.spj_id, 0, evidence=EVIDENCE)
        self.assertEqual(spj.stops[0].evidence["officer"]["name"], "Dicky")
        self.assertEqual(spj.status, "selesai")  # only stop -> auto complete

    def test_complete_stop_without_evidence_rejected(self):
        store = _store()
        spj = self._active_spj(store)
        with self.assertRaises(ValueError):
            store.complete_stop(spj.spj_id, 0)

    def test_complete_with_unevidenced_stops_rejected(self):
        store = _store("test_spj_evi_complete.json")
        spj = store.create(driver_name="A", truck_code="T-001",
                           destination="TPST Bantargebang", weigh_on_site=True,
                           priority="normal", note="")
        store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
        store.add_stop(spj.spj_id, name="S2", kecamatan="K", address="B",
                       lat=-6.25, lng=106.85)
        store.activate(spj.spj_id)
        store.complete_stop(spj.spj_id, 0, evidence=EVIDENCE)
        with self.assertRaises(ValueError):
            store.complete(spj.spj_id)  # stop 2 has no evidence

    def test_complete_override_records_audit(self):
        store = _store("test_spj_evi_override.json")
        spj = self._active_spj(store)
        with self.assertRaises(ValueError):
            store.complete(spj.spj_id)  # unevidenced stop
        completed = store.complete(
            spj.spj_id,
            override={"actor": "supervisor", "reason": "driver device lost"})
        self.assertEqual(completed.status, "selesai")
        entries = store.audit_log(spj.spj_id)
        actions = [(e["action"], e["actor"], e["reason"]) for e in entries]
        self.assertIn(("override", "supervisor", "driver device lost"), actions)

    def test_override_requires_reason(self):
        store = _store("test_spj_evi_override_reason.json")
        spj = self._active_spj(store)
        with self.assertRaises(ValueError):
            store.complete(spj.spj_id, override={"actor": "supervisor", "reason": ""})

    def test_evidence_requires_arrival_photo(self):
        store = _store()
        spj = self._active_spj(store)
        with self.assertRaises(ValueError):
            store.complete_stop(spj.spj_id, 0, evidence={"weighing": []})

    def test_evidence_persists(self):
        path = fresh_store_path("test_spj_evi_persist.json")
        store = SpjStore(persist_path=path)
        spj = self._active_spj(store)
        store.complete_stop(spj.spj_id, 0, evidence=EVIDENCE)
        store2 = SpjStore(persist_path=path)
        loaded = store2.get(spj.spj_id)
        self.assertEqual(loaded.stops[0].evidence["weighing"][0]["weight_kg"],
                         37.2)

    def test_evidence_photo_cap_enforced(self):
        store = _store()
        spj = self._active_spj(store)
        big = {"arrival": {"photo_name": "a.jpg", "photo_b64": "x" * 7_000_001},
               "weighing": [], "officer": {"photo_name": "p.jpg"}}
        with self.assertRaises(ValueError):
            store.complete_stop(spj.spj_id, 0, evidence=big)

    def test_summary_payload_strips_evidence(self):
        from app.spj import spj_summary_payload
        store = _store()
        spj = self._active_spj(store)
        store.complete_stop(spj.spj_id, 0, evidence=EVIDENCE)
        summary = spj_summary_payload(store.get(spj.spj_id))
        self.assertNotIn("photo_b64", str(summary))
        ev_sum = summary["stops"][0]["evidence_summary"]
        self.assertTrue(ev_sum["has_evidence"])
        self.assertEqual(ev_sum["weighing_count"], 1)
        self.assertEqual(ev_sum["total_weight_kg"], 37.2)


if __name__ == "__main__":
    unittest.main()
