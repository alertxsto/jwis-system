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

TRAFFIC_JAM_ACTIVE = False

def is_traffic_jam_active() -> bool:
    global TRAFFIC_JAM_ACTIVE
    return TRAFFIC_JAM_ACTIVE

def set_traffic_jam_active(active: bool) -> None:
    global TRAFFIC_JAM_ACTIVE
    TRAFFIC_JAM_ACTIVE = active

# Simplified Jakarta -> Bantargebang road network for real-time truck logistics.
# Each node is an actual intersection / checkpoint (lat, lng, label).
NODES = {
    "ORIGIN": (-6.1649, 106.7415, "Posisi Truk T-047 (Daan Mogot, Jakarta Barat)"),
    "KEBON_JERUK": (-6.181, 106.764, "Simpang Susun Kebon Jeruk"),
    "SLIPI": (-6.198, 106.797, "Flyover Slipi"),
    "TOMANG": (-6.179, 106.788, "Gerbang Tol Tomang"),
    "SEMANGGI": (-6.219, 106.812, "Simpang Susun Semanggi"),
    "ANCOL": (-6.126, 106.843, "Tol Ancol Pelabuhan"),
    "CAWANG": (-6.2468, 106.8771, "Simpang Susun Cawang / Tol Dalam Kota"),
    "BEKASI_BARAT": (-6.241, 106.994, "Gerbang Tol Bekasi Barat"),
    "BEKASI_TIMUR": (-6.258, 107.017, "Gerbang Tol Bekasi Timur"),
    "TPA_BANTARGEBANG": (-6.331, 106.991, "Jembatan Timbang TPA Bantargebang"),
    # JORR southern corridor (real truck bypass when the inner toll is jammed)
    "GROGOL": (-6.1668, 106.7887, "Simpang Grogol (Jl. S. Parman)"),
    "KEMBANGAN": (-6.1878, 106.7358, "Gerbang Tol Kembangan (JORR W2)"),
    "JOGLO": (-6.2167, 106.7467, "Gerbang Tol Joglo (JORR W2)"),
    "CILEDUG": (-6.2367, 106.7475, "Gerbang Tol Ciledug (JORR W2)"),
    "PONDOK_INDAH": (-6.2653, 106.7830, "Simpang Pondok Indah (JORR W1)"),
    "CILANDAK": (-6.2893, 106.7976, "Cilandak KKO / TB Simatupang (JORR W1)"),
    "PASAR_MINGGU": (-6.2845, 106.8230, "Gerbang Tol Pasar Minggu (JORR W1)"),
    "LENTENG_AGUNG": (-6.3110, 106.8380, "Gerbang Tol Lenteng Agung (JORR W1)"),
    "KAMPUNG_RAMBUTAN": (-6.3080, 106.8840, "Simpang Kp. Rambutan (JORR x Tol Jagorawi)"),
    "PASAR_REBO": (-6.3230, 106.8570, "Simpang Pasar Rebo (Jl. Raya Bogor)"),
    "CIJANTUNG": (-6.3212, 106.8588, "Cijantung (koridor Jl. Raya Bogor)"),
    "JATIWARNA": (-6.2960, 106.9630, "Gerbang Tol Jatiwarna (JORR E)"),
    "KALIMALANG": (-6.2540, 106.9270, "Pondok Kelapa / Jl. Raya Kalimalang"),
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
    # JORR outer-ring truck corridor (the real heavy-fleet bypass)
    ("GROGOL", "TOMANG", 2.0),
    ("GROGOL", "KEBON_JERUK", 3.5),
    ("KEBON_JERUK", "KEMBANGAN", 4.5),
    ("KEMBANGAN", "JOGLO", 3.5),
    ("JOGLO", "CILEDUG", 3.0),
    ("CILEDUG", "PONDOK_INDAH", 5.0),
    ("PONDOK_INDAH", "CILANDAK", 3.5),
    ("CILANDAK", "PASAR_MINGGU", 3.0),
    ("PASAR_MINGGU", "LENTENG_AGUNG", 3.5),
    ("LENTENG_AGUNG", "KAMPUNG_RAMBUTAN", 5.0),
    ("KAMPUNG_RAMBUTAN", "PASAR_REBO", 4.0),
    ("PASAR_REBO", "CIJANTUNG", 3.0),
    ("CIJANTUNG", "TPA_BANTARGEBANG", 9.0),
    ("KAMPUNG_RAMBUTAN", "JATIWARNA", 8.5),
    ("JATIWARNA", "TPA_BANTARGEBANG", 6.5),
    # Kalimalang arterial (non-toll alternative parallel to the Cikampek toll)
    ("CAWANG", "KALIMALANG", 8.0),
    ("KALIMALANG", "BEKASI_BARAT", 7.5),
]

