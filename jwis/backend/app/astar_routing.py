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


@lru_cache(maxsize=64)
def edge_geometry(u: str, v: str) -> tuple[tuple, ...]:
    """Road-following geometry for one edge via OSRM (cached).

    Returns a tuple of {lat,lng}-like tuples. Falls back to the straight-line
    endpoints (labeled by the caller) when OSRM is unreachable.
    """
    a = (NODES[u][0], NODES[u][1])
    b = (NODES[v][0], NODES[v][1])
    route = fetch_osrm_route(f"{u}-{v}", a, b, timeout_seconds=6.0)
    if route.get("source") == "osrm" and route.get("path"):
        return tuple((p["lat"], p["lng"]) for p in route["path"])
    return ((a[0], a[1]), (b[0], b[1]))


def build_path_from_sequence(node_sequence) -> tuple[list[dict], str]:
    """Concatenate OSRM edge geometry across the node sequence.

    Returns (path, geometry_source) where geometry_source is "osrm" if every
    edge resolved through OSRM, else "fallback-straight-line".
    """
    path: list[dict] = []
    source = "osrm"
    for i in range(len(node_sequence) - 1):
        u, v = node_sequence[i], node_sequence[i + 1]
        geom = edge_geometry(u, v)
        if len(geom) <= 2:
            source = "fallback-straight-line"
        for lat, lng in geom:
            point = {"lat": round(lat, 6), "lng": round(lng, 6)}
            if not path or path[-1] != point:
                path.append(point)
    return path, source


def find_astar_route(start="ORIGIN", goal="TPA_BANTARGEBANG",
                     congested_edges=None, blocked_edges=None):
    """A* shortest path with permit gating, traffic weighting, and OSRM geometry.

    - blocked_edges (permit): never traversed.
    - congested_edges: x5 traffic penalty on the optimization cost.
    Returns separated fields: optimization_cost (weighted), physical_distance_km
    (raw sum), eta_minutes (from distance at truck speed), plus OSRM path geometry.
    """
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
        return haversine_distance(
            (NODES[node][0], NODES[node][1]),
            (NODES[goal][0], NODES[goal][1]),
        )

    adj = {n: [] for n in NODES}
    for u, v, d in EDGES:
        adj[u].append((v, d))
        adj[v].append((u, d))

    pq = [(heuristic(start), 0.0, 0.0, start, [start])]
    visited = {}

    while pq:
        f, cost, dist_km, u, path = heapq.heappop(pq)

        if u == goal:
            detailed, geom_source = build_path_from_sequence(path)
            return {
                "success": True,
                "sequence": path,
                "sequence_labels": [NODES[n][2] for n in path],
                "path": detailed,
                "geometry_source": geom_source,
                "optimization_cost": round(cost, 2),
                "physical_distance_km": round(dist_km, 1),
                "distance_km": round(dist_km, 1),
                "eta_minutes": max(15, round((dist_km / 45) * 60)),
                "is_diverted": len(congested_edges) > 0,
            }

        if u in visited and visited[u] <= cost:
            continue
        visited[u] = cost

        for v, dist in adj[u]:
            if (u, v) in blocked_set or not _edge_meta(u, v)["permit_allowed"]:
                continue
            multiplier = 5.0 if (u, v) in congested_set else 1.0
            cost_new = cost + dist * multiplier
            dist_new = dist_km + dist
            f_new = cost_new + heuristic(v)
            if v not in visited or visited[v] > cost_new:
                heapq.heappush(pq, (f_new, cost_new, dist_new, v, path + [v]))

    return {"success": False, "message": "No route found."}


# Default congestion scenario for the demo: the Cawang -> Bekasi Barat inner-city
# toll segment is gridlocked, forcing a divert via the Ancol coastal toll.
DEMO_CONGESTED_EDGES = [("CAWANG", "BEKASI_BARAT")]


def nearest_node(lat: float, lng: float, exclude=("TPA_BANTARGEBANG",)) -> str:
    """Snap a GPS coordinate to the closest network node (origin anchoring)."""
    best, best_d = None, float("inf")
    for name, (nlat, nlng, _label) in NODES.items():
        if name in exclude:
            continue
        d = haversine_distance((lat, lng), (nlat, nlng))
        if d < best_d:
            best, best_d = name, d
    return best


def route_from_truck(position: dict, goal="TPA_BANTARGEBANG", **kwargs) -> dict:
    """Route anchored to a truck's real GPS: inject the position as ORIGIN so the
    rendered path starts within 50m of the marker, then A* to the goal."""
    lat, lng = position["lat"], position["lng"]
    snap = nearest_node(lat, lng)
    NODES["ORIGIN"] = (lat, lng, "Posisi Truk (GPS)")
    if ("ORIGIN", snap, 0.0) not in EDGES and snap != "ORIGIN":
        d = haversine_distance((lat, lng), (NODES[snap][0], NODES[snap][1]))
        adj_edge = ("ORIGIN", snap, round(d, 2))
        if adj_edge not in EDGES:
            EDGES.append(adj_edge)
    edge_geometry.cache_clear()
    return find_astar_route(start="ORIGIN", goal=goal, **kwargs)


def reroute_payload(jam_active: bool, congested_edges=None):
    """Return normal and (if a jam actually hits the active route) diverted route.

    A jam on an edge NOT on the active route does not trigger a diversion — a
    truck is not rerouted for congestion it never touches.
    """
    jam_edges = congested_edges if congested_edges is not None else DEMO_CONGESTED_EDGES
    normal = find_astar_route(congested_edges=[])
    normal_edges = set(zip(normal["sequence"], normal["sequence"][1:]))
    normal_edges |= {(v, u) for (u, v) in normal_edges}

    hits_route = any((u, v) in normal_edges for (u, v) in jam_edges)
    if not jam_active or not hits_route:
        return {
            "jam_active": jam_active,
            "active_route": normal,
            "abandoned_route": None,
            "congestion_points": [],
            "message": (
                "Lalu lintas normal. Truk mengikuti rute terpendek ke TPA Bantargebang."
                if not jam_active else
                "Kemacetan terdeteksi di luar koridor aktif truk. Rute tidak diubah."
            ),
        }

    diverted = find_astar_route(congested_edges=jam_edges)
    jam_points = []
    for u, v in jam_edges:
        jam_points.append({
            "lat": round((NODES[u][0] + NODES[v][0]) / 2, 6),
            "lng": round((NODES[u][1] + NODES[v][1]) / 2, 6),
            "label": f"Macet total: {NODES[u][2]} -> {NODES[v][2]}",
        })
    extra_km = round(diverted["distance_km"] - normal["distance_km"], 1)
    return {
        "jam_active": True,
        "active_route": diverted,
        "abandoned_route": normal,
        "congestion_points": jam_points,
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
