# -*- coding: utf-8 -*-
"""Tests for data provenance completeness and honesty (Task 1)."""
import json
import unittest
from pathlib import Path

from app.real_data import (
    REAL_DIR,
    build_provenance_records,
    load_kelurahan_heatmap,
)

REPO_DATA = Path(__file__).resolve().parents[2] / "data"


class TestManifestIntegrity(unittest.TestCase):
    def test_every_manifest_file_path_exists(self):
        manifest = json.loads((REAL_DIR / "manifest.json").read_text(encoding="utf-8"))
        missing = []
        for entry in manifest.get("files", []):
            name = entry.get("file") or entry.get("path")
            if name and not (REAL_DIR / name).exists():
                missing.append(name)
        self.assertEqual(missing, [], f"manifest references missing files: {missing}")


class TestProvenanceRecords(unittest.TestCase):
    def test_records_have_required_fields(self):
        records = build_provenance_records()
        self.assertTrue(records, "no provenance records produced")
        required = {"source_url", "as_of", "granularity", "classification", "row_count", "freshness", "limitations"}
        for rec in records:
            self.assertTrue(required.issubset(rec.keys()),
                            f"record {rec.get('name')} missing {required - set(rec.keys())}")

    def test_no_loaded_dataset_without_source_url(self):
        records = build_provenance_records()
        no_url = [r["name"] for r in records if not r.get("source_url")]
        self.assertEqual(no_url, [], f"datasets loaded without source_url: {no_url}")

    def test_proxy_capacity_not_labeled_official(self):
        records = build_provenance_records()
        for rec in records:
            if "tps" in rec["name"].lower() and "capacity" in rec["name"].lower():
                self.assertEqual(rec["classification"], "proxy",
                                 f"{rec['name']} must be classified proxy, not official")


class TestKelurahanHeatmap(unittest.TestCase):
    def test_heatmap_uses_267_kelurahan(self):
        fc = load_kelurahan_heatmap()
        self.assertEqual(fc.get("type"), "FeatureCollection")
        self.assertEqual(len(fc.get("features", [])), 267,
                         "heatmap must cover all 267 DKI kelurahan, not the 10-feature fallback")

    def test_heatmap_features_carry_admin_key_and_risk(self):
        fc = load_kelurahan_heatmap()
        f0 = fc["features"][0]
        props = f0["properties"]
        self.assertIn("kelurahan", props)
        self.assertIn("predicted_tons", props)


if __name__ == "__main__":
    unittest.main()
