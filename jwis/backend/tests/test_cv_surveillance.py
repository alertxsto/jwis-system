# -*- coding: utf-8 -*-
"""Tests for the CV gate-surveillance pipeline (Case 1 illegal activity).

The YOLO/EasyOCR engine is mocked so tests run offline with no model or GPU.
Only the pure pipeline logic — detection wiring, whitelist verification, event
dedup, history ordering, and status payload — is exercised.
"""
import unittest
from unittest.mock import patch

import numpy as np

from app.cv_surveillance import (
    SurveillanceEngine,
    SurveillanceEvent,
    _discover_demo_video,
    is_plate_like,
)
from app.collector_registry import check_vehicle


def _dummy_frame(h=720, w=1280):
    return np.zeros((h, w, 3), dtype=np.uint8)


class CvSurveillancePipelineTests(unittest.TestCase):
    def _engine(self):
        sv = SurveillanceEngine(video_path="nonexistent.mp4")
        # Replace the heavy pipeline stages so no model/OCR loads.
        sv.detect_trucks = lambda frame: [{"bbox": [10, 20, 500, 400], "conf": 0.9}]
        return sv

    def test_registered_plate_yields_authorized_event(self):
        sv = self._engine()
        sv.read_plate = lambda frame, bbox: ("B 1234 CD", 0.97)
        event = sv.process_frame(_dummy_frame())
        self.assertIsNotNone(event)
        self.assertTrue(event.authorized)
        self.assertEqual(event.severity, "normal")
        self.assertEqual(event.source, "simulated")
        self.assertIn("Registered DLH", event.reason)

    def test_unknown_plate_yields_unlicensed_critical_event(self):
        sv = self._engine()
        sv.read_plate = lambda frame, bbox: ("Z 9999 XX", 0.91)
        event = sv.process_frame(_dummy_frame())
        self.assertIsNotNone(event)
        self.assertFalse(event.authorized)
        self.assertEqual(event.severity, "critical")
        self.assertIn("unlicensed", event.reason.lower())

    def test_no_truck_detection_produces_no_event(self):
        sv = self._engine()
        sv.detect_trucks = lambda frame: []
        self.assertIsNone(sv.process_frame(_dummy_frame()))

    def test_plate_region_must_contain_digits(self):
        # Plate-like filter: letters-only hit is not a plate.
        self.assertFalse(is_plate_like("PIXABAY"))
        self.assertTrue(is_plate_like("B 5678 EF"))
        self.assertFalse(is_plate_like("12"))

    def test_duplicate_plate_is_deduped_within_window(self):
        sv = self._engine()
        sv.read_plate = lambda frame, bbox: ("B 5678 EF", 0.95)
        first = sv.process_frame(_dummy_frame())
        self.assertIsNotNone(first)
        second = sv.process_frame(_dummy_frame())
        self.assertIsNone(second, "same plate must be suppressed within DEDUP_SECONDS")

    def test_events_history_is_newest_first(self):
        sv = self._engine()
        plates = ["B 1234 CD", "B 5678 EF", "B 9012 GH"]
        for i, plate in enumerate(plates):
            sv.read_plate = lambda frame, bbox, p=plate: (p, 0.9)
            # reset dedup window per plate by faking time forward
            with patch("app.cv_surveillance.time.time",
                       return_value=10_000.0 + i * 60):
                sv.process_frame(_dummy_frame())
        events = sv.events(limit=10)
        self.assertEqual(len(events), 3)
        self.assertEqual(events[0]["plate"], "B 9012 GH")
        self.assertEqual(events[-1]["plate"], "B 1234 CD")

    def test_status_payload_labels_source_simulated(self):
        sv = self._engine()
        payload = sv.status()
        self.assertEqual(payload["source"], "simulated")
        self.assertIn("events", payload)

    def test_check_vehicle_integration(self):
        self.assertTrue(check_vehicle("B 1234 CD")["authorized"])
        self.assertFalse(check_vehicle("Z 0000 ZZ")["authorized"])


class CvSurveillanceDiscoveryTests(unittest.TestCase):
    def test_discover_returns_existing_preferred_video(self):
        found = _discover_demo_video()
        self.assertIsInstance(found, type(_discover_demo_video()))
        self.assertEqual(found.name, "garbage_truck_demo.mp4")


if __name__ == "__main__":
    unittest.main()
