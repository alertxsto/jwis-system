# -*- coding: utf-8 -*-
"""Tests for the single map-truth geospatial payload (Task 2)."""
import unittest

from app.data import TRUCKS
from app.map_truth import build_map_truth


class MapTruthTests(unittest.TestCase):
    def setUp(self):
        self.truck = next(t for t in TRUCKS if t["truck_code"] == "T-047")
        self.payload = build_map_truth(self.truck)

    def test_payload_has_all_geospatial_keys(self):
        for key in ("truck_code", "raw_gps", "snapped_gps", "assigned_route",
                    "actual_route", "deviation_m", "deviation_segments",
                    "recommendation", "traffic", "permit", "provenance", "timestamp"):
            self.assertIn(key, self.payload)

    def test_snapped_gps_near_raw(self):
        from app.osrm import _haversine_km
        raw = self.payload["raw_gps"]
        snap = self.payload["snapped_gps"]
        d = _haversine_km((raw["lat"], raw["lng"]), (snap["lat"], snap["lng"])) * 1000
        self.assertLess(d, 200)

    def test_routes_are_road_following_or_labeled_fallback(self):
        for key in ("assigned_route", "actual_route"):
            route = self.payload[key]
            self.assertIn("source", route)
            if route["source"] == "LIVE_EXTERNAL":
                self.assertGreater(len(route["geometry"]), 20)
            else:
                self.assertEqual(route["source"], "FALLBACK_DEGRADED")

    def test_deviation_is_meter_float(self):
        self.assertIsInstance(self.payload["deviation_m"], float)

    def test_provenance_labels_present(self):
        prov = self.payload["provenance"]
        self.assertIn("raw_gps", prov)
        self.assertIn("snapped_gps", prov)
        self.assertEqual(prov["raw_gps"], "RAW_GPS_SIMULATED")


if __name__ == "__main__":
    unittest.main()
