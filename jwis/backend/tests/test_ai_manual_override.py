import time
import unittest

from app.ai.actions.auto_reroute import (
    AutoRerouter,
    manual_override_active,
    note_manual_override,
)
from app.ai.actions.auto_state import EventFeed
from app.ai.detectors.speed_anomaly import SpeedAnomalyDetector
from app.gps_feed import GpsBreadcrumb


class FakeSource:
    def __init__(self, speeds):
        self._speeds = speeds

    def current_positions(self):
        return [{"truck_code": c,
                 "latest_position": {"lat": -6.2, "lng": 106.8, "speed_kmh": s[-1]}}
                for c, s in self._speeds.items()]

    def breadcrumbs(self, truck_code, points):
        return [GpsBreadcrumb(truck_code=truck_code, lat=-6.2, lng=106.8,
                              timestamp="2026-09-10T00:00:00", speed_kmh=s)
                for s in self._speeds[truck_code][-points:]]


class ManualOverrideTests(unittest.TestCase):
    def test_note_manual_override_activates_window(self):
        note_manual_override(hold_seconds=60.0)
        self.assertTrue(manual_override_active())

    def test_expired_window_deactivates(self):
        note_manual_override(hold_seconds=0.0)
        self.assertFalse(manual_override_active())

    def test_rerouter_suppressed_during_override(self):
        import app.astar_routing as astar
        astar.set_traffic_jam_active(False)
        feed = EventFeed(maxlen=10)
        rerouter = AutoRerouter(detector=SpeedAnomalyDetector(), feed=feed)
        src = FakeSource({"T-001": [10.0] * 6})
        note_manual_override(hold_seconds=60.0)
        try:
            for _ in range(4):  # enough ticks to jam without override
                result = rerouter.run(src)
            self.assertFalse(astar.is_traffic_jam_active())
            self.assertTrue(result["manual_override"])
            self.assertEqual(feed.snapshot(), [])
        finally:
            note_manual_override(hold_seconds=0.0)
            astar.set_traffic_jam_active(False)


if __name__ == "__main__":
    unittest.main()
