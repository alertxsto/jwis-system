# -*- coding: utf-8 -*-
"""Tests for the GPS breadcrumb pipeline (Task 10)."""
import unittest

from app.gps_feed import GpsBreadcrumb, latest_breadcrumbs


class GpsFeedTests(unittest.TestCase):
    def test_breadcrumbs_are_timestamped_and_labeled_simulated(self):
        trail = latest_breadcrumbs("T-047")
        self.assertGreater(len(trail), 1)
        for b in trail:
            self.assertIsInstance(b, GpsBreadcrumb)
            self.assertEqual(b.source, "simulated")
            self.assertTrue(b.timestamp)

    def test_breadcrumbs_are_time_ordered(self):
        trail = latest_breadcrumbs("T-047")
        times = [b.timestamp for b in trail]
        self.assertEqual(times, sorted(times))

    def test_unknown_truck_returns_empty(self):
        self.assertEqual(latest_breadcrumbs("NOPE"), [])

    def test_trail_walks_along_assigned_geometry(self):
        # Breadcrumbs must trace the assigned path, not a single fixed point.
        trail = latest_breadcrumbs("T-047")
        coords = {(round(b.lat, 4), round(b.lng, 4)) for b in trail}
        self.assertGreater(len(coords), 1, "trail must move, not sit at one point")


if __name__ == "__main__":
    unittest.main()
