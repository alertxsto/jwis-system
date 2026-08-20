import unittest
from unittest.mock import MagicMock

from app.tools import TOOL_SCHEMAS, ToolContext, execute_tool, sanitize_json_payload


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

    def test_sanitize_json_truncates(self):
        out = sanitize_json_payload({"x": "y" * 10000})
        self.assertLessEqual(len(out), 8001)


if __name__ == "__main__":
    unittest.main()