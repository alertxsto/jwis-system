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

    def test_gps_local_graph_has_no_legacy_origin_edges(self):
        # A GPS-anchored graph must expose exactly one ORIGIN edge: the fresh
        # connector to the nearest node, with no inherited fixed-node edges.
        from app.astar_routing import build_gps_graph, nearest_node
        pos = {"lat": -6.126, "lng": 106.843}
        snap = nearest_node(pos["lat"], pos["lng"])
        nodes, edges = build_gps_graph(pos)
        origin_edges = [(u, v) for (u, v, _d) in edges if u == "ORIGIN" or v == "ORIGIN"]
        self.assertEqual(len(origin_edges), 1, f"expected 1 ORIGIN edge, got {origin_edges}")
        self.assertIn(snap, origin_edges[0])

    def test_metrics_use_osrm_distance_not_manual_weights(self):
        from app.astar_routing import find_astar_route
        r = find_astar_route()
        # physical_distance_km must be derived from OSRM geometry length, so it
        # should match the drawn path length, not the manual EDGES weight sum.
        self.assertIn("physical_distance_km", r)
        self.assertIn("eta_minutes", r)
        self.assertGreater(r["physical_distance_km"], 40,
                           "OSRM road distance should exceed the manual straight-line sum")

    def test_astar_cost_matches_directed_dijkstra(self):
        # A* with a zero heuristic must equal directed Dijkstra's optimal cost,
        # never worse, across jam/permit scenarios (admissible by construction).
        import heapq as _hq
        from app.astar_routing import find_astar_route, NODES, EDGES, _edge_meta, _osrm_edge

        def dijkstra(congested, blocked):
            cset = set(congested) | {(v, u) for (u, v) in congested}
            bset = set(blocked) | {(v, u) for (u, v) in blocked}
            adj = {n: [] for n in NODES}
            for u, v, _d in EDGES:
                adj[u].append(v); adj[v].append(u)
            pq = [(0.0, "ORIGIN")]
            best = {"ORIGIN": 0.0}
            while pq:
                cost, u = _hq.heappop(pq)
                if u == "TPA_BANTARGEBANG":
                    return round(cost, 2)
                if cost > best.get(u, float("inf")):
                    continue
                for v in adj[u]:
                    if (u, v) in bset or not _edge_meta(u, v)["permit_allowed"]:
                        continue
                    _g, _km, dur, _o = _osrm_edge(NODES[u][0], NODES[u][1], NODES[v][0], NODES[v][1])
                    mult = 5.0 if (u, v) in cset else 1.0
                    nc = cost + dur * mult
                    if nc < best.get(v, float("inf")):
                        best[v] = nc
                        _hq.heappush(pq, (nc, v))
            return None

        scenarios = [([], []), ([("CAWANG", "BEKASI_BARAT")], []), ([], [("ORIGIN", "SLIPI")])]
        for cong, blk in scenarios:
            astar = find_astar_route(congested_edges=cong, blocked_edges=blk)
            ref = dijkstra(cong, blk)
            self.assertIsNotNone(ref)
            self.assertAlmostEqual(astar["optimization_cost"], ref, delta=0.5,
                                   msg=f"A* not optimal for cong={cong} blk={blk}")

    def test_astar_heuristic_is_admissible(self):
        # Admissibility: h(node) must never exceed the true optimal duration cost
        # from that node to goal. A straight-line-km/45 heuristic can overestimate
        # when roads are faster than 45km/h; a zero heuristic is always admissible.
        import heapq as _hq
        from app.astar_routing import NODES, EDGES, _edge_meta, _osrm_edge, _heuristic_minutes

        def true_cost_to_goal(start):
            adj = {n: [] for n in NODES}
            for u, v, _d in EDGES:
                adj[u].append(v); adj[v].append(u)
            pq = [(0.0, start)]
            best = {start: 0.0}
            while pq:
                c, u = _hq.heappop(pq)
                if u == "TPA_BANTARGEBANG":
                    return c
                if c > best.get(u, float("inf")):
                    continue
                for v in adj[u]:
                    if not _edge_meta(u, v)["permit_allowed"]:
                        continue
                    _g, _km, dur, _o = _osrm_edge(NODES[u][0], NODES[u][1], NODES[v][0], NODES[v][1])
                    nc = c + dur
                    if nc < best.get(v, float("inf")):
                        best[v] = nc
                        _hq.heappush(pq, (nc, v))
            return None

        for node in NODES:
            if node == "TPA_BANTARGEBANG":
                continue
            true_cost = true_cost_to_goal(node)
            if true_cost is None:
                continue
            h = _heuristic_minutes(node, "TPA_BANTARGEBANG", NODES)
            self.assertLessEqual(h, true_cost + 0.01,
                                 f"heuristic inadmissible at {node}: h={h:.1f} > true={true_cost:.1f}")

    def test_warm_edge_cache_populates_all_edges(self):
        from app.astar_routing import warm_edge_cache, EDGES
        count = warm_edge_cache()
        # Every graph edge geometry is cached so the first demo request is warm.
        self.assertGreaterEqual(count, len(EDGES))

    def test_optimization_objective_is_osrm_duration(self):
        # With OSRM live and no congestion, the search cost equals summed OSRM
        # durations, so optimization_cost tracks eta_minutes (not the km weights).
        from app.astar_routing import find_astar_route
        r = find_astar_route()
        if r.get("geometry_source") != "osrm":
            self.skipTest("OSRM unreachable")
        self.assertAlmostEqual(r["optimization_cost"], r["eta_minutes"], delta=2,
                               msg="A* objective is not OSRM duration")

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
