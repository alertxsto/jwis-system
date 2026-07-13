# -*- coding: utf-8 -*-
"""Tests for dependency-aware health endpoint (Task 8)."""
import unittest

from fastapi.testclient import TestClient

from app.main import app


class HealthTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, raise_server_exceptions=False)

    def test_health_reports_components(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("status", body)

    def test_health_detailed_lists_dependencies(self):
        r = self.client.get("/api/health/detailed")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertIn("components", body)
        for comp in ("database", "models", "source_files"):
            self.assertIn(comp, body["components"])

    def test_health_reports_model_count(self):
        r = self.client.get("/api/health/detailed")
        models = r.json()["components"]["models"]
        self.assertIn("available", models)


if __name__ == "__main__":
    unittest.main()
