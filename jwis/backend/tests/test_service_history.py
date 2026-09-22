import os
import tempfile
import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.service_history import ServiceStore


def _store(name="test_service.json"):
    path = os.path.join(tempfile.gettempdir(), name)
    if os.path.exists(path):
        os.remove(path)
    return ServiceStore(persist_path=path)


class ServiceStoreTests(unittest.TestCase):
    def test_create_and_list(self):
        store = _store()
        store.create("T-088", "2026-09-01", "rem", "Ganti kampas rem",
                     cost_idr=1500000, technician="Bengkel A",
                     next_due_date="2026-12-01")
        store.create("T-088", "2026-09-10", "oli", "Ganti oli")
        records = store.list("T-088")
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0].component, "oli")  # newest first
        self.assertEqual(len(store.list("T-001")), 0)

    def test_latest_per_truck(self):
        store = _store()
        store.create("T-088", "2026-09-01", "rem", "x")
        store.create("T-088", "2026-09-10", "rem", "y")
        latest = store.latest_per_truck()
        self.assertEqual(latest["T-088"].description, "y")

    def test_due_soon_windows(self):
        store = _store()
        store.create("T-088", "2026-09-01", "rem", "x",
                     next_due_date="2026-09-18")   # 4 hari dari today fake
        store.create("T-001", "2026-09-01", "oli", "x",
                     next_due_date="2026-10-10")   # 26 hari
        store.create("T-047", "2026-09-01", "ban", "x",
                     next_due_date="2027-01-01")   # jauh
        due7 = store.due_soon(days=7, today="2026-09-14")
        self.assertEqual([d["truck_code"] for d in due7], ["T-088"])
        self.assertEqual(due7[0]["days_left"], 4)
        due30 = store.due_soon(days=30, today="2026-09-14")
        self.assertEqual([d["truck_code"] for d in due30], ["T-088", "T-001"])

    def test_due_soon_uses_latest_record_per_truck(self):
        store = _store()
        store.create("T-088", "2026-09-01", "rem", "lama",
                     next_due_date="2026-09-15")
        store.create("T-088", "2026-09-13", "rem", "baru",
                     next_due_date="2027-06-01")  # terbaru -> tidak due
        due = store.due_soon(days=30, today="2026-09-14")
        self.assertEqual(due, [])


class ServiceEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        _login = self.client.post("/api/auth/login", json={"username": "administrator", "password": "administrator-demo-pass"})
        self.client.headers.update({"Authorization": f"Bearer {_login.json()['token']}"})

    def test_create_and_list_endpoint(self):
        r = self.client.post("/api/service-records", json={
            "truck_code": "T-250", "service_date": "2026-09-14",
            "component": "rem", "description": "e2e service",
            "cost_idr": 500000, "technician": "Bengkel E2E",
            "next_due_date": "2026-12-14"})
        self.assertEqual(r.status_code, 201)
        listing = self.client.get("/api/service-records?truck_code=T-250")
        self.assertEqual(listing.status_code, 200)
        self.assertTrue(any(rec["description"] == "e2e service"
                            for rec in listing.json()["records"]))

    def test_due_soon_endpoint(self):
        r = self.client.get("/api/service-records/due-soon?days=365")
        self.assertEqual(r.status_code, 200)
        self.assertIn("due", r.json())
        self.assertIn("count", r.json())

    def test_resolve_damage_creates_service_record(self):
        rep = self.client.post("/api/damage-reports", json={
            "truck_code": "T-251", "driver_name": "E2E", "component": "rem",
            "severity": "berat", "note": "rem untuk service hook"}).json()
        self.client.post(f"/api/damage-reports/{rep['report_id']}/resolve")
        listing = self.client.get("/api/service-records?truck_code=T-251")
        mine = [rec for rec in listing.json()["records"]
                if rec["source"] == "damage_resolve" and rec["component"] == "rem"]
        self.assertTrue(mine)
        self.assertIsNotNone(mine[0]["next_due_date"])  # rem -> +90 hari


if __name__ == "__main__":
    unittest.main()
