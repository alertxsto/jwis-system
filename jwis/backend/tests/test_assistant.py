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

    def test_answer_with_openai_answers_after_two_tool_rounds(self):
        snapshot = {"kpis": {"active_trucks": 4, "trucks_with_issues": 3, "tpa_wait_minutes": 45}, "alerts": [], "predictions": [], "critical_predictions": []}
        calls = []

        def fake_urlopen(request, timeout=0):
            import json as _json
            payload = _json.loads(request.data.decode("utf-8"))
            calls.append(payload)
            round_no = len(calls)
            if round_no <= 2:
                body = _json.dumps({
                    "choices": [{"message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [{
                            "id": f"call-{round_no}",
                            "type": "function",
                            "function": {"name": "get_command_center_snapshot", "arguments": "{}"},
                        }],
                    }}]
                }).encode()
            else:
                body = _json.dumps({"choices": [{"message": {"role": "assistant", "content": "jawaban final"}}]}).encode()
            from unittest.mock import MagicMock
            mock = MagicMock()
            mock.read.return_value = body
            mock.__enter__.return_value = mock
            return mock

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}):
            with patch("app.assistant.urlopen", side_effect=fake_urlopen):
                from app.tools import ToolContext
                result = answer_with_openai_if_configured(
                    "kenapa status antrean TPA warning?",
                    snapshot,
                    tool_ctx=ToolContext(dispatch_center={}, history_store={}),
                )

        self.assertEqual(result["provider"], "openai")
        self.assertEqual(result["answer"], "jawaban final")
        self.assertEqual(len(calls), 3)
        self.assertNotIn("tools", calls[2], "round final tidak boleh membawa tools")
        self.assertNotIn("tool_choice", calls[2])

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
