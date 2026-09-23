import unittest
from unittest.mock import patch

from app.assistant import answer_with_openai_if_configured, build_executive_summary


class AssistantTests(unittest.TestCase):
    def test_answer_falls_back_to_local_responder_without_api_key(self):
        snapshot = {"kpis": {"active_trucks": 0, "trucks_with_issues": 0, "tpa_wait_minutes": 10}, "alerts": [], "predictions": [], "critical_predictions": []}

        with patch.dict("os.environ", {}, clear=True):
            result = answer_with_openai_if_configured("berapa truk?", snapshot, tool_ctx=None)

        # No key → labelled local responder, not a 502 (issue #9).
        self.assertEqual(result["provider"], "local")
        self.assertEqual(result["mode"], "local")
        self.assertIn("Mode lokal", result["answer"])

    def test_answer_with_openai_reports_gateway_failure(self):
        snapshot = {
            "kpis": {"active_trucks": 5, "trucks_with_issues": 2, "tpa_wait_minutes": 116},
            "predictions": [
                {"district": "Jakarta Barat", "date": "2026-07-18", "predicted_tons": 2202.2, "spike_percent": -1},
                {"district": "Jakarta Utara", "date": "2026-07-18", "predicted_tons": 1844.4, "spike_percent": -2},
                {"district": "Jakarta Timur", "date": "2026-07-18", "predicted_tons": 2510.0, "spike_percent": 0},
            ],
            "critical_predictions": [],
            "alerts": [],
        }

        called = {}

        def fake_urlopen(request, timeout=0):
            called["url"] = str(request.full_url)
            from urllib.error import URLError
            raise URLError("offline test")

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}):
            with patch("app.assistant.urlopen", side_effect=fake_urlopen):
                result = answer_with_openai_if_configured("perkiraan total tonase sampah dki 7 hari kedepan", snapshot)

        self.assertIn("/chat/completions", called["url"])
        self.assertEqual(result["provider"], "error")
        self.assertEqual(result["answer"], "")

    def test_answer_with_openai_accepts_history(self):
        snapshot = {"kpis": {"active_trucks": 0, "trucks_with_issues": 0, "tpa_wait_minutes": 10}, "alerts": [], "predictions": [], "critical_predictions": []}
        sent_messages = {}

        def fake_urlopen(request, timeout=0):
            import json as _json
            payload = _json.loads(request.data.decode("utf-8"))
            sent_messages["count"] = len(payload["messages"])
            sent_messages["roles"] = [m["role"] for m in payload["messages"]]
            body = _json.dumps({"choices": [{"message": {"role": "assistant", "content": "oi"}}]}).encode()
            from unittest.mock import MagicMock
            mock = MagicMock()
            mock.read.return_value = body
            mock.__enter__.return_value = mock
            return mock

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}):
            with patch("app.assistant.urlopen", side_effect=fake_urlopen):
                result = answer_with_openai_if_configured("terus?", snapshot, history=[{"role": "user", "content": "berapa truk?"}])

        self.assertEqual(result["provider"], "openai")
        self.assertEqual(sent_messages["count"], 3)
        self.assertEqual(sent_messages["roles"][:2], ["system", "user"])

    def test_history_sanitized_to_user_assistant_roles(self):
        from app.assistant import _sanitize_history
        history = [
            {"role": "system", "content": "hack"},
            {"role": "user", "content": "a" * 5000},
            {"role": "assistant", "content": ""},
            {"role": "tool", "content": "t"},
        ]
        clean = _sanitize_history(history)
        self.assertTrue(all(m["role"] in {"user", "assistant"} for m in clean))
        self.assertLessEqual(len(clean[0]["content"]), 2000)

    def test_tool_calls_are_bounded_to_one_round_and_two_execution_slots(self):
        snapshot = {}
        calls = []
        executed = []

        def fake_urlopen(request, timeout=0):
            import json
            from unittest.mock import MagicMock
            payload = json.loads(request.data)
            calls.append(payload)
            if len(calls) == 1:
                content = {
                    "choices": [{"message": {
                        "role": "assistant", "content": None,
                        "tool_calls": [
                            {"id": f"call-{i}", "type": "function", "function": {
                                "name": "get_tpa_queue", "arguments": "{}",
                            }} for i in range(3)
                        ],
                    }}],
                }
            else:
                self.assertNotIn("tools", payload)
                self.assertEqual(len([m for m in payload["messages"] if m["role"] == "tool"]), 3)
                self.assertIn("limit", payload["messages"][-1]["content"])
                content = {"choices": [{"message": {"role": "assistant", "content": "Antrean TPA padat."}}]}
            mock = MagicMock()
            mock.read.return_value = json.dumps(content).encode()
            mock.__enter__.return_value = mock
            return mock

        def fake_execute(name, args, ctx):
            executed.append(name)
            return {"status_label": "padat"}

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}), \
             patch("app.assistant.urlopen", side_effect=fake_urlopen), \
             patch("app.tools.execute_tool", side_effect=fake_execute):
            from app.tools import ToolContext
            result = answer_with_openai_if_configured(
                "berapa antrean TPA?", snapshot,
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        self.assertEqual(result["answer"], "Antrean TPA padat.")
        self.assertEqual(len(calls), 2)
        self.assertEqual(len(executed), 1, "duplicate tool calls should not execute twice")
        self.assertEqual(calls[0]["messages"][-1]["content"], "berapa antrean TPA?")
        self.assertNotIn("prediksi", calls[0]["messages"][-1]["content"].lower())

    def test_local_fallback_uses_matching_fleet_tool_only(self):
        from app.tools import ToolContext
        data = {"total_trucks": 8, "problem_count": 2}
        with patch.dict("os.environ", {}, clear=True), \
             patch("app.assistant.execute_tool", return_value=data) as tool:
            result = answer_with_openai_if_configured(
                "berapa truk bermasalah?", {},
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        tool.assert_called_once()
        self.assertEqual(tool.call_args.args[0], "get_fleet_status")
        self.assertIn("2", result["answer"])
        self.assertNotIn("prediksi", result["answer"].lower())
        self.assertEqual(result["tools_used"], ["get_fleet_status"])

    def test_local_fleet_counts_keep_damage_and_deviation_separate(self):
        from app.tools import ToolContext
        fleet = {
            "total_trucks": 8, "active_count": 6, "problem_count": 3,
            "damaged_count": 2, "deviation_count": 1,
            "problem_trucks": [
                {"truck_code": "T-001", "is_damaged": True, "deviation_violated": False},
                {"truck_code": "T-002", "is_damaged": True, "deviation_violated": False},
                {"truck_code": "T-003", "is_damaged": False, "deviation_violated": True},
            ],
        }
        with patch.dict("os.environ", {}, clear=True), \
             patch("app.assistant.execute_tool", return_value=fleet):
            result = answer_with_openai_if_configured(
                "berapa truk yang mengalami deviasi rute?", {},
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        self.assertIn("1 truk mengalami deviasi rute", result["answer"])
        self.assertNotIn("3 truk", result["answer"])

    def test_local_fallback_does_not_invent_metrics_when_tool_fails(self):
        from app.tools import ToolContext
        with patch.dict("os.environ", {}, clear=True), \
             patch("app.assistant.execute_tool", return_value={"error": "offline"}):
            result = answer_with_openai_if_configured(
                "berapa truk?", {},
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        self.assertIn("belum tersedia", result["answer"])
        self.assertEqual(result["tools_used"], [])

    def test_photo_goes_to_gateway_without_unrelated_snapshot(self):
        import json
        from unittest.mock import MagicMock
        sent = {}

        def fake_urlopen(request, timeout=0):
            sent["payload"] = json.loads(request.data)
            sent["timeout"] = timeout
            response = MagicMock()
            response.read.return_value = b'{"choices":[{"message":{"content":"Foto memperlihatkan truk."}}]}'
            response.__enter__.return_value = response
            return response

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}), \
             patch("app.assistant.urlopen", side_effect=fake_urlopen):
            result = answer_with_openai_if_configured(
                "apa ini?", {}, images=["data:image/jpeg;base64,YQ=="],
            )
        self.assertEqual(result["provider"], "openai")
        self.assertEqual(sent["payload"]["messages"][-1]["content"][1]["type"], "image_url")
        self.assertNotIn("prediksi", sent["payload"]["messages"][-1]["content"][0]["text"].lower())
        self.assertGreater(sent["timeout"], 18)

    def test_gateway_timeout_returns_error_without_fabricated_answer(self):
        observed = {}

        def timeout(request, timeout=0):
            observed["seconds"] = timeout
            raise TimeoutError("gateway timed out")

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}), \
             patch("app.assistant.urlopen", side_effect=timeout):
            result = answer_with_openai_if_configured("berapa antrean TPA?", {}, tool_ctx=None)
        self.assertEqual(observed["seconds"], 18)
        self.assertEqual(result["provider"], "error")
        self.assertEqual(result["answer"], "")

    def test_local_photo_does_not_claim_to_interpret_image(self):
        with patch.dict("os.environ", {}, clear=True):
            result = answer_with_openai_if_configured("apa ini?", {}, images=["data:image/jpeg;base64,YQ=="])
        self.assertIn("memerlukan layanan AI", result["answer"])
        self.assertEqual(result["tools_used"], [])

    def test_live_data_question_without_matching_tool_does_not_relay_model_numbers(self):
        from unittest.mock import MagicMock
        response = MagicMock()
        response.read.return_value = b'{"choices":[{"message":{"content":"Ada 999 truk."}}]}'
        response.__enter__.return_value = response
        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}), \
             patch("app.assistant.urlopen", return_value=response):
            from app.tools import ToolContext
            result = answer_with_openai_if_configured(
                "berapa truk saat ini?", {},
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        self.assertNotIn("999", result["answer"])
        self.assertIn("belum dapat memverifikasi", result["answer"])
        self.assertEqual(result["tools_used"], [])

    def test_fleet_deviation_requires_fleet_status_not_general_snapshot(self):
        import json
        from unittest.mock import MagicMock
        from app.tools import ToolContext

        first = MagicMock()
        first.read.return_value = json.dumps({"choices": [{"message": {
            "role": "assistant", "content": None,
            "tool_calls": [{"id": "call-1", "type": "function",
                            "function": {"name": "get_command_center_snapshot",
                                         "arguments": "{}"}}],
        }}]}).encode()
        first.__enter__.return_value = first
        second = MagicMock()
        second.read.return_value = b'{"choices":[{"message":{"content":"3 truk deviasi rute."}}]}'
        second.__enter__.return_value = second
        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}), \
             patch("app.assistant.urlopen", side_effect=[first, second]), \
             patch("app.tools.execute_tool", return_value={"kpis": {"trucks_with_issues": 3}}):
            result = answer_with_openai_if_configured(
                "berapa truk mengalami deviasi rute?", {},
                tool_ctx=ToolContext(dispatch_center=None, history_store=None),
            )
        self.assertNotIn("3 truk deviasi", result["answer"])
        self.assertIn("belum dapat memverifikasi", result["answer"])

    def test_build_executive_summary_is_concise_and_actionable(self):
        snapshot = {
            "kpis": {"active_trucks": 5, "trucks_with_issues": 2, "tpa_wait_minutes": 116},
            "critical_predictions": [{"district": "Jakarta Barat", "spike_percent": 41, "recommended_extra_trucks": 29}],
            "alerts": [{"truck_code": "T-047", "title": "Route deviation"}],
        }

        summary = build_executive_summary(snapshot)

        self.assertLessEqual(len(summary.split()), 150)
        self.assertIn("29", summary)
        self.assertIn("T-047", summary)


if __name__ == "__main__":
    unittest.main()
