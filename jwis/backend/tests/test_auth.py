# -*- coding: utf-8 -*-
"""Tests for role-aware authentication (Task 8)."""
import unittest

from app.auth import ROLES, authenticate, has_permission


class AuthTests(unittest.TestCase):
    def test_known_roles_exist(self):
        for role in ("executive", "dispatcher", "supervisor", "driver", "auditor", "administrator"):
            self.assertIn(role, ROLES)

    def test_authenticate_valid_user(self):
        principal = authenticate("dispatcher", "dispatcher-demo-pass")
        self.assertIsNotNone(principal)
        self.assertEqual(principal["role"], "dispatcher")

    def test_authenticate_rejects_bad_password(self):
        self.assertIsNone(authenticate("dispatcher", "wrong"))

    def test_authenticate_rejects_unknown_user(self):
        self.assertIsNone(authenticate("ghost", "x"))

    def test_administrator_can_approve_plans(self):
        self.assertTrue(has_permission("administrator", "operations:approve"))

    def test_driver_cannot_approve_plans(self):
        self.assertFalse(has_permission("driver", "operations:approve"))

    def test_auditor_can_read_history(self):
        self.assertTrue(has_permission("auditor", "history:read"))


class RbacEnforcementTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from app.main import app
        self.client = TestClient(app, raise_server_exceptions=False)

    def _token(self, role):
        r = self.client.post("/api/auth/login", json={"username": role, "password": f"{role}-demo-pass"})
        return r.json()["token"]

    def test_approve_requires_permission(self):
        # First create a plan (dispatcher allowed to plan).
        plan = self.client.post("/api/operations/plan",
                                headers={"Authorization": f"Bearer {self._token('dispatcher')}"},
                                params={"rainfall_mm": 42, "event_attendance": 85000, "is_weekend": True})
        self.assertEqual(plan.status_code, 200)
        plan_id = plan.json()["plan_id"]
        # Driver must NOT be able to approve.
        denied = self.client.post(f"/api/operations/{plan_id}/approve",
                                  headers={"Authorization": f"Bearer {self._token('driver')}"})
        self.assertEqual(denied.status_code, 403)
        # Supervisor CAN approve.
        ok = self.client.post(f"/api/operations/{plan_id}/approve",
                              headers={"Authorization": f"Bearer {self._token('supervisor')}"})
        self.assertEqual(ok.status_code, 200)

    def test_missing_token_rejected_on_protected_route(self):
        plan = self.client.post("/api/operations/plan",
                                headers={"Authorization": f"Bearer {self._token('dispatcher')}"},
                                params={"rainfall_mm": 0, "event_attendance": 0, "is_weekend": False})
        plan_id = plan.json()["plan_id"]
        denied = self.client.post(f"/api/operations/{plan_id}/approve")
        self.assertEqual(denied.status_code, 401)


if __name__ == "__main__":
    unittest.main()
