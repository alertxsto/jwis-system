import time
import unittest

from app.ai.actions.auto_state import EventFeed
from app.ai.detectors.deviation_trigger import DeviationTrigger


def _truck(code, violated, distance=600.0):
    return {"truck_code": code,
            "latest_position": {"lat": -6.2, "lng": 106.8, "speed_kmh": 25.0},
            "deviation": {"violated": violated, "distance_meters": distance}}


class FakeSource:
    def __init__(self, trucks):
        self._trucks = trucks

    def current_positions(self):
        return self._trucks

    def set_trucks(self, trucks):
        self._trucks = trucks


class DeviationTriggerTests(unittest.TestCase):
    def setUp(self):
        self.feed = EventFeed(maxlen=20)
        self.trigger = DeviationTrigger(feed=self.feed, cooldown_seconds=300.0)

    def test_no_violation_no_event(self):
        src = FakeSource([_truck("T-001", False)])
        self.assertEqual(self.trigger.check(src), [])
        self.assertEqual(self.feed.snapshot(), [])

    def test_rising_edge_emits_replay_event(self):
        src = FakeSource([_truck("T-047", False)])
        self.trigger.check(src)
        src.set_trucks([_truck("T-047", True)])
        self.assertEqual(self.trigger.check(src), ["T-047"])
        events = self.feed.snapshot()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "auto_replay")
        self.assertEqual(events[0]["truck_code"], "T-047")
        self.assertEqual(events[0]["detail"]["distance_meters"], 600.0)

    def test_continuous_violation_emits_only_once(self):
        src = FakeSource([_truck("T-047", True)])
        self.assertEqual(self.trigger.check(src), ["T-047"])
        self.assertEqual(self.trigger.check(src), [])
        self.assertEqual(self.trigger.check(src), [])
        self.assertEqual(len(self.feed.snapshot()), 1)

    def test_re_violation_within_cooldown_deduped(self):
        src = FakeSource([_truck("T-047", True)])
        self.trigger.check(src)
        src.set_trucks([_truck("T-047", False)])
        self.trigger.check(src)
        src.set_trucks([_truck("T-047", True)])
        self.assertEqual(self.trigger.check(src), [])  # cooldown belum lewat
        self.assertEqual(len(self.feed.snapshot()), 1)

    def test_cooldown_expiry_allows_re_emit(self):
        trigger = DeviationTrigger(feed=self.feed, cooldown_seconds=0.05)
        src = FakeSource([_truck("T-047", True)])
        trigger.check(src)
        src.set_trucks([_truck("T-047", False)])
        trigger.check(src)
        time.sleep(0.06)
        src.set_trucks([_truck("T-047", True)])
        self.assertEqual(trigger.check(src), ["T-047"])
        self.assertEqual(len(self.feed.snapshot()), 2)

    def test_multiple_trucks_tracked_independently(self):
        src = FakeSource([_truck("T-001", True), _truck("T-002", True)])
        self.assertEqual(sorted(self.trigger.check(src)), ["T-001", "T-002"])
        self.assertEqual(len(self.feed.snapshot()), 2)


if __name__ == "__main__":
    unittest.main()
