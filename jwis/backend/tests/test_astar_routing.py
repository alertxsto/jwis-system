# -*- coding: utf-8 -*-
"""Tests for A* routing with OSRM geometry + permit constraints (Task 8)."""
import unittest

from app.astar_routing import find_astar_route


class AstarGeometryTests(unittest.TestCase):
    def test_routed_path_is_road_following_or_falls_back(self):
        r = find_astar_route()
        self.assertTrue(r["success"])
        # Road-following geometry has many points; a straight-line fallback is
        # allowed only when OSRM is unreachable (still labeled).
        self.assertGreater(len(r["path"]), 20)
        self.assertIn("geometry_source", r)

    def test_returns_separated_cost_distance_eta(self):
        r = find_astar_route()
        self.assertIn("optimization_cost", r)
        self.assertIn("physical_distance_km", r)
        self.assertIn("eta_minutes", r)


class AstarPermitTests(unittest.TestCase):
    def test_permit_blocked_edge_is_never_selected(self):
        # Block the shortest first hop; route must avoid that exact edge.
        r = find_astar_route(blocked_edges=[("ORIGIN", "SLIPI")])
        self.assertTrue(r["success"])
        seq = r["sequence"]
        pairs = list(zip(seq, seq[1:]))
        self.assertNotIn(("ORIGIN", "SLIPI"), pairs)
        self.assertNotIn(("SLIPI", "ORIGIN"), pairs)


if __name__ == "__main__":
    unittest.main()
