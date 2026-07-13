# -*- coding: utf-8 -*-
"""Tests for the reproducible impact evaluation harness (Task 9)."""
import unittest

from app.impact import build_impact_report


class ImpactReportTests(unittest.TestCase):
    def test_report_has_metrics_with_provenance(self):
        report = build_impact_report()
        self.assertIn("metrics", report)
        self.assertTrue(report["metrics"])
        for m in report["metrics"]:
            for field in ("name", "unit", "baseline", "jwis", "source", "classification"):
                self.assertIn(field, m, f"metric {m.get('name')} missing {field}")

    def test_no_metric_claims_observed_field_impact(self):
        report = build_impact_report()
        for m in report["metrics"]:
            # Simulated/derived metrics must be labeled, never "observed_field".
            self.assertIn(m["classification"],
                          ("simulated", "derived", "modeled", "reference"),
                          f"{m['name']} wrongly classified {m['classification']}")

    def test_queue_metric_reproducible(self):
        a = build_impact_report()
        b = build_impact_report()
        qa = next(m for m in a["metrics"] if m["name"] == "tpa_wait_reduction")
        qb = next(m for m in b["metrics"] if m["name"] == "tpa_wait_reduction")
        self.assertEqual(qa["jwis"], qb["jwis"])


if __name__ == "__main__":
    unittest.main()
