import os
import unittest
from unittest import mock

from app.ai.actions.auto_state import AiEvent, EventFeed
from app.ai.base import LiveGpsSource, SimulatedGpsSource, get_gps_source


class GpsSourceTests(unittest.TestCase):
    def test_default_source_is_simulated(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("JWIS_GPS_SOURCE", None)
            source = get_gps_source()
        self.assertIsInstance(source, SimulatedGpsSource)

    def test_live_source_selected_by_env(self):
        with mock.patch.dict(os.environ, {"JWIS_GPS_SOURCE": "live"}):
            source = get_gps_source()
        self.assertIsInstance(source, LiveGpsSource)

    def test_live_source_raises_not_implemented(self):
        source = LiveGpsSource()
        with self.assertRaises(NotImplementedError):
            source.current_positions()

    def test_simulated_source_returns_truck_positions(self):
        source = SimulatedGpsSource()
        positions = source.current_positions()
        self.assertIsInstance(positions, list)
        self.assertGreater(len(positions), 0)
        self.assertIn("truck_code", positions[0])
        self.assertIn("latest_position", positions[0])

    def test_simulated_source_breadcrumbs_for_known_truck(self):
        source = SimulatedGpsSource()
        crumbs = source.breadcrumbs("T-001", points=3)
        self.assertEqual(len(crumbs), 3)
        self.assertTrue(all(c.truck_code == "T-001" for c in crumbs))


class EventFeedTests(unittest.TestCase):
    def test_append_and_snapshot_returns_dicts(self):
        feed = EventFeed(maxlen=5)
        feed.append(AiEvent(event_type="auto_reroute", truck_code="T-001",
                            title="Reroute", detail={"km": 1.2}, confidence=0.8,
                            created_at="2026-09-10T00:00:00"))
        snap = feed.snapshot()
        self.assertEqual(len(snap), 1)
        self.assertIsInstance(snap[0], dict)
        self.assertEqual(snap[0]["event_type"], "auto_reroute")
        self.assertEqual(snap[0]["status"], "new")

    def test_ring_buffer_evicts_oldest(self):
        feed = EventFeed(maxlen=3)
        for i in range(5):
            feed.append(AiEvent(event_type="x", truck_code=None, title=f"e{i}",
                                detail={}, confidence=1.0,
                                created_at="2026-09-10T00:00:00"))
        titles = [e["title"] for e in feed.snapshot()]
        self.assertEqual(titles, ["e2", "e3", "e4"])

    def test_acknowledge_marks_event(self):
        feed = EventFeed(maxlen=5)
        feed.append(AiEvent(event_type="x", truck_code=None, title="e",
                            detail={}, confidence=1.0,
                            created_at="2026-09-10T00:00:00"))
        self.assertTrue(feed.acknowledge(0))
        self.assertEqual(feed.snapshot()[0]["status"], "acknowledged")
        self.assertFalse(feed.acknowledge(99))

    def test_snapshot_is_immutable_copy(self):
        feed = EventFeed(maxlen=5)
        feed.append(AiEvent(event_type="x", truck_code=None, title="e",
                            detail={}, confidence=1.0,
                            created_at="2026-09-10T00:00:00"))
        snap = feed.snapshot()
        snap[0]["status"] = "hacked"
        self.assertEqual(feed.snapshot()[0]["status"], "new")


if __name__ == "__main__":
    unittest.main()
