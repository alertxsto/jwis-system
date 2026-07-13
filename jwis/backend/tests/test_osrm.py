import unittest

from app.osrm import build_osrm_url, fallback_route, parse_osrm_route


class OsrmTests(unittest.TestCase):
    def test_build_osrm_url_uses_lon_lat_order(self):
        url = build_osrm_url(origin=(-6.221, 106.785), destination=(-6.195, 106.802))

        self.assertIn("106.785,-6.221;106.802,-6.195", url)
        self.assertIn("geometries=geojson", url)

    def test_parse_osrm_route_returns_eta_distance_and_geometry(self):
        payload = {
            "routes": [
                {
                    "duration": 2880,
                    "distance": 18200,
                    "geometry": {"type": "LineString", "coordinates": [[106.785, -6.221], [106.802, -6.195]]},
                }
            ]
        }

        route = parse_osrm_route("Route B", payload)

        self.assertEqual(route["eta_minutes"], 48)
        self.assertEqual(route["distance_km"], 18.2)
        self.assertEqual(route["path"][0], {"lng": 106.785, "lat": -6.221})

    def test_fallback_route_is_demo_safe(self):
        route = fallback_route("Route B", (-6.221, 106.785), (-6.195, 106.802))

        self.assertEqual(route["source"], "fallback")
        self.assertGreater(route["eta_minutes"], 0)
        self.assertEqual(len(route["path"]), 3)

    def test_live_osrm_route_is_road_following_or_skips(self):
        from app.osrm import fetch_osrm_route
        try:
            route = fetch_osrm_route("live", (-6.221, 106.785), (-6.195, 106.802), timeout_seconds=8.0)
        except Exception:
            self.skipTest("OSRM unreachable")
        if route["source"] != "osrm":
            self.skipTest("OSRM returned fallback (network)")
        self.assertGreater(len(route["path"]), 50,
                           "road-following OSRM route should have many points, not a straight line")

    def test_snap_to_road_returns_raw_and_snapped(self):
        from app.osrm import snap_to_road
        r = snap_to_road(-6.221, 106.785)
        self.assertIn("raw", r)
        self.assertIn("snapped", r)
        self.assertIn("source", r)
        self.assertEqual(r["raw"], {"lat": -6.221, "lng": 106.785})
        if r["source"] == "SNAPPED_OSRM":
            from app.osrm import _haversine_km
            d = _haversine_km((-6.221, 106.785), (r["snapped"]["lat"], r["snapped"]["lng"])) * 1000
            self.assertLess(d, 200)

    def test_road_route_multi_waypoint_is_road_following(self):
        from app.osrm import road_route
        r = road_route([(-6.221, 106.785), (-6.195, 106.802)])
        self.assertIn("geometry", r)
        self.assertIn("source", r)
        if r["source"] == "LIVE_EXTERNAL":
            self.assertGreater(len(r["geometry"]), 20)
        else:
            self.assertEqual(r["source"], "FALLBACK_DEGRADED")


if __name__ == "__main__":
    unittest.main()
