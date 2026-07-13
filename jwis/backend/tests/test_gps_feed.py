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
        # Breadcrumbs must trace the truck's actual movement, not a single fixed point.
        trail = latest_breadcrumbs("T-047")
        coords = {(round(b.lat, 4), round(b.lng, 4)) for b in trail}
        self.assertGreater(len(coords), 1, "trail must move, not sit at one point")

    def test_trail_follows_actual_path_for_deviating_truck(self):
        # T-047 is deviating; its breadcrumb trail must include the DIVERGENT
        # actual points (those NOT on the assigned corridor), proving it follows
        # the real movement, not the assigned route.
        from app.data import ACTUAL_PATHS, ASSIGNED_PATHS
        trail = latest_breadcrumbs("T-047")
        assigned_pts = {(round(la, 3), round(ln, 3)) for la, ln in ASSIGNED_PATHS["T-047"]}
        actual_only = {(round(la, 3), round(ln, 3)) for la, ln in ACTUAL_PATHS["T-047"]} - assigned_pts
        trail_pts = {(round(b.lat, 3), round(b.lng, 3)) for b in trail}
        self.assertTrue(actual_only, "fixture precondition: actual must diverge from assigned")
        self.assertTrue(trail_pts & actual_only,
                        "breadcrumbs must include divergent actual-path points, not just assigned")


if __name__ == "__main__":
    unittest.main()
