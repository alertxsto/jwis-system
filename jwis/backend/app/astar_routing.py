# -*- coding: utf-8 -*-
"""
astar_routing.py - Custom A* Pathfinding Engine with Dynamic Traffic Weight.
Designed for JWIS truck routing under permit-corridor constraint.
When a road segment becomes congested, A* recomputes an alternative route
automatically (Google-Maps-style live rerouting for waste trucks).
"""
from __future__ import annotations

import heapq
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from typing import Any

from app.osrm import fetch_osrm_route

# Simplified Jakarta -> Bantargebang road network for real-time truck logistics.
# Each node is an actual intersection / checkpoint (lat, lng, label).
NODES = {
    "ORIGIN": (-6.221, 106.785, "Posisi Truk T-047 (Arteri Barat)"),
    "KEBON_JERUK": (-6.181, 106.764, "Simpang Susun Kebon Jeruk"),
    "SLIPI": (-6.198, 106.797, "Flyover Slipi"),
    "TOMANG": (-6.179, 106.788, "Gerbang Tol Tomang"),
    "SEMANGGI": (-6.219, 106.812, "Simpang Susun Semanggi"),
    "ANCOL": (-6.126, 106.843, "Tol Ancol Pelabuhan"),
    "CAWANG": (-6.244, 106.872, "Simpang Cawang / Tol Dalam Kota"),
    "BEKASI_BARAT": (-6.241, 106.994, "Gerbang Tol Bekasi Barat"),
    "BEKASI_TIMUR": (-6.258, 107.017, "Gerbang Tol Bekasi Timur"),
    "TPA_BANTARGEBANG": (-6.331, 106.991, "Jembatan Timbang TPA Bantargebang"),
}

# Standard connections with base distances in kilometers.
EDGES = [
    ("ORIGIN", "KEBON_JERUK", 4.5),
    ("ORIGIN", "SLIPI", 3.2),
    ("KEBON_JERUK", "TOMANG", 2.8),
    ("SLIPI", "TOMANG", 2.1),
    ("SLIPI", "SEMANGGI", 2.8),
    ("TOMANG", "ANCOL", 8.4),
    ("SEMANGGI", "CAWANG", 7.1),
    ("ANCOL", "CAWANG", 14.5),
    ("CAWANG", "BEKASI_BARAT", 13.8),
    ("BEKASI_BARAT", "BEKASI_TIMUR", 3.2),
    ("BEKASI_BARAT", "TPA_BANTARGEBANG", 10.2),
    ("BEKASI_TIMUR", "TPA_BANTARGEBANG", 8.5),
    # Coastal toll bypass via Tanjung Priok (used when CAWANG is gridlocked)
    ("ANCOL", "BEKASI_BARAT", 22.0),
]

# Per-edge metadata: permit_allowed gates truck-legal corridors; base_traffic is
# a 1.0 baseline multiplier. A real deployment sources these from DLH permits +
# live traffic; here they are documented demo constants.
EDGE_META: dict[tuple[str, str], dict[str, Any]] = {
    ("ANCOL", "CAWANG"): {"permit_allowed": False},  # not a truck-permitted corridor
}


def _edge_meta(u: str, v: str) -> dict[str, Any]:
    return EDGE_META.get((u, v)) or EDGE_META.get((v, u)) or {"permit_allowed": True}


