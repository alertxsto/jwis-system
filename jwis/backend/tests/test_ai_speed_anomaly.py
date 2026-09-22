import unittest

from app.ai.detectors.speed_anomaly import SpeedAnomalyDetector
from app.gps_feed import GpsBreadcrumb


class FakeSource:
    """Deterministic GpsDataSource double."""
    def __init__(self, speeds: dict[str, list[float]]):
        # speeds: truck_code -> list of crumb speeds
        self._speeds = speeds

    def current_positions(self):
        return [{"truck_code": code,
                 "latest_position": {"lat": 0.0, "lng": 0.0, "speed_kmh": s[-1]}}
                for code, s in self._speeds.items()]

    def breadcrumbs(self, truck_code, points):
        speeds = self._speeds[truck_code][-points:]
        return [GpsBreadcrumb(truck_code=truck_code, lat=0.0, lng=0.0,
                              timestamp=f"2026-09-10T00:00:{i:02d}", speed_kmh=s)
                for i, s in enumerate(speeds)]

    def set_speeds(self, speeds: dict[str, list[float]]):
        self._speeds = speeds


def _detector() -> SpeedAnomalyDetector:
    return SpeedAnomalyDetector(slow_kmh=15.0, clear_kmh=25.0,
                                slow_ticks=3, clear_ticks=2)


class SpeedAnomalyTests(unittest.TestCase):
    def test_fast_truck_never_jams(self):
        det = _detector()
        src = FakeSource({"T-001": [40.0] * 6})
        for _ in range(4):
            signals = det.evaluate(src)
        self.assertFalse(signals["T-001"].jammed)
        self.assertEqual(signals["T-001"].ticks_below, 0)

    def test_jam_triggers_after_slow_ticks(self):
        det = _detector()
        src = FakeSource({"T-001": [10.0] * 6})
        self.assertFalse(det.evaluate(src)["T-001"].jammed)   # tick 1
        self.assertFalse(det.evaluate(src)["T-001"].jammed)   # tick 2
        self.assertTrue(det.evaluate(src)["T-001"].jammed)    # tick 3
        self.assertEqual(det.evaluate(src)["T-001"].ticks_below, 4)

    def test_slow_counter_resets_on_fast_tick(self):
        det = _detector()
        src = FakeSource({"T-001": [10.0] * 6})
        det.evaluate(src)
        det.evaluate(src)
        src.set_speeds({"T-001": [40.0] * 6})
        det.evaluate(src)
        src.set_speeds({"T-001": [10.0] * 6})
        self.assertFalse(det.evaluate(src)["T-001"].jammed)  # counter restarted

    def test_hysteresis_holds_jam_between_thresholds(self):
        det = _detector()
        src = FakeSource({"T-001": [10.0] * 6})
        for _ in range(3):
            det.evaluate(src)                                  # jam ON
        src.set_speeds({"T-001": [20.0] * 6})                  # between 15 and 25
        self.assertTrue(det.evaluate(src)["T-001"].jammed)     # held

    def test_jam_clears_after_clear_ticks(self):
        det = _detector()
        src = FakeSource({"T-001": [10.0] * 6})
        for _ in range(3):
            det.evaluate(src)                                  # jam ON
        src.set_speeds({"T-001": [40.0] * 6})
        self.assertTrue(det.evaluate(src)["T-001"].jammed)     # clear tick 1
        self.assertFalse(det.evaluate(src)["T-001"].jammed)    # clear tick 2

    def test_trucks_without_breadcrumbs_are_skipped(self):
        det = _detector()

        class EmptySource(FakeSource):
            def breadcrumbs(self, truck_code, points):
                return []

        src = EmptySource({"T-999": [5.0]})
        signals = det.evaluate(src)
        self.assertNotIn("T-999", signals)


if __name__ == "__main__":
    unittest.main()
