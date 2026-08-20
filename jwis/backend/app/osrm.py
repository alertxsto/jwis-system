from __future__ import annotations

import json
from functools import lru_cache
from math import asin, cos, radians, sin, sqrt
from typing import Any
from urllib.request import Request, urlopen


OSRM_BASE_URL = "https://router.project-osrm.org"


def build_osrm_url(origin: tuple[float, float], destination: tuple[float, float]) -> str:
    origin_lat, origin_lng = origin
    dest_lat, dest_lng = destination
    return (
        f"{OSRM_BASE_URL}/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}"
        "?overview=full&geometries=geojson&alternatives=true&steps=false"
    )


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = a
    lat2, lon2 = b
    radius = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    h = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(h))


def parse_osrm_route(name: str, payload: dict[str, Any], index: int = 0) -> dict[str, Any]:
    route = payload["routes"][index]
    coordinates = route["geometry"]["coordinates"]
    return {
        "name": name,
        "source": "osrm",
        "eta_minutes": round(route["duration"] / 60),
        "distance_km": round(route["distance"] / 1000, 1),
        "path": [{"lng": lng, "lat": lat} for lng, lat in coordinates],
        "reason": "computed by OSRM public routing with full route geometry",
    }


def fallback_route(name: str, origin: tuple[float, float], destination: tuple[float, float]) -> dict[str, Any]:
    origin_lat, origin_lng = origin
    dest_lat, dest_lng = destination
    mid = {
        "lat": round((origin_lat + dest_lat) / 2 + 0.006, 6),
        "lng": round((origin_lng + dest_lng) / 2 + 0.01, 6),
    }
    distance_km = _haversine_km(origin, destination) * 1.35
    return {
        "name": name,
        "source": "fallback",
        "eta_minutes": max(8, round(distance_km / 22 * 60)),
        "distance_km": round(distance_km, 1),
        "path": [
            {"lat": origin_lat, "lng": origin_lng},
            mid,
            {"lat": dest_lat, "lng": dest_lng},
        ],
        "reason": "fallback route used when OSRM public service is unavailable",
    }


def snap_to_road(lat: float, lng: float, timeout_seconds: float = 2.5) -> dict[str, Any]:
    """Snap a raw GPS point to the nearest road via OSRM /nearest.

    Cached by coordinate. Returns raw + snapped coordinates and provenance;
    falls back to the raw point (RAW_GPS_UNSNAPPED) when OSRM is unreachable.
    """
    return {**_snap_cached(round(lat, 6), round(lng, 6), timeout_seconds)}


@lru_cache(maxsize=256)
def _snap_cached(lat: float, lng: float, timeout_seconds: float) -> dict[str, Any]:
    url = f"{OSRM_BASE_URL}/nearest/v1/driving/{lng},{lat}?number=1"
    raw = {"lat": lat, "lng": lng}
    try:
        request = Request(url, headers={"User-Agent": "JWIS-Competition-Prototype/1.0"})
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("code") == "Ok" and payload.get("waypoints"):
            loc = payload["waypoints"][0]["location"]
            return {"raw": raw, "snapped": {"lat": loc[1], "lng": loc[0]}, "source": "SNAPPED_OSRM"}
    except Exception:
        pass
    return {"raw": raw, "snapped": raw, "source": "RAW_GPS_UNSNAPPED"}


def road_route(coords: list[tuple[float, float]], timeout_seconds: float = 2.5) -> dict[str, Any]:
    """Road-following geometry through ordered (lat,lng) waypoints via OSRM /route.

    Cached by coordinate tuple so repeat/warm calls are instant. Returns geometry
    [{lat,lng}], distance_km, duration_min, and provenance (LIVE_EXTERNAL or
    FALLBACK_DEGRADED straight line).
    """
    key = tuple((round(la, 6), round(ln, 6)) for la, ln in coords)
    result = _road_route_cached(key, timeout_seconds)
    return {**result, "geometry": [dict(p) for p in result["geometry"]]}


@lru_cache(maxsize=256)
def _road_route_cached(coords: tuple, timeout_seconds: float) -> dict[str, Any]:
    if len(coords) < 2:
        return {"geometry": tuple({"lat": c[0], "lng": c[1]} for c in coords),
                "distance_km": 0.0, "duration_min": 0.0, "source": "FALLBACK_DEGRADED"}
    pts = ";".join(f"{lng},{lat}" for lat, lng in coords)
    url = f"{OSRM_BASE_URL}/route/v1/driving/{pts}?overview=full&geometries=geojson&steps=false"
    try:
        request = Request(url, headers={"User-Agent": "JWIS-Competition-Prototype/1.0"})
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("code") == "Ok" and payload.get("routes"):
            route = payload["routes"][0]
            geom = tuple({"lat": la, "lng": ln} for ln, la in route["geometry"]["coordinates"])
            return {"geometry": geom, "distance_km": round(route["distance"] / 1000, 1),
                    "duration_min": round(route["duration"] / 60), "source": "LIVE_EXTERNAL"}
    except Exception:
        pass
    km = sum(_haversine_km(coords[i], coords[i + 1]) for i in range(len(coords) - 1))
    return {"geometry": tuple({"lat": c[0], "lng": c[1]} for c in coords),
            "distance_km": round(km, 1), "duration_min": round(km / 45 * 60),
            "source": "FALLBACK_DEGRADED"}


def fetch_osrm_route(
    name: str,
    origin: tuple[float, float],
    destination: tuple[float, float],
    timeout_seconds: float = 2.0,
) -> dict[str, Any]:
    url = build_osrm_url(origin, destination)
    try:
        request = Request(url, headers={"User-Agent": "JWIS-Competition-Prototype/1.0"})
        with urlopen(request, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if payload.get("code") != "Ok" or not payload.get("routes"):
            raise ValueError(payload.get("message", "OSRM returned no route"))
        result = parse_osrm_route(name, payload)
        return {**result, "url": url}
    except Exception as error:
        return {**fallback_route(name, origin, destination), "url": url, "error": str(error)}
