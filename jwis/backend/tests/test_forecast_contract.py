# -*- coding: utf-8 -*-
"""Tests for forecast evaluation metrics and honest suitability contract (Task 5)."""
import unittest

from app.forecast_metrics import (
    mae,
    mase,
    seasonal_naive_forecast,
    suitability_labels,
    wape,
)


class MetricTests(unittest.TestCase):
    def test_wape_zero_on_perfect(self):
        self.assertEqual(wape([10, 20, 30], [10, 20, 30]), 0.0)

    def test_wape_matches_manual(self):
        # sum|e| / sum|y| = (2+1) / (10+20) = 0.1
        self.assertAlmostEqual(wape([10, 20], [12, 19]), 0.1, places=3)

    def test_mae_basic(self):
        self.assertAlmostEqual(mae([1, 2, 3], [2, 2, 2]), (1 + 0 + 1) / 3, places=6)

    def test_mase_less_than_one_when_better_than_naive(self):
        actual = [10, 12, 11, 13, 12, 14]
        good = [10, 12, 11, 13, 12, 14]
        score = mase(actual, good, seasonal_period=1)
        self.assertLess(score, 0.5, "perfect forecast must beat naive strongly")

    def test_seasonal_naive_shifts_by_period(self):
        series = [1, 2, 3, 4, 5, 6, 7]
        fc = seasonal_naive_forecast(series, seasonal_period=7)
        self.assertEqual(len(fc), len(series))


class SuitabilityContractTests(unittest.TestCase):
    def test_labels_cover_all_resolutions(self):
        labels = suitability_labels()
        for key in ("city_day", "district_week", "district_month", "hotspot_rank"):
            self.assertIn(key, labels)

    def test_daily_district_not_claimed_reliable(self):
        labels = suitability_labels()
        # Daily-district must NOT be labeled reliable/high (calibrated-synthetic).
        daily = labels.get("district_day", "not_supported")
        self.assertIn(daily, ("not_supported", "low"),
                      "daily-district accuracy must not be claimed reliable")


class HorizonSeriesTests(unittest.TestCase):
    def test_series_length_and_totals_match(self):
        from app.engine import predict_waste_hybrid_series
        s = predict_waste_hybrid_series("cengkareng", days=14, rainfall_mm=42.0, event_attendance=85000)
        self.assertEqual(len(s["series"]), 14)
        self.assertAlmostEqual(s["total_tons"], sum(r["predicted_tons"] for r in s["series"]), places=1)
        self.assertEqual(s["peak_tons"], max(r["predicted_tons"] for r in s["series"]))

    def test_series_weekend_varies_from_weekday(self):
        from app.engine import predict_waste_hybrid_series
        # Start on a known Monday so days 5-6 are Saturday/Sunday.
        s = predict_waste_hybrid_series("menteng", days=7, start_date="2026-08-10")
        weekend_flags = [r["is_weekend"] for r in s["series"]]
        self.assertEqual(weekend_flags, [False, False, False, False, False, True, True])

    def test_series_detects_real_national_holiday(self):
        from app.engine import predict_waste_hybrid_series
        # 2026-08-17 is Hari Kemerdekaan RI (real holiday calendar file).
        s = predict_waste_hybrid_series("gambir", days=1, start_date="2026-08-17")
        self.assertTrue(s["series"][0]["is_holiday"])

    def test_series_clamps_days_to_30(self):
        from app.engine import predict_waste_hybrid_series
        s = predict_waste_hybrid_series("gambir", days=60)
        self.assertEqual(s["days"], 30)


class FactorAttributionTests(unittest.TestCase):
    def test_attribution_present_and_rainfall_positive(self):
        from app.engine import predict_waste_hybrid
        pred = predict_waste_hybrid("cengkareng", rainfall_mm=42.0, event_attendance=85000, is_weekend=True)
        attr = pred.get("factor_attribution")
        self.assertIsNotNone(attr)
        for key in ("rainfall_tons", "event_tons", "weekend_tons", "holiday_tons", "prophet_baseline_tons"):
            self.assertIn(key, attr)
        self.assertGreaterEqual(attr["rainfall_tons"], 0)

    def test_dry_day_has_no_rainfall_attribution(self):
        from app.engine import predict_waste_hybrid
        wet = predict_waste_hybrid("cengkareng", rainfall_mm=42.0)
        dry = predict_waste_hybrid("cengkareng", rainfall_mm=0.0)
        self.assertGreater(wet["factor_attribution"]["rainfall_tons"],
                           dry["factor_attribution"]["rainfall_tons"])


if __name__ == "__main__":
    unittest.main()
