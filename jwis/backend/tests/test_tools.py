import unittest
from unittest.mock import MagicMock, patch

from app.tools import TOOL_SCHEMAS, ToolContext, execute_tool, run_tools_pass, sanitize_json_payload


def _ctx():
    return ToolContext(
        dispatch_center=MagicMock(audit_log=lambda: []),
        history_store=MagicMock(),
    )


class ToolRegistryTests(unittest.TestCase):
    def test_14_schemas_declared(self):
        self.assertEqual(len(TOOL_SCHEMAS), 14)
        names = {s["function"]["name"] for s in TOOL_SCHEMAS}
        expected = {
            "get_command_center_snapshot", "get_fleet_status", "get_fleet_history",
            "get_truck_breadcrumbs", "get_route_options", "simulate_astar_reroute",
            "get_predictions", "get_ml_model_info", "get_tpa_queue",
            "simulate_staggered_dispatch", "get_weather", "get_events",
            "get_whatsapp_status", "get_data_provenance",
        }
        self.assertEqual(names, expected)

    def test_execute_snapshot_tool(self):
        result = execute_tool("get_command_center_snapshot", {}, _ctx())
        self.assertIn("kpis", result)
        self.assertIn("critical_predictions", result)

    def test_execute_fleet_status_tool(self):
        result = execute_tool("get_fleet_status", {"truck_code": "T-047"}, _ctx())
        self.assertIsInstance(result, dict)
        self.assertIn("problem_trucks", result)
        self.assertTrue(any(t["truck_code"] == "T-047" for t in result["trucks"]))

    def test_execute_truck_breadcrumbs(self):
        result = execute_tool("get_truck_breadcrumbs", {"truck_code": "T-047"}, _ctx())
        self.assertIn("breadcrumbs", result)

    def test_execute_tpa_queue(self):
        result = execute_tool("get_tpa_queue", {}, _ctx())
        self.assertIn("status_label", result)

    def test_execute_weather(self):
        result = execute_tool("get_weather", {}, _ctx())
        self.assertIsInstance(result, dict)

    def test_execute_events(self):
        result = execute_tool("get_events", {}, _ctx())
        self.assertIsInstance(result, list)
        self.assertGreaterEqual(len(result), 1)

    def test_execute_unknown_tool_raises_keyerror(self):
        with self.assertRaises(KeyError):
            execute_tool("no_such_tool", {}, _ctx())

    def test_oversized_tool_output_is_valid_error_json_not_partial_data(self):
        import json
        result = json.loads(sanitize_json_payload({"x": "y" * 10000}))
        self.assertIn("error", result)
        self.assertNotIn("x", result)

    def test_astar_assistant_tool_does_not_mutate_simulation(self):
        schema = next(s for s in TOOL_SCHEMAS if s["function"]["name"] == "simulate_astar_reroute")
        self.assertNotIn("jam_active", schema["function"]["parameters"]["properties"])
        with patch("app.tools.get_dynamic_trucks", return_value=[
            {"truck_code": "T-047", "latest_position": {"lat": -6.1, "lng": 106.8}}
        ]), patch("app.tools.reroute_payload", return_value={"route": "current"}) as route, \
             patch("app.tools.is_traffic_jam_active", return_value=False):
            result = execute_tool("simulate_astar_reroute", {"truck_code": "T-047", "jam_active": True}, _ctx())
        self.assertEqual(result, {"route": "current"})
        self.assertEqual(route.call_args.args[0], False)

    def test_city_forecast_skips_optional_spatial_model(self):
        from app.tools import _predictions_payload
        with patch("app.data.build_predictions", return_value=[{"date": "2026-09-24", "predicted_tons": 100}]), \
             patch("app.real_data.load_kecamatan_map") as map_loader:
            result = _predictions_payload({})
        self.assertEqual(result["predictions_daily_city"][0]["predicted_tons"], 100)
        map_loader.assert_not_called()


if __name__ == "__main__":
    unittest.main()