# Per-edge metadata: permit_allowed gates truck-legal corridors; permit_hours
# (start, end) marks segments where heavy trucks are barred during those hours,
# modeled on DKI truck-hour restrictions on inner-city toll segments. A real
# deployment sources these from DLH/Dishub permit regulations; these are
# documented demo constants and are labeled SIMULATED in every payload.
EDGE_META: dict[tuple[str, str], dict[str, Any]] = {
    ("ANCOL", "CAWANG"): {"permit_allowed": False},  # not a truck-permitted corridor
    ("TOMANG", "SEMANGGI"): {"permit_hours": (5, 22)},  # inner-toll truck window (simulated)
    ("SEMANGGI", "CAWANG"): {"permit_hours": (5, 22)},  # inner-toll truck window (simulated)
}


def _permit_ok(meta: dict[str, Any], permit_hour: int | None) -> bool:
    if not meta.get("permit_allowed", True):
        return False
    window = meta.get("permit_hours")
    if window is None or permit_hour is None:
        return True
    start, end = window
    return not (start <= permit_hour < end)


def _edge_meta(u: str, v: str) -> dict[str, Any]:
    meta = EDGE_META.get((u, v)) or EDGE_META.get((v, u)) or {}
    return {"permit_allowed": True, **meta}


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
    route = fetch_osrm_route("edge", (a_lat, a_lng), (b_lat, b_lng), timeout_seconds=2.5)
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


def _heuristic_minutes(node: str, goal: str, nodes: dict) -> float:
    """Zero heuristic: admissible by construction on this small graph, making A*
    equivalent to Dijkstra and guaranteeing an optimal (never-worse) route.

    A straight-line-km/45 estimate can overestimate true OSRM duration when roads
    are faster than 45 km/h, breaking admissibility (audit found 22/1260 worse
    scenarios). Zero never overestimates.
    """
    return 0.0