def haversine_distance(coord1, coord2):
    R = 6371.0  # Earth radius in km
    lat1, lon1 = radians(coord1[0]), radians(coord1[1])
    lat2, lon2 = radians(coord2[0]), radians(coord2[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 2 * R * asin(sqrt(a))


@lru_cache(maxsize=256)
def _osrm_edge(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> tuple:
    """OSRM road geometry + distance(km) + duration(min) for one coordinate edge.

    Cached on coordinates (not node names) so route_from_truck's local graph
    reuses the cache. Returns (geometry_tuple, distance_km, duration_min, is_osrm).
    Falls back to the straight-line endpoints + haversine when OSRM is down.
    """
    route = fetch_osrm_route("edge", (a_lat, a_lng), (b_lat, b_lng), timeout_seconds=6.0)
    if route.get("source") == "osrm" and route.get("path"):
        geom = tuple((p["lat"], p["lng"]) for p in route["path"])
        return geom, float(route["distance_km"]), float(route["eta_minutes"]), True
    d = haversine_distance((a_lat, a_lng), (b_lat, b_lng))
    return (((a_lat, a_lng), (b_lat, b_lng)), d, (d / 45) * 60, False)


def build_path_from_sequence(node_sequence, nodes) -> tuple[list[dict], str, float, float]:
    """Concatenate OSRM edge geometry across the node sequence.

    Returns (path, geometry_source, osrm_distance_km, osrm_duration_min). Distance
    and duration come from OSRM per edge, not the manual EDGES weights.
    """
    path: list[dict] = []
    source = "osrm"
    total_km = 0.0
    total_min = 0.0
    for i in range(len(node_sequence) - 1):
        u, v = node_sequence[i], node_sequence[i + 1]
        geom, dist_km, dur_min, is_osrm = _osrm_edge(nodes[u][0], nodes[u][1], nodes[v][0], nodes[v][1])
        if not is_osrm:
            source = "fallback-straight-line"
        total_km += dist_km
        total_min += dur_min
        for lat, lng in geom:
            point = {"lat": round(lat, 6), "lng": round(lng, 6)}
            if not path or path[-1] != point:
                path.append(point)
    return path, source, round(total_km, 1), round(total_min)


def find_astar_route(start="ORIGIN", goal="TPA_BANTARGEBANG",
                     congested_edges=None, blocked_edges=None,
                     nodes=None, edges=None):
    """A* shortest path with permit gating, traffic weighting, and OSRM geometry.

    - blocked_edges (permit): never traversed.
    - congested_edges: x5 traffic penalty on the optimization cost.
    - nodes/edges: optional local graph (route_from_truck passes copies so the
      global graph is never mutated).
    Returns separated fields: optimization_cost (weighted search cost),
    physical_distance_km (from OSRM geometry), eta_minutes (from OSRM durations),
    plus OSRM path geometry.
    """
    nodes = nodes if nodes is not None else NODES
    edges = edges if edges is not None else EDGES
    congested_edges = congested_edges or []
    blocked_edges = blocked_edges or []

    congested_set = set()
    for u, v in congested_edges:
        congested_set.add((u, v))
        congested_set.add((v, u))
    blocked_set = set()
    for u, v in blocked_edges:
        blocked_set.add((u, v))
        blocked_set.add((v, u))

    def heuristic(node):
        km = haversine_distance(
            (nodes[node][0], nodes[node][1]),
            (nodes[goal][0], nodes[goal][1]),
        )
        # Admissible duration estimate: straight-line km at max truck speed.
        return (km / 45.0) * 60.0

    def edge_duration_min(u, v):
        _geom, _km, dur_min, _osrm = _osrm_edge(nodes[u][0], nodes[u][1], nodes[v][0], nodes[v][1])
        return dur_min

    adj = {n: [] for n in nodes}
    for u, v, d in edges:
        adj[u].append(v)
        adj[v].append(u)

    pq = [(heuristic(start), 0.0, start, [start])]
    visited = {}

    while pq:
        f, cost, u, path = heapq.heappop(pq)

        if u == goal:
            detailed, geom_source, osrm_km, osrm_min = build_path_from_sequence(path, nodes)
            return {
                "success": True,
                "sequence": path,
                "sequence_labels": [nodes[n][2] for n in path],
                "path": detailed,
                "geometry_source": geom_source,
                "optimization_cost": round(cost, 2),
                "physical_distance_km": osrm_km,
                "distance_km": osrm_km,
                "eta_minutes": max(15, osrm_min),
                "is_diverted": len(congested_edges) > 0,
                "permit_source": "SIMULATED PERMIT CONSTRAINT (not official DLH permit dataset)",
            }

        if u in visited and visited[u] <= cost:
            continue
        visited[u] = cost

        for v in adj[u]:
            if (u, v) in blocked_set or not _edge_meta(u, v)["permit_allowed"]:
                continue
            multiplier = 5.0 if (u, v) in congested_set else 1.0
            cost_new = cost + edge_duration_min(u, v) * multiplier
            f_new = cost_new + heuristic(v)
            if v not in visited or visited[v] > cost_new:
                heapq.heappush(pq, (f_new, cost_new, v, path + [v]))

    return {"success": False, "message": "No route found."}


# Default congestion scenario for the demo: the Cawang -> Bekasi Barat inner-city
# toll segment is gridlocked, forcing a divert via the Ancol coastal toll.
DEMO_CONGESTED_EDGES = [("CAWANG", "BEKASI_BARAT")]


def nearest_node(lat: float, lng: float, exclude=("TPA_BANTARGEBANG", "ORIGIN")) -> str:
    """Snap a GPS coordinate to the closest real network node (never ORIGIN itself)."""
    best, best_d = None, float("inf")
    for name, (nlat, nlng, _label) in NODES.items():
        if name in exclude:
            continue
        d = haversine_distance((lat, lng), (nlat, nlng))
        if d < best_d:
            best, best_d = name, d
    return best


def build_gps_graph(position: dict) -> tuple[dict, list]:
    """Local graph copy with a fresh GPS ORIGIN and a single connector edge.

    Strips every ORIGIN edge inherited from the fixed-node graph, then adds only
    the connector to the nearest real node — so the GPS origin never routes
    through stale fixed-ORIGIN edges. Global graph is untouched.
    """
    lat, lng = position["lat"], position["lng"]
    snap = nearest_node(lat, lng)
    nodes = dict(NODES)
    edges = [(u, v, d) for (u, v, d) in EDGES if u != "ORIGIN" and v != "ORIGIN"]
    nodes["ORIGIN"] = (lat, lng, "Posisi Truk (GPS)")
    if snap != "ORIGIN":
        d = haversine_distance((lat, lng), (nodes[snap][0], nodes[snap][1]))
        edges.append(("ORIGIN", snap, round(d, 2)))
    return nodes, edges


def route_from_truck(position: dict, goal="TPA_BANTARGEBANG", **kwargs) -> dict:
    """Route anchored to a truck's real GPS, on a local graph with no legacy
    ORIGIN edges (see build_gps_graph)."""
    nodes, edges = build_gps_graph(position)
    return find_astar_route(start="ORIGIN", goal=goal, nodes=nodes, edges=edges, **kwargs)


def reroute_payload(jam_active: bool, congested_edges=None, origin_position=None):
    """Return normal and (if a jam actually hits the active route) diverted route.

    - origin_position: {lat,lng} GPS to anchor the route origin at the real truck
      marker (falls back to the fixed ORIGIN node when absent).
    - Congestion is emitted as a road-segment LineString (OSRM geometry) with the
      segment name, source, and traffic multiplier — not just a midpoint pin.
    A jam on an edge NOT on the active route does not trigger a diversion.
    """
    jam_edges = congested_edges if congested_edges is not None else DEMO_CONGESTED_EDGES

    def _route(cong):
        if origin_position:
            return route_from_truck(origin_position, congested_edges=cong)
        return find_astar_route(congested_edges=cong)

    normal = _route([])
    normal_edges = set(zip(normal["sequence"], normal["sequence"][1:]))
    normal_edges |= {(v, u) for (u, v) in normal_edges}

    hits_route = any((u, v) in normal_edges for (u, v) in jam_edges)
    if not jam_active or not hits_route:
        return {
            "jam_active": jam_active,
            "active_route": normal,
            "abandoned_route": None,
            "congestion_points": [],
            "congestion_segments": [],
            "message": (
                "Lalu lintas normal. Truk mengikuti rute terpendek ke TPA Bantargebang."
                if not jam_active else
                "Kemacetan terdeteksi di luar koridor aktif truk. Rute tidak diubah."
            ),
        }

    diverted = _route(jam_edges)
    jam_points = []
    jam_segments = []
    for u, v in jam_edges:
        jam_points.append({
            "lat": round((NODES[u][0] + NODES[v][0]) / 2, 6),
            "lng": round((NODES[u][1] + NODES[v][1]) / 2, 6),
            "label": f"Macet total: {NODES[u][2]} -> {NODES[v][2]}",
        })
        geom, dist_km, _dur, _osrm = _osrm_edge(NODES[u][0], NODES[u][1], NODES[v][0], NODES[v][1])
        jam_segments.append({
            "name": f"{NODES[u][2]} -> {NODES[v][2]}",
            "coordinates": [{"lat": round(la, 6), "lng": round(ln, 6)} for la, ln in geom],
            "traffic_multiplier": 5.0,
            "source": "SIMULATED CONGESTION",
            "distance_km": dist_km,
        })
    extra_km = round(diverted["distance_km"] - normal["distance_km"], 1)
    return {
        "jam_active": True,
        "active_route": diverted,
        "abandoned_route": normal,
        "congestion_points": jam_points,
        "congestion_segments": jam_segments,
        "message": (
            f"Kemacetan terdeteksi di koridor aktif. A* membelokkan truk "
            f"via {' -> '.join(NODES[n][2] for n in diverted['sequence'][1:-1])}. "
            f"Jarak +{extra_km} km, menghindari gridlock."
        ),
    }


if __name__ == "__main__":
    import json
    print("=== NORMAL ===")
    print(json.dumps(reroute_payload(False)["active_route"]["sequence"], indent=2))
    print("=== JAM ACTIVE ===")
    r = reroute_payload(True)
    print("Active:", r["active_route"]["sequence"])
    print("Abandoned:", r["abandoned_route"]["sequence"])
    print("Msg:", r["message"])
