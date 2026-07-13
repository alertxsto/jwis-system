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


if __name__ == "__main__":
    unittest.main()
