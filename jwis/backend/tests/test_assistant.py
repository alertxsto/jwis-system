import unittest
from unittest.mock import patch

from app.assistant import answer_operational_question, answer_with_openai_if_configured, build_executive_summary


class AssistantTests(unittest.TestCase):
    def test_answer_operational_question_uses_snapshot_numbers(self):
        snapshot = {
            "kpis": {"active_trucks": 5, "trucks_with_issues": 2, "tpa_wait_minutes": 116},
            "critical_predictions": [{"district": "Jakarta Barat", "spike_percent": 41}],
            "alerts": [{"truck_code": "T-047", "title": "Route deviation"}],
        }

        answer = answer_operational_question("apa masalah terbesar hari ini?", snapshot)

        self.assertIn("Jakarta Barat", answer)
        self.assertIn("T-047", answer)
        self.assertIn("116", answer)

    def test_answer_operational_question_confirms_7_day_tonnage_forecast(self):
        snapshot = {
            "kpis": {"active_trucks": 5, "trucks_with_issues": 2, "tpa_wait_minutes": 116},
            "predictions": [
                {
                    "district": "Jakarta Barat",
                    "date": "2026-07-18",
                    "predicted_tons": 489.4,
                    "spike_percent": 34,
                    "recommended_extra_trucks": 6,
                    "recommended_extra_crews": 3,
                },
                {
                    "district": "Jakarta Utara",
                    "date": "2026-07-18",
                    "predicted_tons": 443.1,
                    "spike_percent": 22,
                    "recommended_extra_trucks": 4,
                    "recommended_extra_crews": 2,
                },
                {
                    "district": "Jakarta Barat",
                    "date": "2026-07-19",
                    "predicted_tons": 501.0,
                    "spike_percent": 41,
                    "recommended_extra_trucks": 7,
                    "recommended_extra_crews": 4,
                },
            ],
            "critical_predictions": [{"district": "Jakarta Barat", "date": "2026-07-19", "predicted_tons": 501.0, "spike_percent": 41}],
            "alerts": [],
        }

        answer = answer_operational_question("bisa prediksi tonase sampah 7 hari kedepan?", snapshot)

        self.assertIn("Yes", answer)
        self.assertIn("7 days", answer)
        self.assertIn("2026-07-18", answer)
        self.assertIn("932.5", answer)
        self.assertIn("501.0", answer)

    def test_answer_operational_question_uses_rag_for_general_jwis_questions(self):
        snapshot = {
            "kpis": {"active_trucks": 5, "trucks_with_issues": 2, "tpa_wait_minutes": 116},
            "critical_predictions": [{"district": "Jakarta Barat", "spike_percent": 41}],
            "alerts": [{"truck_code": "T-047", "title": "Route deviation"}],
        }

        answer = answer_operational_question("Apa saja fitur JWIS dan cara kerjanya?", snapshot)

        self.assertIn("JWIS RAG", answer)
        self.assertIn("Waste", answer)
        self.assertIn("TPA Bantargebang", answer)
        self.assertIn("T-047", answer)

    def test_answer_with_openai_bypasses_model_for_jwis_forecast_facts(self):
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

        with patch.dict("os.environ", {"OPENAI_API_KEY": "fake-key"}):
            result = answer_with_openai_if_configured("perkiraan total tonase sampah dki 7 hari kedepan", snapshot)

        self.assertEqual(result["provider"], "jwis-rag-local")
        self.assertIn("6,556.6", result["answer"])
        self.assertNotIn("tidak punya data forecast", result["answer"].lower())

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
