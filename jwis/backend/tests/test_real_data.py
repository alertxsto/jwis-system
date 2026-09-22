# -*- coding: utf-8 -*-
"""Tests for data provenance completeness and honesty (Task 1)."""
import json
import unittest
from pathlib import Path

from app.real_data import (
    REAL_DIR,
    build_provenance_records,
    kelurahan_allocation_weights,
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

    def test_every_heatmap_feature_has_predicted_tons_key(self):
        fc = load_kelurahan_heatmap()
        missing = [f["properties"].get("kelurahan")
                   for f in fc["features"]
                   if "predicted_tons" not in f["properties"]]
        self.assertEqual(missing, [], f"features missing predicted_tons: {missing}")

    def test_null_predicted_tons_are_kept_not_dropped(self):
        fc = load_kelurahan_heatmap()
        nulls = [f for f in fc["features"] if f["properties"].get("predicted_tons") is None]
        # Null-value kelurahan (outside SILIKA 42-kecamatan coverage) must remain
        # as features so the map renders them as explicit "no data", not dropped.
        self.assertEqual(len(fc["features"]), 267)
        self.assertGreater(len(nulls), 0)

    def test_allocation_weights_sum_to_one_per_kecamatan(self):
        weights, method = kelurahan_allocation_weights("MATRAMAN", ["PALMERIAM", "KEBONMANGGIS", "UTANKAYUSELATAN"])
        self.assertEqual(method, "weighted_population_tps")
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=6)

    def test_allocation_weights_fall_back_to_even_split_without_data(self):
        weights, method = kelurahan_allocation_weights("KECAMATAN_TIDAK_ADA", ["A", "B"])
        self.assertEqual(method, "even_split_no_real_driver_data")
        self.assertEqual(weights, {"A": 0.5, "B": 0.5})

    def test_heatmap_allocation_varies_within_kecamatan(self):
        fc = load_kelurahan_heatmap({"MATRAMAN": 100.0})
        feats = [f for f in fc["features"]
                 if str(f["properties"].get("kecamatan", "")).strip().upper() == "MATRAMAN"]
        tons = [f["properties"]["predicted_tons"] for f in feats
                if f["properties"].get("predicted_tons") is not None]
        self.assertGreater(len(tons), 3, "Matraman must have several kelurahan features")
        self.assertGreater(len(set(tons)), 1,
                           "weighted allocation must not be a flat even split")
        self.assertAlmostEqual(sum(tons), 100.0, delta=1.0,
                               msg="allocated kelurahan tons must sum back to the kecamatan total")

    def test_heatmap_allocation_is_honestly_labeled(self):
        fc = load_kelurahan_heatmap()
        labels = {f["properties"].get("classification", "") for f in fc["features"]}
        self.assertTrue(any("weighted_population_tps" in c or "even_split" in c for c in labels),
                        f"allocation method must be disclosed in classification, got {labels}")


if __name__ == "__main__":
    unittest.main()
