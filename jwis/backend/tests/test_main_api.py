import unittest

from fastapi.testclient import TestClient

from app.main import app


class MainApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

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
        # Without OpenWA env configured, it must NOT claim a real send.
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

    def test_route_decision_unknown_truck_404(self):
        r = self.client.get("/api/fleet/route-decision?truck_code=GHOST")
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
