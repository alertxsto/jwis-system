import unittest

from app.engine import (
    DispatchCenter,
    detect_route_deviation,
    distance_point_to_polyline_m,
    forecast_waste_risk,
    recommend_routes,
)


class RouteDeviationGeometryTests(unittest.TestCase):
    def test_point_on_segment_midpoint_is_near_zero(self):
        # A point exactly on the line between two waypoints is on-route,
        # even though it is far (hundreds of metres) from either waypoint.
        a = (-6.175, 106.820)
        b = (-6.195, 106.840)
        midpoint = (-6.185, 106.830)
        dist = distance_point_to_polyline_m(midpoint, [a, b])
        self.assertLess(dist, 50, f"midpoint wrongly {dist:.0f}m off the segment")

    def test_midpoint_not_flagged_as_deviation(self):
        result = detect_route_deviation(
            assigned_path=[(-6.175, 106.820), (-6.195, 106.840)],
            latest_position=(-6.185, 106.830),
            threshold_meters=500,
        )
        self.assertFalse(result["violated"], "point on route segment must not be a deviation")

    def test_point_truly_off_route_is_flagged(self):
        result = detect_route_deviation(
            assigned_path=[(-6.175, 106.820), (-6.195, 106.840)],
            latest_position=(-6.221, 106.785),
            threshold_meters=500,
        )
        self.assertTrue(result["violated"])
        self.assertGreater(result["distance_meters"], 500)

    def test_alert_exposes_rule_flags_ml_score_and_confidence(self):
        result = detect_route_deviation(
            assigned_path=[(-6.175, 106.820), (-6.195, 106.840)],
            latest_position=(-6.221, 106.785),
            threshold_meters=500,
        )
        self.assertIn("rule_flags", result)
        self.assertIn("ml_score", result)
        self.assertIn("confidence", result)

    def test_gps_noise_within_threshold_is_not_critical(self):
        # ~30m off (GPS jitter) with a tight threshold should stay non-critical.
        result = detect_route_deviation(
            assigned_path=[(-6.175, 106.820), (-6.195, 106.840)],
            latest_position=(-6.1851, 106.8302),
            threshold_meters=500,
        )
        self.assertNotEqual(result["severity"], "critical")


class EngineTests(unittest.TestCase):
    def test_detects_route_deviation_when_latest_position_is_far_from_path(self):
        result = detect_route_deviation(
            assigned_path=[(-6.175, 106.82), (-6.185, 106.83), (-6.195, 106.84)],
            latest_position=(-6.221, 106.785),
            threshold_meters=500,
        )

        self.assertTrue(result["violated"])
        self.assertGreater(result["distance_meters"], 500)
        self.assertEqual(result["severity"], "critical")

    def test_recommends_lowest_risk_route_first(self):
        routes = recommend_routes(
            [
                {
                    "name": "Route A",
                    "eta_minutes": 62,
                    "traffic_level": 0.7,
                    "flood_risk": 0.2,
                    "permit_compliant": True,
                },
                {
                    "name": "Route B",
                    "eta_minutes": 48,
                    "traffic_level": 0.35,
                    "flood_risk": 0.05,
                    "permit_compliant": True,
                },
                {
                    "name": "Route C",
                    "eta_minutes": 38,
                    "traffic_level": 0.1,
                    "flood_risk": 0.0,
                    "permit_compliant": False,
                },
            ]
        )

        self.assertEqual(routes[0]["name"], "Route B")
        self.assertNotIn("Route C", [route["name"] for route in routes])
        self.assertIn("recommended because", routes[0]["reason"])

    def test_forecast_waste_risk_explains_event_weather_and_weekend_drivers(self):
        risk = forecast_waste_risk(
            baseline_tons=1200,
            rainfall_mm=42,
            expected_attendance=85000,
            is_weekend=True,
        )

        self.assertGreaterEqual(risk["spike_percent"], 30)
        self.assertEqual(risk["risk_level"], "critical")
        self.assertIn("heavy rainfall", risk["factors"][0].lower())
        self.assertGreater(risk["recommended_extra_trucks"], 0)

    def test_dispatch_lifecycle_records_manager_instruction_and_field_confirmation(self):
        center = DispatchCenter()

        dispatch = center.create_dispatch(
            truck_code="T-047",
            instruction="Use Route B via Jl. Daan Mogot and avoid flooded segment.",
            manager_id="DLH-OPS-01",
        )
        center.confirm(dispatch["id"], status="SIAP", note="Route accepted")

        stored = center.pending_for_truck("T-047")
        audit = center.audit_log()

        self.assertEqual(stored, [])
        self.assertEqual(audit[0]["field_status"], "SIAP")
        self.assertEqual(audit[0]["confirmed_note"], "Route accepted")


if __name__ == "__main__":
    unittest.main()
