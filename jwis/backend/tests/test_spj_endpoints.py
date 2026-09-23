import unittest

from fastapi.testclient import TestClient

from app.main import app


class SpjEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)
        _login = self.client.post("/api/auth/login", json={"username": "administrator", "password": "administrator-demo-pass"})
        self.client.headers.update({"Authorization": f"Bearer {_login.json()['token']}"})
        created = self.client.post("/api/spj", json={
            "driver_name": "Test Driver", "truck_code": "T-200",
            "destination": "TPST Bantargebang", "weigh_on_site": True,
            "priority": "normal", "note": "endpoint test",
        })
        self.assertEqual(created.status_code, 201)
        self.spj = created.json()

    def _add_stop_and_activate(self):
        r = self.client.post(f"/api/spj/{self.spj['spj_id']}/stops", json={
            "name": "TPS Test", "kecamatan": "Cilandak",
            "address": "Jl. Test 1", "lat": -6.29, "lng": 106.79,
        })
        self.assertEqual(r.status_code, 200)
        act = self.client.post(f"/api/spj/{self.spj['spj_id']}/activate")
        self.assertEqual(act.status_code, 200)
        return act.json()

    def tearDown(self):
        self.client.post(f"/api/spj/{self.spj['spj_id']}/cancel")

    def test_create_draft_201(self):
        self.assertEqual(self.spj["status"], "draft")
        self.assertTrue(self.spj["spj_number"].startswith("DLH-DKI/SPJ/"))
        self.assertEqual(self.spj["weigh_on_site"], True)

    def test_get_detail_and_404(self):
        r = self.client.get(f"/api/spj/{self.spj['spj_id']}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["spj_id"], self.spj["spj_id"])
        missing = self.client.get("/api/spj/does-not-exist")
        self.assertEqual(missing.status_code, 404)

    def test_list_with_status_filter(self):
        r = self.client.get("/api/spj?status=draft")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("count", body)
        ids = [s["spj_id"] for s in body["spj"]]
        self.assertIn(self.spj["spj_id"], ids)
        self.assertTrue(all(s["status"] == "draft" for s in body["spj"]))

    def test_activate_requires_stop_409(self):
        r = self.client.post(f"/api/spj/{self.spj['spj_id']}/activate")
        self.assertEqual(r.status_code, 409)

    EVIDENCE = {
        "arrival": {"photo_name": "datang.jpg", "photo_b64": "data:image/jpeg;base64,AAA",
                    "lat": -6.2379, "lng": 106.7826, "at": "2026-09-14T08:00:00"},
        "weighing": [{"fraction": "Residu", "weight_kg": 37.2,
                      "photo_name": "timbang1.jpg", "photo_b64": "data:image/jpeg;base64,BBB"}],
        "officer": {"photo_name": "petugas.jpg", "photo_b64": "data:image/jpeg;base64,CCC",
                    "name": "Dicky"},
    }

    def test_full_lifecycle(self):
        activated = self._add_stop_and_activate()
        self.assertEqual(activated["status"], "aktif")
        self.assertEqual(len(activated["stops"]), 1)
        # Stop completion without evidence is rejected.
        bare = self.client.post(
            f"/api/spj/{self.spj['spj_id']}/stops/0/complete")
        self.assertEqual(bare.status_code, 409)
        done = self.client.post(
            f"/api/spj/{self.spj['spj_id']}/stops/0/complete",
            json={"evidence": self.EVIDENCE})
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()["status"], "selesai")
        cancel = self.client.post(f"/api/spj/{self.spj['spj_id']}/cancel")
        self.assertEqual(cancel.status_code, 409)  # selesai cannot cancel

    def test_complete_without_evidence_409(self):
        self._add_stop_and_activate()
        r = self.client.post(f"/api/spj/{self.spj['spj_id']}/complete")
        self.assertEqual(r.status_code, 409)
        self.assertIn("evidence", r.json()["detail"])
        # cleanup
        self.client.post(f"/api/spj/{self.spj['spj_id']}/cancel")

    def test_complete_override_requires_permission(self):
        self._add_stop_and_activate()
        # dispatcher lacks spj:override
        login = self.client.post("/api/auth/login", json={
            "username": "dispatcher", "password": "dispatcher-demo-pass"})
        token = login.json()["token"]
        r = self.client.post(
            f"/api/spj/{self.spj['spj_id']}/complete",
            json={"override": True, "reason": "device lost"},
            headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(r.status_code, 403)
        # cleanup with admin session
        self.client.post(f"/api/spj/{self.spj['spj_id']}/cancel")

    def test_complete_override_with_permission_records_audit(self):
        self._add_stop_and_activate()
        r = self.client.post(
            f"/api/spj/{self.spj['spj_id']}/complete",
            json={"override": True, "reason": "driver device lost"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "selesai")
        audit = self.client.get(f"/api/spj/{self.spj['spj_id']}/audit")
        self.assertEqual(audit.status_code, 200)
        entries = audit.json()["audit"]
        self.assertTrue(any(e["action"] == "override" and e["reason"] == "driver device lost"
                            for e in entries))

    def test_complete_override_empty_reason_409(self):
        self._add_stop_and_activate()
        r = self.client.post(
            f"/api/spj/{self.spj['spj_id']}/complete",
            json={"override": True, "reason": "  "})
        self.assertEqual(r.status_code, 409)
        # cleanup
        self.client.post(f"/api/spj/{self.spj['spj_id']}/cancel")

    def test_active_path_endpoint(self):
        self._add_stop_and_activate()
        r = self.client.get(f"/api/spj/active-path/{self.spj['truck_code']}")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertTrue(body["has_active_spj"])
        self.assertEqual(len(body["path"]), 2)  # 1 stop + destination
        self.assertEqual(body["path"][0]["lat"], -6.29)
        none_case = self.client.get("/api/spj/active-path/T-254")
        self.assertIn(none_case.json()["has_active_spj"], (True, False))

    def test_invalid_destination_409(self):
        r = self.client.post("/api/spj", json={
            "driver_name": "X", "truck_code": "T-201",
            "destination": "TPA Liar", "weigh_on_site": False,
            "priority": "normal", "note": "",
        })
        self.assertEqual(r.status_code, 409)

    def test_double_activation_same_truck_409(self):
        self._add_stop_and_activate()
        second = self.client.post("/api/spj", json={
            "driver_name": "Y", "truck_code": self.spj["truck_code"],
            "destination": "RDF Plant Jakarta", "weigh_on_site": False,
            "priority": "vip", "note": "",
        })
        sid = second.json()["spj_id"]
        self.client.post(f"/api/spj/{sid}/stops", json={
            "name": "S", "kecamatan": "K", "address": "A",
            "lat": -6.2, "lng": 106.8,
        })
        r = self.client.post(f"/api/spj/{sid}/activate")
        self.assertEqual(r.status_code, 409)
        self.client.post(f"/api/spj/{sid}/cancel")


if __name__ == "__main__":
    unittest.main()
