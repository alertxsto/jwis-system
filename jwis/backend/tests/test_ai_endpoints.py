import os
import time
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app.main import app
from app.ai.actions.auto_state import AiEvent, EVENT_FEED
from app.ai.engine_loop import maybe_start_engine


class AiEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        EVENT_FEED.clear()

    def tearDown(self):
        EVENT_FEED.clear()

    def test_events_empty_initially(self):
        r = self.client.get("/api/ai/events")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"events": [], "count": 0})

    def test_events_feed_served_and_acknowledged(self):
        EVENT_FEED.append(AiEvent(event_type="auto_reroute", truck_code="T-001",
                                  title="t", detail={}, confidence=0.8,
                                  created_at="2026-09-10T00:00:00"))
        r = self.client.get("/api/ai/events")
        self.assertEqual(r.json()["count"], 1)
        self.assertEqual(r.json()["events"][0]["status"], "new")
        ack = self.client.post("/api/ai/events/0/ack")
        self.assertTrue(ack.json()["ok"])
        self.assertEqual(
            self.client.get("/api/ai/events").json()["events"][0]["status"],
            "acknowledged")
        bad = self.client.post("/api/ai/events/99/ack")
        self.assertFalse(bad.json()["ok"])

    def test_tpa_queue_live_schema(self):
        r = self.client.get("/api/ai/tpa-queue-live")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        # engine off di test -> no_data; bila engine pernah jalan -> schema penuh
        self.assertTrue(body == {"status": "no_data"}
                        or "predicted_wait_min" in body)

    def test_unlicensed_flags_endpoint(self):
        r = self.client.get("/api/ai/unlicensed-flags")
        self.assertEqual(r.status_code, 200)
        self.assertIn("flags", r.json())
        self.assertIn("count", r.json())

    def test_carbon_live_endpoint(self):
        r = self.client.get("/api/ai/carbon-live")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body == {"status": "no_data"} or "fuel_l" in body)

    def test_event_forecast_endpoint(self):
        r = self.client.get("/api/ai/event-forecast")
        self.assertEqual(r.status_code, 200)
        self.assertIn("outlook", r.json())
        self.assertIn("count", r.json())

    def test_engine_on_runs_registered_modules(self):
        with mock.patch.dict(os.environ, {"JWIS_AI_ENGINE": "on"}):
            engine = maybe_start_engine()
        self.assertIsNotNone(engine)
        called = []
        engine.register("spy", lambda source: called.append(1))
        time.sleep(0.3)
        engine.stop()
        self.assertGreaterEqual(len(called), 1)


if __name__ == "__main__":
    unittest.main()
