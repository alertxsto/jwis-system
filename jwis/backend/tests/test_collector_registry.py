# -*- coding: utf-8 -*-
"""Tests for unlicensed waste-collector detection (Case 1 illegal activity)."""
import unittest

from app.collector_registry import check_vehicle, scan_observed_vehicles


class CollectorRegistryTests(unittest.TestCase):
    def test_registered_plate_is_authorized(self):
        r = check_vehicle("B 1234 CD")
        self.assertTrue(r["authorized"])
        self.assertEqual(r["severity"], "normal")

    def test_unknown_plate_is_unauthorized(self):
        r = check_vehicle("Z 9999 XX")
        self.assertFalse(r["authorized"])
        self.assertEqual(r["severity"], "critical")
        self.assertIn("unlicensed", r["reason"].lower())

    def test_plate_normalization_ignores_spacing_case(self):
        self.assertTrue(check_vehicle("b1234cd")["authorized"])

    def test_scan_flags_only_unauthorized(self):
        observed = [
            {"plate": "B 1234 CD", "lat": -6.15, "lng": 106.84},
            {"plate": "Z 0000 ZZ", "lat": -6.16, "lng": 106.85},
        ]
        alerts = scan_observed_vehicles(observed)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["plate"], "Z 0000 ZZ")
        self.assertEqual(alerts[0]["type"], "unlicensed_collector")


if __name__ == "__main__":
    unittest.main()
