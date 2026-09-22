import unittest
from unittest import mock

from app.ai.actions.auto_reroute import AutoRerouter
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

    def set_speeds(self, speeds):
        self._speeds = speeds


def _slow_src():
    return FakeSource({"T-001": [10.0] * 6})


class AutoRerouteTests(unittest.TestCase):
    def setUp(self):
        import app.astar_routing as astar
        astar.set_traffic_jam_active(False)
        self.feed = EventFeed(maxlen=10)
        self.detector = SpeedAnomalyDetector()
        self.rerouter = AutoRerouter(detector=self.detector, feed=self.feed)

    def tearDown(self):
        import app.astar_routing as astar
        astar.set_traffic_jam_active(False)

    def test_no_jam_no_action(self):
        src = FakeSource({"T-001": [40.0] * 6})
        result = self.rerouter.run(src)
        self.assertFalse(result["jam_active"])
        self.assertEqual(result["rerouted"], [])
        self.assertEqual(self.feed.snapshot(), [])

    def test_jam_activates_reroute_and_emits_events(self):
        src = _slow_src()
        with mock.patch("app.ai.actions.auto_reroute.route_from_truck") as mock_route:
            mock_route.return_value = {"success": True, "distance_km": 14.2,
                                       "eta_minutes": 21}
            self.rerouter.run(src)                 # tick 1
            self.rerouter.run(src)                 # tick 2
            result = self.rerouter.run(src)        # tick 3 -> jam
        self.assertTrue(result["jam_active"])
        self.assertEqual(result["jammed_trucks"], ["T-001"])
        self.assertEqual(result["rerouted"], ["T-001"])
        mock_route.assert_called_once()
        events = self.feed.snapshot()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "auto_reroute")
        self.assertEqual(events[0]["truck_code"], "T-001")
        self.assertTrue(events[0]["detail"]["reroute_success"])
        import app.astar_routing as astar
        self.assertTrue(astar.is_traffic_jam_active())

    def test_steady_jam_does_not_spam_events(self):
        src = _slow_src()
        with mock.patch("app.ai.actions.auto_reroute.route_from_truck") as mock_route:
            mock_route.return_value = {"success": True, "distance_km": 14.2,
                                       "eta_minutes": 21}
            for _ in range(3):
                self.rerouter.run(src)             # jam activates
            self.rerouter.run(src)                 # steady jam
            self.rerouter.run(src)                 # steady jam
        self.assertEqual(len(self.feed.snapshot()), 1)
        self.assertEqual(mock_route.call_count, 1)

    def test_jam_clear_emits_event_and_deactivates(self):
        src = _slow_src()
        with mock.patch("app.ai.actions.auto_reroute.route_from_truck") as mock_route:
            mock_route.return_value = {"success": True, "distance_km": 14.2,
                                       "eta_minutes": 21}
            for _ in range(3):
                self.rerouter.run(src)
        src.set_speeds({"T-001": [45.0] * 6})
        self.rerouter.run(src)                     # clear tick 1
        result = self.rerouter.run(src)            # clear tick 2 -> cleared
        self.assertFalse(result["jam_active"])
        self.assertTrue(result["cleared"])
        types = [e["event_type"] for e in self.feed.snapshot()]
        self.assertEqual(types, ["auto_reroute", "jam_cleared"])
        import app.astar_routing as astar
        self.assertFalse(astar.is_traffic_jam_active())

    def test_failed_route_still_emits_event_with_flag(self):
        src = _slow_src()
        with mock.patch("app.ai.actions.auto_reroute.route_from_truck") as mock_route:
            mock_route.return_value = {"success": False, "message": "No route found."}
            for _ in range(3):
                result = self.rerouter.run(src)
        self.assertTrue(result["jam_active"])
        self.assertEqual(result["rerouted"], [])
        events = self.feed.snapshot()
        self.assertEqual(len(events), 1)
        self.assertFalse(events[0]["detail"]["reroute_success"])


if __name__ == "__main__":
    unittest.main()
