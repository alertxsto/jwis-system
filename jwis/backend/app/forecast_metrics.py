# -*- coding: utf-8 -*-
"""Forecasting evaluation metrics and honest per-resolution suitability contract.

Provides WAPE, MAE, MASE, and seasonal-naive baselines so Case 2 forecast
claims are benchmarked against naive baselines rather than presented in a
vacuum. suitability_labels() encodes which resolutions JWIS may claim as
reliable — daily-district is explicitly NOT supported because that target is
calibrated-synthetic.
"""
from __future__ import annotations

from collections.abc import Sequence


def mae(actual: Sequence[float], predicted: Sequence[float]) -> float:
    n = len(actual)
    if n == 0:
        return 0.0
    return sum(abs(a - p) for a, p in zip(actual, predicted)) / n


def wape(actual: Sequence[float], predicted: Sequence[float]) -> float:
    """Weighted Absolute Percentage Error = sum|error| / sum|actual|."""
    denom = sum(abs(a) for a in actual)
    if denom == 0:
        return 0.0
    return sum(abs(a - p) for a, p in zip(actual, predicted)) / denom


def seasonal_naive_forecast(series: Sequence[float], seasonal_period: int = 7) -> list[float]:
    """Predict each point from the value one season earlier; warm-up uses first value."""
    out: list[float] = []
    for i in range(len(series)):
        if i < seasonal_period:
            out.append(series[0])
        else:
            out.append(series[i - seasonal_period])
    return out


def mase(actual: Sequence[float], predicted: Sequence[float], seasonal_period: int = 1) -> float:
    """Mean Absolute Scaled Error: model MAE / seasonal-naive MAE on the actuals.

    < 1 means the model beats the seasonal-naive baseline; >= 1 means it does not.
    """
    n = len(actual)
    if n <= seasonal_period:
        return float("inf")
    naive_errors = [abs(actual[i] - actual[i - seasonal_period]) for i in range(seasonal_period, n)]
    scale = sum(naive_errors) / len(naive_errors) if naive_errors else 0.0
    if scale == 0:
        return 0.0
    return mae(actual, predicted) / scale


def suitability_labels() -> dict[str, str]:
    """Which forecast resolutions JWIS may present as reliable.

    Grounded in the multi-resolution evaluation: strong at spatial/weekly/monthly,
    NOT supported at daily-district (calibrated-synthetic target).
    """
    return {
        "hotspot_rank": "high",
        "city_day": "reliable",
        "district_month": "reliable",
        "district_week": "reliable",
        "district_day": "not_supported",
    }
