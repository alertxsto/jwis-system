import unittest
from unittest import mock

from app.ai.forecasters.queue_predictor import TpaQueuePredictor
from app.astar_routing import NODES

_tpa = NODES["TPA_BANTARGEBANG"]
TPA_LAT, TPA_LNG = _tpa[0], _tpa[1]  # NODES values are (lat, lng, label) tuples


def _truck(code, lat, lng, speed, status="active"):
    return {"truck_code": code, "status": status,
            "latest_position": {"lat": lat, "lng": lng, "speed_kmh": speed}}


class FakeSource:
    def __init__(self, trucks):
        self._trucks = trucks

    def current_positions(self):
        return self._trucks


FAKE_SIM = {"mean_wait_minutes": 12.5, "p95_wait_minutes": 30.0, "max_queue": 4,
            "throughput_per_hour": 28.0, "utilization": 0.62,
            "wait_ci95": [10.1, 14.9], "recommended_slots": 3, "replications": 100}


class TpaQueuePredictorTests(unittest.TestCase):
    def test_latest_no_data_before_first_update(self):
        pred = TpaQueuePredictor()
        self.assertEqual(pred.latest(), {"status": "no_data"})

    def test_stopped_truck_inside_geofence_counts_in_queue(self):
        # ~111m from TPA (0.001 deg lat ≈ 111m)
        src = FakeSource([_truck("T-001", TPA_LAT + 0.001, TPA_LNG, 0.0)])
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                        return_value=FAKE_SIM) as sim:
            snap = pred.update(src)
        self.assertEqual(snap["trucks_in_queue"], 1)
        sim.assert_called_once()
        self.assertEqual(sim.call_args.kwargs["weighbridges"], 2)

    def test_moving_truck_inside_geofence_is_arriving_not_queued(self):
        src = FakeSource([_truck("T-002", TPA_LAT + 0.001, TPA_LNG, 30.0)])
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                        return_value=FAKE_SIM):
            snap = pred.update(src)
        self.assertEqual(snap["trucks_in_queue"], 0)
        self.assertEqual(snap["arriving_soon"], 1)

    def test_far_truck_excluded(self):
        # ~7.8km away
        src = FakeSource([_truck("T-003", TPA_LAT + 0.05, TPA_LNG + 0.05, 0.0)])
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                        return_value=FAKE_SIM):
            snap = pred.update(src)
        self.assertEqual(snap["trucks_in_queue"], 0)
        self.assertEqual(snap["arriving_soon"], 0)

    def test_new_arrival_tracked_in_rate(self):
        inside = _truck("T-010", TPA_LAT + 0.001, TPA_LNG, 0.0)
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                        return_value=FAKE_SIM):
            pred.update(FakeSource([]))            # nothing nearby
            snap = pred.update(FakeSource([inside]))  # T-010 just arrived
        self.assertGreaterEqual(snap["arrival_rate_per_h"], 4.0)  # 1 in 15min -> 4/h

    def test_congestion_levels(self):
        pred = TpaQueuePredictor()
        for wait, level in [(5, "low"), (15, "moderate"), (30, "high"), (60, "severe")]:
            sim = dict(FAKE_SIM, mean_wait_minutes=float(wait))
            with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                            return_value=sim):
                snap = pred.update(FakeSource([]))
            self.assertEqual(snap["congestion_level"], level, f"wait={wait}")

    def test_trend_rising_then_stable(self):
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue") as sim:
            for w in [10.0] * 10 + [20.0] * 10:
                sim.return_value = dict(FAKE_SIM, mean_wait_minutes=w)
                snap = pred.update(FakeSource([]))
        self.assertEqual(snap["trend"], "rising")
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue") as sim:
            for _ in range(10):
                sim.return_value = dict(FAKE_SIM, mean_wait_minutes=20.0)
                snap = pred.update(FakeSource([]))
        self.assertEqual(snap["trend"], "stable")

    def test_output_schema_complete(self):
        pred = TpaQueuePredictor()
        with mock.patch("app.ai.forecasters.queue_predictor.simulate_queue",
                        return_value=FAKE_SIM):
            snap = pred.update(FakeSource([]))
        for key in ["trucks_in_queue", "arriving_soon", "arrival_rate_per_h",
                    "predicted_wait_min", "wait_ci95", "trend",
                    "congestion_level", "updated_at"]:
            self.assertIn(key, snap)
        self.assertEqual(snap["predicted_wait_min"], 12.5)


if __name__ == "__main__":
    unittest.main()
