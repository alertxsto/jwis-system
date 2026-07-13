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


class AstarGpsAnchorTests(unittest.TestCase):
    def test_origin_snaps_within_50m_of_truck_gps(self):
        from app.astar_routing import route_from_truck, haversine_distance
        pos = {"lat": -6.221, "lng": 106.785}
        r = route_from_truck(pos)
        self.assertTrue(r["success"])
        first = r["path"][0]
        dist_m = haversine_distance((pos["lat"], pos["lng"]), (first["lat"], first["lng"])) * 1000
        self.assertLess(dist_m, 50, f"route origin {dist_m:.0f}m from truck GPS")

    def test_route_from_truck_does_not_mutate_global_graph(self):
        from app.astar_routing import route_from_truck, NODES, EDGES
        nodes_before = dict(NODES)
        edges_before = list(EDGES)
        route_from_truck({"lat": -6.20, "lng": 106.80})
        route_from_truck({"lat": -6.25, "lng": 106.90})
        self.assertEqual(NODES, nodes_before, "NODES global was mutated")
        self.assertEqual(EDGES, edges_before, "EDGES global was mutated")

    def test_metrics_use_osrm_distance_not_manual_weights(self):
        from app.astar_routing import find_astar_route
        r = find_astar_route()
        # physical_distance_km must be derived from OSRM geometry length, so it
        # should match the drawn path length, not the manual EDGES weight sum.
        self.assertIn("physical_distance_km", r)
        self.assertIn("eta_minutes", r)
        self.assertGreater(r["physical_distance_km"], 40,
                           "OSRM road distance should exceed the manual straight-line sum")

    def test_jam_off_route_does_not_divert(self):
        from app.astar_routing import reroute_payload
        # A jam on an edge that is NOT on the normal active route must not change it.
        normal = reroute_payload(False)["active_route"]["sequence"]
        # Force a jam on an off-route edge (Bekasi Timur spur, rarely on the path).
        result = reroute_payload(True, congested_edges=[("BEKASI_TIMUR", "TPA_BANTARGEBANG")])
        if not set(zip(normal, normal[1:])) & {("BEKASI_TIMUR", "TPA_BANTARGEBANG"), ("TPA_BANTARGEBANG", "BEKASI_TIMUR")}:
            self.assertEqual(result["active_route"]["sequence"], normal)


if __name__ == "__main__":
    unittest.main()
