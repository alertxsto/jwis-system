import os
import tempfile
import unittest

import app.compliance as comp
from app.compliance import compute_driver_score
from app.damage_reports import DamageReportStore
from app.pretrip import PreTripStore
from app.spj import SpjStore


def _fresh_stores():
    tmp = tempfile.gettempdir()
    for name in ["comp_spj.json", "comp_pre.json", "comp_dmg.json"]:
        path = os.path.join(tmp, name)
        if os.path.exists(path):
            os.remove(path)
    return (SpjStore(persist_path=os.path.join(tmp, "comp_spj.json")),
            PreTripStore(persist_path=os.path.join(tmp, "comp_pre.json")),
            DamageReportStore(persist_path=os.path.join(tmp, "comp_dmg.json")))


class _Swap:
    def __init__(self, spj, pre, dmg, trucks):
        self.spj, self.pre, self.dmg, self.trucks = spj, pre, dmg, trucks

    def __enter__(self):
        self._old = (comp.SPJ_STORE, comp.PRETRIP_STORE,
                     comp.DAMAGE_STORE, comp.get_dynamic_trucks)
        comp.SPJ_STORE, comp.PRETRIP_STORE, comp.DAMAGE_STORE = self.spj, self.pre, self.dmg
        comp.get_dynamic_trucks = lambda: self.trucks

    def __exit__(self, *exc):
        (comp.SPJ_STORE, comp.PRETRIP_STORE,
         comp.DAMAGE_STORE, comp.get_dynamic_trucks) = self._old


def _make_spj(spj_store, driver, truck, complete_with_evidence=True):
    spj = spj_store.create(driver_name=driver, truck_code=truck,
                           destination="TPST Bantargebang", weigh_on_site=True,
                           priority="normal", note="")
    spj_store.add_stop(spj.spj_id, name="S1", kecamatan="K", address="A",
                       lat=-6.2, lng=106.8)
    spj_store.activate(spj.spj_id)
    evidence = None
    if complete_with_evidence:
        evidence = {"arrival": {"photo_name": "a.jpg"},
                    "weighing": [], "officer": {"photo_name": "p.jpg", "name": "X"}}
    spj_store.complete_stop(spj.spj_id, 0, evidence=evidence)
    return spj


class ComplianceScoreTests(unittest.TestCase):
    def test_clean_driver_scores_100_grade_a(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi Santoso",
                   "deviation": {"violated": False}}]
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi Santoso", ["T-001"],
                                          today="2026-09-14")
        self.assertEqual(result["score"], 100.0)
        self.assertEqual(result["grade"], "A")
        self.assertEqual(result["classification"], "derived")
        self.assertEqual(result["window_days"], 30)

    def test_deviation_deducts_15(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi",
                   "deviation": {"violated": True}}]
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result["score"], 85.0)
        self.assertEqual(result["breakdown"]["deviation_violations"], 1)

    def test_stop_without_evidence_deducts_10(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi",
                   "deviation": {"violated": False}}]
        _make_spj(spj, "Budi", "T-001", complete_with_evidence=False)
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result["score"], 85.0)
        self.assertEqual(result["breakdown"]["stops_without_evidence"], 1)

    def test_unresolved_heavy_report_deducts_10(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi",
                   "deviation": {"violated": False}}]
        dmg.create("T-001", "Budi", "rem", "berat", "Rem blong")
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result["score"], 90.0)
        self.assertEqual(result["breakdown"]["unresolved_heavy_reports"], 1)

    def test_days_without_pretrip_deducts_5(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi",
                   "deviation": {"violated": False}}]
        _make_spj(spj, "Budi", "T-001")  # SPJ hari ini, tanpa pretrip
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result["breakdown"]["days_without_pretrip"], 1)
        self.assertEqual(result["score"], 95.0)
        # dengan pretrip hari ini -> komponen hilang
        pre.submit("T-001", "Budi",
                   {"rem": True, "mesin": True, "ban": True, "bbm": True,
                    "oli": True, "bak_compactor": True, "lampu": True})
        with _Swap(spj, pre, dmg, trucks):
            result2 = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result2["breakdown"]["days_without_pretrip"], 0)
        self.assertEqual(result2["score"], 100.0)

    def test_score_floors_at_zero(self):
        spj, pre, dmg = _fresh_stores()
        trucks = [{"truck_code": "T-001", "driver_name": "Budi",
                   "deviation": {"violated": True}}]
        for _ in range(9):
            dmg.create("T-001", "Budi", "rem", "berat", "x")
        with _Swap(spj, pre, dmg, trucks):
            result = compute_driver_score("Budi", ["T-001"], today="2026-09-14")
        self.assertEqual(result["score"], 0.0)
        self.assertEqual(result["grade"], "D")

    def test_grade_boundaries(self):
        self.assertEqual(comp._grade(90), "A")
        self.assertEqual(comp._grade(75), "B")
        self.assertEqual(comp._grade(60), "C")
        self.assertEqual(comp._grade(59.9), "D")


if __name__ == "__main__":
    unittest.main()
