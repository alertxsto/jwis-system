# -*- coding: utf-8 -*-
"""Tests for deviation alert hysteresis and TPA queue scenario contract."""
import unittest

from app.deviation_state import apply_hysteresis, reset_hysteresis
from app.data import tpa_queue_status_payload


class HysteresisTests(unittest.TestCase):
    def setUp(self):
        reset_hysteresis()

    def test_opens_above_500m(self):
        self.assertTrue(apply_hysteresis("T-X", 600.0))

    def test_holds_in_deadband(self):
        apply_hysteresis("T-X", 600.0)
        self.assertTrue(apply_hysteresis("T-X", 300.0),
                        "alert must hold between 50-500m (no flicker)")

    def test_clears_under_50m(self):
        apply_hysteresis("T-X", 600.0)
        apply_hysteresis("T-X", 300.0)
        self.assertFalse(apply_hysteresis("T-X", 30.0))

    def test_clean_truck_stays_clean(self):
        self.assertFalse(apply_hysteresis("T-Y", 120.0))


class TpaQueueScenarioTests(unittest.TestCase):
    def test_peak_scenario_shows_bottleneck(self):
        peak = tpa_queue_status_payload(scenario="peak")
        self.assertEqual(peak["trucks_in_queue"], 47)
        self.assertEqual(peak["scenario"], "peak")
        self.assertIn("peak_hour_scenario", peak["arrival_profile"])
        self.assertGreater(peak["avg_wait_minutes"], 60,
                           "documented DLH peak (47 trucks/h) must reproduce the ~117 min bottleneck")

    def test_live_scenario_uses_clock(self):
        live = tpa_queue_status_payload(scenario="live")
        self.assertEqual(live["scenario"], "live")
        self.assertEqual(live["arrival_profile"], "live_clock")


if __name__ == "__main__":
    unittest.main()
