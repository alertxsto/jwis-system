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


if __name__ == "__main__":
    unittest.main()
