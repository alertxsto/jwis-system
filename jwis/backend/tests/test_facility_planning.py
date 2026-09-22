# -*- coding: utf-8 -*-
"""Tests for Case 2 facility gap analysis (need + location of facilities)."""
import unittest

from app.facility_planning import build_facility_gap_analysis


class FacilityGapTests(unittest.TestCase):
    def test_covers_all_kecamatan(self):
        result = build_facility_gap_analysis()
        self.assertEqual(result["summary"]["kecamatan_total"], 42)

    def test_higher_demand_means_larger_gap(self):
        low = build_facility_gap_analysis({"CENGKARENG": 100.0})
        high = build_facility_gap_analysis({"CENGKARENG": 500.0})
        low_area = next(a for a in low["areas"] if a["kecamatan"].upper() == "CENGKARENG")
        high_area = next(a for a in high["areas"] if a["kecamatan"].upper() == "CENGKARENG")
        self.assertGreater(high_area["gap_ton_per_day"], low_area["gap_ton_per_day"])
        self.assertGreater(high_area["recommended_extra_trips_per_day"],
                           low_area["recommended_extra_trips_per_day"])

    def test_siting_candidates_name_real_kelurahan(self):
        result = build_facility_gap_analysis({"CENGKARENG": 500.0})
        area = next(a for a in result["areas"] if a["kecamatan"].upper() == "CENGKARENG")
        self.assertTrue(area["siting_candidates"], "under-capacity area must name siting kelurahan")
        for cand in area["siting_candidates"]:
            self.assertIn("existing_tps_sites", cand)
            self.assertGreater(cand["predicted_tons"], 0)

    def test_proxy_classification_and_coverage_disclosed(self):
        result = build_facility_gap_analysis()
        self.assertEqual(result["classification"], "proxy")
        ratio = result["summary"]["citywide_proxy_coverage_ratio"]
        self.assertIsNotNone(ratio)
        self.assertLess(ratio, 1.0, "proxy coverage must be honestly disclosed as partial")
        self.assertIn("coverage_note", result["assumptions"])

    def test_sorted_by_severity_then_gap(self):
        result = build_facility_gap_analysis()
        areas = result["areas"]
        order = {"critical": 0, "watch": 1, "ok": 2, "unknown": 3}
        keys = [order.get(a["severity"], 4) for a in areas]
        self.assertEqual(keys, sorted(keys))


if __name__ == "__main__":
    unittest.main()
