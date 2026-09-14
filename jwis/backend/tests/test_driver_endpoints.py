import os
import unittest

from fastapi.testclient import TestClient

from app.main import app

ALL_OK = {"rem": True, "mesin": True, "ban": True, "bbm": True,
          "oli": True, "bak_compactor": True, "lampu": True}


class PretripEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_submit_and_today(self):
        r = self.client.post("/api/pretrip", json={
            "truck_code": "T-210", "driver_name": "E2E", "items": ALL_OK,
            "note": ""})
        self.assertEqual(r.status_code, 201)
        today = self.client.get("/api/pretrip/today/T-210")
        self.assertTrue(today.json()["done"])
        self.assertEqual(today.json()["record"]["truck_code"], "T-210")

    def test_submit_invalid_items_409(self):
        r = self.client.post("/api/pretrip", json={
            "truck_code": "T-210", "driver_name": "E2E",
            "items": {"rem": True}, "note": ""})
        self.assertEqual(r.status_code, 409)

    def test_submit_fail_item_requires_note(self):
        items = dict(ALL_OK, rem=False)
        r = self.client.post("/api/pretrip", json={
            "truck_code": "T-210", "driver_name": "E2E", "items": items,
            "note": ""})
        self.assertEqual(r.status_code, 409)


class DamageEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_create_list_resolve_flow(self):
        r = self.client.post("/api/damage-reports", json={
            "truck_code": "T-211", "driver_name": "E2E", "component": "ban",
            "severity": "berat", "note": "Ban pecah"})
        self.assertEqual(r.status_code, 201)
        rep = r.json()
        listing = self.client.get("/api/damage-reports?status=baru")
        ids = [x["report_id"] for x in listing.json()["reports"]]
        self.assertIn(rep["report_id"], ids)
        done = self.client.post(f"/api/damage-reports/{rep['report_id']}/resolve")
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()["status"], "selesai")
        again = self.client.post(f"/api/damage-reports/{rep['report_id']}/resolve")
        self.assertEqual(again.status_code, 409)

    def test_heavy_report_marks_truck_damaged_in_fleet(self):
        r = self.client.post("/api/damage-reports", json={
            "truck_code": "T-212", "driver_name": "E2E", "component": "mesin",
            "severity": "berat", "note": "Mesin mati"})
        self.assertEqual(r.status_code, 201)
        rep_id = r.json()["report_id"]
        fleet = self.client.get("/api/fleet").json()
        trucks = fleet if isinstance(fleet, list) else fleet.get("trucks", [])
        t212 = next((t for t in trucks if t["truck_code"] == "T-212"), None)
        self.assertIsNotNone(t212)
        self.assertTrue(t212["is_damaged"])
        self.assertFalse(t212["damage_status"]["operational"])
        self.client.post(f"/api/damage-reports/{rep_id}/resolve")

    def test_gen_cache_invalidated_on_report_create(self):
        from app.fleet_generator import _gen_cache
        self.client.get("/api/fleet")  # warm generated cache with undamaged T-215
        self.assertIsNotNone(_gen_cache["payload"])
        r = self.client.post("/api/damage-reports", json={
            "truck_code": "T-215", "driver_name": "E2E", "component": "rem",
            "severity": "berat", "note": "Rem blong"})
        self.assertEqual(r.status_code, 201)
        rep_id = r.json()["report_id"]
        self.assertEqual(_gen_cache["ts"], 0.0)  # create must invalidate, not rely on TTL
        fleet = self.client.get("/api/fleet").json()
        trucks = fleet if isinstance(fleet, list) else fleet.get("trucks", [])
        t215 = next((t for t in trucks if t["truck_code"] == "T-215"), None)
        self.assertIsNotNone(t215)
        self.assertTrue(t215["is_damaged"])
        self.assertFalse(t215["damage_status"]["operational"])
        self.client.post(f"/api/damage-reports/{rep_id}/resolve")

    def test_receipt_flow(self):
        create = self.client.post("/api/spj", json={
            "driver_name": "E2E", "truck_code": "T-213",
            "destination": "TPST Bantargebang", "weigh_on_site": False,
            "priority": "normal", "note": ""})
        spj_id = create.json()["spj_id"]
        early = self.client.post(f"/api/spj/{spj_id}/receipt", json={
            "photo_name": "struk.jpg", "photo_b64": "data:image/jpeg;base64,AA",
            "total_weight_kg": 120.5})
        self.assertEqual(early.status_code, 409)
        self.client.post(f"/api/spj/{spj_id}/stops", json={
            "name": "S", "kecamatan": "K", "address": "A",
            "lat": -6.2, "lng": 106.8})
        self.client.post(f"/api/spj/{spj_id}/activate")
        self.client.post(f"/api/spj/{spj_id}/stops/0/complete")
        ok = self.client.post(f"/api/spj/{spj_id}/receipt", json={
            "photo_name": "struk.jpg", "photo_b64": "data:image/jpeg;base64,AA",
            "total_weight_kg": 120.5})
        self.assertEqual(ok.status_code, 201)

    def test_complete_stop_with_evidence_and_summary(self):
        create = self.client.post("/api/spj", json={
            "driver_name": "E2E", "truck_code": "T-214",
            "destination": "TPST Bantargebang", "weigh_on_site": True,
            "priority": "normal", "note": ""})
        spj_id = create.json()["spj_id"]
        self.client.post(f"/api/spj/{spj_id}/stops", json={
            "name": "S", "kecamatan": "K", "address": "A",
            "lat": -6.2, "lng": 106.8})
        self.client.post(f"/api/spj/{spj_id}/activate")
        evidence = {
            "arrival": {"photo_name": "a.jpg", "lat": -6.2, "lng": 106.8,
                        "at": "2026-09-14T08:00:00"},
            "weighing": [{"fraction": "Residu", "weight_kg": 40.0,
                          "photo_name": "t.jpg"}],
            "officer": {"photo_name": "p.jpg", "name": "Dicky"},
        }
        done = self.client.post(f"/api/spj/{spj_id}/stops/0/complete",
                                json={"evidence": evidence})
        self.assertEqual(done.status_code, 200)
        summary = self.client.get(f"/api/spj/{spj_id}/evidence-summary")
        self.assertEqual(summary.status_code, 200)
        body = summary.json()
        self.assertTrue(body["complete"])
        stop = body["stops"][0]
        self.assertTrue(stop["has_arrival"])
        self.assertEqual(stop["total_weight_kg"], 40.0)
        self.assertEqual(stop["officer_name"], "Dicky")

    def test_spj_list_has_no_photo_b64(self):
        create = self.client.post("/api/spj", json={
            "driver_name": "E2E", "truck_code": "T-240",
            "destination": "TPST Bantargebang", "weigh_on_site": True,
            "priority": "normal", "note": ""})
        spj_id = create.json()["spj_id"]
        self.client.post(f"/api/spj/{spj_id}/stops", json={
            "name": "S", "kecamatan": "K", "address": "A", "lat": -6.2, "lng": 106.8})
        self.client.post(f"/api/spj/{spj_id}/activate")
        self.client.post(f"/api/spj/{spj_id}/stops/0/complete", json={"evidence": {
            "arrival": {"photo_name": "a.jpg", "photo_b64": "data:image/jpeg;base64,AAA"},
            "weighing": [{"fraction": "Residu", "weight_kg": 40.0,
                          "photo_name": "t.jpg", "photo_b64": "data:image/jpeg;base64,BBB"}],
            "officer": {"photo_name": "p.jpg", "name": "Dicky"}}})
        listing = self.client.get("/api/spj")
        self.assertNotIn("base64", listing.text)
        detail = self.client.get(f"/api/spj/{spj_id}")
        self.assertIn("base64", detail.text)  # detail keeps full evidence

    def test_receipt_requires_photo(self):
        create = self.client.post("/api/spj", json={
            "driver_name": "E2E", "truck_code": "T-241",
            "destination": "TPST Bantargebang", "weigh_on_site": False,
            "priority": "normal", "note": ""})
        spj_id = create.json()["spj_id"]
        self.client.post(f"/api/spj/{spj_id}/stops", json={
            "name": "S", "kecamatan": "K", "address": "A", "lat": -6.2, "lng": 106.8})
        self.client.post(f"/api/spj/{spj_id}/activate")
        self.client.post(f"/api/spj/{spj_id}/stops/0/complete")
        r = self.client.post(f"/api/spj/{spj_id}/receipt", json={
            "photo_name": "", "photo_b64": "", "total_weight_kg": 10.0})
        self.assertEqual(r.status_code, 409)


class OcrTimbanganEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_ocr_without_api_key_is_failed(self):
        old = os.environ.pop("OPENAI_API_KEY", None)
        try:
            r = self.client.post("/api/ocr/timbangan", json={
                "photo_b64": "data:image/jpeg;base64,AA"})
        finally:
            if old is not None:
                os.environ["OPENAI_API_KEY"] = old
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIsNone(body["weight_kg"])
        self.assertEqual(body["confidence"], "failed")


if __name__ == "__main__":
    unittest.main()
