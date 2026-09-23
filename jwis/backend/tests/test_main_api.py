import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


class MainApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        _login = self.client.post("/api/auth/login", json={"username": "administrator", "password": "administrator-demo-pass"})
        self.client.headers.update({"Authorization": f"Bearer {_login.json()['token']}"})

    def test_ml_predict_rejects_invalid_target_date(self):
        response = self.client.post(
            "/api/ml/predict",
            json={"kelurahan": "Tebet", "target_date": "not-a-date"},
        )

        self.assertEqual(response.status_code, 422)

    def test_ml_predict_all_rejects_invalid_target_date(self):
        response = self.client.post("/api/ml/predict-all?target_date=not-a-date")

        self.assertEqual(response.status_code, 422)

    def test_dispatch_confirm_returns_404_for_unknown_dispatch(self):
        response = self.client.post(
            "/api/dispatch/no-such-id/confirm",
            json={"status": "DONE", "note": "unknown id"},
        )

        self.assertEqual(response.status_code, 404)

    def test_predictions_rejects_event_scale_outside_documented_range(self):
        low = self.client.get("/api/predictions?event_scale=-99")
        high = self.client.get("/api/predictions?event_scale=999")

        self.assertEqual(low.status_code, 422)
        self.assertEqual(high.status_code, 422)

    def test_dispatch_rejects_empty_truck_code(self):
        response = self.client.post(
            "/api/dispatch",
            json={"truck_code": "", "instruction": "go"},
        )
        self.assertEqual(response.status_code, 422)

    def test_dispatch_persists_and_confirms(self):
        created = self.client.post(
            "/api/dispatch",
            json={"truck_code": "T-047", "instruction": "Route B", "manager_id": "MGR-1"},
        )
        self.assertEqual(created.status_code, 200)
        did = created.json()["id"]
        pending = self.client.get("/api/dispatch/T-047").json()
        self.assertTrue(any(d["id"] == did for d in pending))
        conf = self.client.post(f"/api/dispatch/{did}/confirm",
                                json={"status": "SIAP", "note": "ok"})
        self.assertEqual(conf.status_code, 200)
        self.assertEqual(conf.json()["field_status"], "SIAP")

    def test_whatsapp_alert_is_honest_when_unconfigured(self):
        response = self.client.post(
            "/api/whatsapp/alert",
            json={"truck_code": "T-047", "issue": "deviation", "recommendation": "reroute"},
        )
        self.assertEqual(response.status_code, 200)
        status = self.client.get("/api/whatsapp/status").json()
        if status.get("connected"):
            # Live gateway: a real send is the honest outcome. Guard the response shape.
            body = response.json()
            for key in ("status", "sent", "message"):
                self.assertIn(key, body)
        else:
            # Without a live gateway, it must NOT claim a real send.
            self.assertFalse(response.json().get("sent", True))

    def test_astar_reroute_rejects_unknown_truck(self):
        response = self.client.get("/api/fleet/astar-reroute?truck_code=NOT-A-TRUCK")
        self.assertEqual(response.status_code, 404)

    def test_astar_reroute_accepts_known_truck(self):
        response = self.client.get("/api/fleet/astar-reroute?truck_code=T-047")
        self.assertEqual(response.status_code, 200)

    def test_route_decision_unifies_all_signals(self):
        r = self.client.get("/api/fleet/route-decision?truck_code=T-047")
        self.assertEqual(r.status_code, 200)
        j = r.json()
        for key in ("truck_code", "eta_minutes", "physical_distance_km",
                    "vehicle_status", "tpa_queue", "traffic", "permit", "recommendation"):
            self.assertIn(key, j)

    def test_assistant_accepts_history_field(self):
        fake_openai = {"provider": "openai", "model": "guts", "answer": "jawaban", "tools_used": []}
        with patch("app.main.answer_with_openai_if_configured", return_value=fake_openai) as answer, \
             patch("app.main.command_center_snapshot", side_effect=AssertionError("eager snapshot")):
            response = self.client.post(
                "/api/assistant/query",
                json={"question": "berapa truk bermasalah?", "history": [{"role": "user", "content": "halo"}, {"role": "assistant", "content": "siap"}]},
            )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("provider", body)
        self.assertEqual(answer.call_args.args[1], {}, "assistant should retrieve only requested data via tools")
        self.assertIn("answer", body)

    def test_assistant_returns_502_when_gateway_error(self):
        fake_error = {"provider": "error", "error": "unreachable", "answer": ""}
        with patch("app.main.answer_with_openai_if_configured", return_value=fake_error):
            response = self.client.post(
                "/api/assistant/query",
                json={"question": "berapa truk bermasalah?"},
            )
        self.assertEqual(response.status_code, 502)
        body = response.json()
        self.assertIn("detail", body)

    def test_route_decision_unknown_truck_404(self):
        r = self.client.get("/api/fleet/route-decision?truck_code=GHOST")
        self.assertEqual(r.status_code, 404)

    def test_predictions_kecamatan_localizes_event_impact(self):
        base_resp = self.client.get("/api/predictions/kecamatan?event_attendance=0")
        self.assertEqual(base_resp.status_code, 200)
        base_kecs = {k["slug"]: k["predicted_tons"] for k in base_resp.json()["kecamatan"]}
        
        event_resp = self.client.get(
            "/api/predictions/kecamatan?event_attendance=50000&event_lat=-6.1754&event_lng=106.8272"
        )
        self.assertEqual(event_resp.status_code, 200)
        event_kecs = {k["slug"]: k["predicted_tons"] for k in event_resp.json()["kecamatan"]}
        
        self.assertGreater(event_kecs["gambir"], base_kecs["gambir"])
        self.assertEqual(event_kecs["cengkareng"], base_kecs["cengkareng"])

    def test_executive_summary_includes_queue_impact(self):
        response = self.client.get("/api/reports/executive-summary")
        self.assertEqual(response.status_code, 200)
        impact = response.json().get("queue_impact", {})
        for key in ("baseline_wait_minutes", "optimized_wait_minutes",
                    "baseline_queue_trucks", "optimized_queue_trucks", "queue_reduction_percent"):
            self.assertIn(key, impact)
        self.assertGreaterEqual(impact["optimized_wait_minutes"], 0)
        self.assertGreaterEqual(impact["queue_reduction_percent"], 0)

    def test_alert_follow_up_records_and_lists(self):
        post = self.client.post(
            "/api/alert/follow-up",
            json={"alert_id": "ALERT-42", "status": "RESOLVED", "operator": "supervisor", "note": "handled by TPS"},
        )
        self.assertEqual(post.status_code, 200)
        self.assertTrue(post.json()["recorded"])
        trail = self.client.get("/api/alert/follow-ups").json()
        self.assertTrue(any(r["payload"].get("alert_id") == "ALERT-42" for r in trail))

    def test_alert_follow_up_rejects_invalid_status(self):
        response = self.client.post(
            "/api/alert/follow-up",
            json={"alert_id": "ALERT-1", "status": "NOPE"},
        )
        self.assertEqual(response.status_code, 400)

    def test_alert_follow_up_requires_alert_id(self):
        response = self.client.post(
            "/api/alert/follow-up",
            json={"status": "OPEN"},
        )
        self.assertEqual(response.status_code, 400)

    def test_event_permit_submission_returns_impact_and_appears_in_listing(self):
        payload = {
            "name": "Konser Uji Coba",
            "location_name": "GBK Senayan",
            "event_date": "2026-08-30",
            "expected_attendance": 70000,
            "lat": -6.2183,
            "lng": 106.8022,
        }
        created = self.client.post("/api/events/permits", json=payload)
        self.assertEqual(created.status_code, 201)
        body = created.json()
        self.assertEqual(body["impact"]["predicted_waste_tons"], 84.0)
        self.assertTrue(body["affected_kecamatan"], "permit must name affected districts")
        listing = self.client.get("/api/events/permits").json()
        mine = [p for p in listing if p.get("id") == body["permit"]["id"]]
        self.assertTrue(mine, "submitted permit must appear in the permits layer")
        self.assertEqual(mine[0]["data_class"], "USER_SUBMITTED")

    def test_event_permit_rejects_invalid_input(self):
        bad = {
            "name": "X",
            "location_name": "Y",
            "event_date": "2026-08-30",
            "expected_attendance": 0,
            "lat": -6.2,
            "lng": 106.8,
        }
        self.assertEqual(self.client.post("/api/events/permits", json=bad).status_code, 422)

    def test_facility_gap_analysis_endpoint_discloses_proxy(self):
        resp = self.client.get("/api/facilities/gap-analysis")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["classification"], "proxy")
        self.assertEqual(body["summary"]["kecamatan_total"], 42)


if __name__ == "__main__":
    unittest.main()
