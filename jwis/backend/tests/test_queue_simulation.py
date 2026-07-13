# -*- coding: utf-8 -*-
"""Tests for the discrete-event Bantargebang queue simulation (Task 3)."""
import unittest

from app.queue_simulation import simulate_queue


class QueueValidationTests(unittest.TestCase):
    def test_negative_trucks_rejected(self):
        with self.assertRaises(ValueError):
            simulate_queue(arrival_count=-5, weighbridges=2, service_rate_per_hour=30)

    def test_zero_throughput_rejected(self):
        with self.assertRaises(ValueError):
            simulate_queue(arrival_count=10, weighbridges=0, service_rate_per_hour=30)
        with self.assertRaises(ValueError):
            simulate_queue(arrival_count=10, weighbridges=2, service_rate_per_hour=0)


class QueueDeterminismTests(unittest.TestCase):
    def test_same_seed_reproducible(self):
        a = simulate_queue(arrival_count=40, weighbridges=2, service_rate_per_hour=30, seed=7)
        b = simulate_queue(arrival_count=40, weighbridges=2, service_rate_per_hour=30, seed=7)
        self.assertEqual(a["mean_wait_minutes"], b["mean_wait_minutes"])
        self.assertEqual(a["p95_wait_minutes"], b["p95_wait_minutes"])

    def test_output_fields_present(self):
        r = simulate_queue(arrival_count=40, weighbridges=2, service_rate_per_hour=30, seed=1)
        for key in ("mean_wait_minutes", "p95_wait_minutes", "max_queue",
                    "throughput_per_hour", "utilization", "wait_ci95", "recommended_slots"):
            self.assertIn(key, r)


class QueueBehaviorTests(unittest.TestCase):
    def test_more_demand_increases_wait(self):
        low = simulate_queue(arrival_count=10, weighbridges=2, service_rate_per_hour=30, seed=3)
        peak = simulate_queue(arrival_count=80, weighbridges=2, service_rate_per_hour=30, seed=3)
        self.assertGreater(peak["mean_wait_minutes"], low["mean_wait_minutes"],
                           "peak demand must produce longer waits than low demand")

    def test_more_weighbridges_reduces_wait(self):
        one = simulate_queue(arrival_count=60, weighbridges=1, service_rate_per_hour=30, seed=5)
        three = simulate_queue(arrival_count=60, weighbridges=3, service_rate_per_hour=30, seed=5)
        self.assertGreater(one["mean_wait_minutes"], three["mean_wait_minutes"],
                           "more weighbridges must reduce waiting")

    def test_utilization_between_zero_and_one_plus(self):
        r = simulate_queue(arrival_count=40, weighbridges=2, service_rate_per_hour=30, seed=2)
        self.assertGreaterEqual(r["utilization"], 0.0)


if __name__ == "__main__":
    unittest.main()