def find_astar_route(start="ORIGIN", goal="TPA_BANTARGEBANG",
                     congested_edges=None, blocked_edges=None,
                     nodes=None, edges=None, permit_hour=None):
    """A* shortest path with permit gating, traffic weighting, and OSRM geometry.

    - blocked_edges (permit): never traversed.
    - congested_edges: x5 traffic penalty on the optimization cost.
    - permit_hour: when set (0-23), edges whose simulated truck-restriction
      window covers that hour are treated as not permit-allowed.
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
        return _heuristic_minutes(node, goal, nodes)

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
                "permit_hour": permit_hour,
                "permit_source": "SIMULATED PERMIT CONSTRAINT (not official DLH permit dataset)",
            }

        if u in visited and visited[u] <= cost:
            continue
        visited[u] = cost

        for v in adj[u]:
            if (u, v) in blocked_set or not _permit_ok(_edge_meta(u, v), permit_hour):
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


def find_alternative_routes(start="ORIGIN", goal="TPA_BANTARGEBANG", k=2,
                            congested_edges=None, blocked_edges=None,
                            permit_hour=None) -> list[dict[str, Any]]:
    """Up to k genuinely different computed routes, ranked by ETA.

    Route 1 is the A* optimum. Each next route is found by applying the traffic
    multiplier to the previously returned route's edges (penalty diversification)
    and re-running the search — so alternatives are computed paths with real OSRM
    ETAs, never canned fixtures.
    """
    routes: list[dict[str, Any]] = []
    seen_sequences: set[tuple[str, ...]] = set()
    extra_congested: list[tuple[str, str]] = list(congested_edges or [])
    for rank in range(k):
        r = find_astar_route(start=start, goal=goal,
                             congested_edges=extra_congested,
                             blocked_edges=blocked_edges,
                             permit_hour=permit_hour)
        if not r.get("success"):
            break
        seq = tuple(r["sequence"])
        if seq in seen_sequences:
            break
        seen_sequences.add(seq)
        r["rank"] = rank + 1
        r["diversified"] = rank > 0
        r["is_diverted"] = bool(congested_edges)
        routes.append(r)
        extra_congested.extend(zip(r["sequence"], r["sequence"][1:]))
    return routes


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def _demo_jam_edges_ahead(sequence: list[str]) -> list[tuple[str, str]]:
    """Pick the corridor edge(s) 2-4 km ahead of the route start so the demo jam
    is always in front of the truck (position-relative, deterministic)."""
    if len(sequence) < 3:
        return DEMO_CONGESTED_EDGES
    picked: list[tuple[str, str]] = []
    walked_km = 0.0
    for i in range(len(sequence) - 1):
        if i >= len(sequence) - 2:
            break
        u, v = sequence[i], sequence[i + 1]
        seg_km = _haversine_km((NODES[u][0], NODES[u][1]), (NODES[v][0], NODES[v][1]))
        if walked_km >= 2.0:
            picked.append((u, v))
            if walked_km + seg_km >= 4.0:
                break
        walked_km += seg_km
    return picked or DEMO_CONGESTED_EDGES


def nearest_node(lat: float, lng: float, exclude=("TPA_BANTARGEBANG", "ORIGIN")) -> str:
    """Snap a GPS coordinate to the closest real network node (never ORIGIN itself)."""
    best: str = "KEBON_JERUK"
    best_d = float("inf")
    for name, (nlat, nlng, _label) in NODES.items():
        if name in exclude:
            continue
        d = haversine_distance((lat, lng), (nlat, nlng))
        if d < best_d:
            best, best_d = name, d
    return best


def warm_edge_cache() -> int:
    """Precompute OSRM geometry for every graph edge so the first demo request
    is warm (no cold synchronous OSRM fetch during the live demo)."""
    count = 0
    for u, v, _d in EDGES:
        _osrm_edge(NODES[u][0], NODES[u][1], NODES[v][0], NODES[v][1])
        count += 1
    return count


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
            route = route_from_truck(origin_position, congested_edges=cong)
            path = route.get("path")
            if isinstance(path, list):
                origin_point = {
                    "lat": round(float(origin_position["lat"]), 6),
                    "lng": round(float(origin_position["lng"]), 6),
                }
                if not path or path[0] != origin_point:
                    route["path"] = [origin_point, *path]
            route["origin_position"] = {
                "lat": round(float(origin_position["lat"]), 6),
                "lng": round(float(origin_position["lng"]), 6),
            }
            return route
        return find_astar_route(congested_edges=cong)

    normal = _route([])
    normal_edges = set(zip(normal["sequence"], normal["sequence"][1:]))
    normal_edges |= {(v, u) for (u, v) in normal_edges}

    # Demo mode without explicit edges: jam the corridor 2-4 km AHEAD of the
    # truck so "Simulate Corridor Jam" always produces a visible reroute,
    # wherever the truck currently is on its loop.
    if congested_edges is None and origin_position:
        jam_edges = _demo_jam_edges_ahead(normal["sequence"])

    hits_route = any((u, v) in normal_edges for (u, v) in jam_edges)
    if not jam_active or not hits_route:
        return {
            "jam_active": jam_active,
            "diversion_applied": False,
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
        "diversion_applied": True,
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
