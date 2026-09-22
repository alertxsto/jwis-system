import os
import tempfile
import unittest

import app.damage_reports as dmg_module
from app.damage_reports import DamageReportStore


def _store(name="test_damage.json"):
    path = os.path.join(tempfile.gettempdir(), name)
    if os.path.exists(path):
        os.remove(path)
    return DamageReportStore(persist_path=path)


class DamageReportTests(unittest.TestCase):
    def test_create_and_list_newest_first(self):
        store = _store()
        store.create("T-112", "Rizky Maulana", "rem", "ringan", "Rem bunyi")
        store.create("T-112", "Rizky Maulana", "mesin", "berat", "Mesin mati")
        reports = store.list()
        self.assertEqual(len(reports), 2)
        self.assertEqual(reports[0].component, "mesin")
        baru = store.list(status="baru")
        self.assertEqual(len(baru), 2)

    def test_severity_validation(self):
        store = _store()
        with self.assertRaises(ValueError):
            store.create("T-112", "Rizky", "rem", "parah", "x")

    def test_override_only_for_heavy_unresolved(self):
        store = _store()
        light = store.create("T-112", "Rizky", "oli", "ringan", "Oli netes")
        self.assertIsNone(store.active_override_for("T-112"))
        heavy = store.create("T-112", "Rizky", "rem", "berat", "Rem blong")
        self.assertEqual(store.active_override_for("T-112").report_id,
                         heavy.report_id)
        store.resolve(heavy.report_id)
        self.assertIsNone(store.active_override_for("T-112"))

    def test_resolve_twice_raises(self):
        store = _store()
        rep = store.create("T-112", "Rizky", "ban", "berat", "Ban pecah")
        store.resolve(rep.report_id)
        with self.assertRaises(ValueError):
            store.resolve(rep.report_id)

    def test_truck_reads_override(self):
        from app.data import _truck
        store = _store("test_damage_override.json")
        old = dmg_module.DAMAGE_STORE
        try:
            dmg_module.DAMAGE_STORE = store
            truck = _truck("T-001", "B 1234 CD", "Budi Santoso",
                           "Jakarta Utara", "active", False, "Dump Truck Besar")
            self.assertFalse(truck["is_damaged"])
            store.create("T-001", "Budi Santoso", "mesin", "berat",
                         "Mesin overheat")
            truck = _truck("T-001", "B 1234 CD", "Budi Santoso",
                           "Jakarta Utara", "active", False, "Dump Truck Besar")
            self.assertTrue(truck["is_damaged"])
            self.assertEqual(truck["damage_status"]["state"], "breakdown")
            self.assertFalse(truck["damage_status"]["operational"])
        finally:
            dmg_module.DAMAGE_STORE = old

    def test_persistence_round_trip(self):
        path = os.path.join(tempfile.gettempdir(), "test_damage_persist.json")
        if os.path.exists(path):
            os.remove(path)
        store = DamageReportStore(persist_path=path)
        rep = store.create("T-112", "Rizky", "bak_compactor", "berat",
                           "Hidrolik bocor", photo_name="foto.jpg",
                           photo_b64="data:image/jpeg;base64,AAA")
        store2 = DamageReportStore(persist_path=path)
        self.assertEqual(store2.active_override_for("T-112").report_id,
                         rep.report_id)


if __name__ == "__main__":
    unittest.main()
