# -*- coding: utf-8 -*-
"""Reproducible impact evaluation harness for JWIS.

Every KPI is derived from an actual engine (queue simulation, route geometry,
forecast) or explicitly labeled reference/modeled — never presented as observed
field impact. Replaces hardcoded 58.6% / fixed carbon / tree-equivalent claims.
"""
from __future__ import annotations

from typing import Any

from app.queue_simulation import simulate_queue


def _tpa_wait_reduction() -> dict[str, Any]:
    """Baseline (all trucks in peak hour) vs staggered (60%), from the sim."""
    peak_trucks = 32
    baseline = simulate_queue(peak_trucks, weighbridges=2, service_rate_per_hour=30.0, seed=42)
    staggered = simulate_queue(round(peak_trucks * 0.6), weighbridges=2,
                               service_rate_per_hour=30.0, seed=42)
    b, s = baseline["mean_wait_minutes"], staggered["mean_wait_minutes"]
    reduction = round(((b - s) / b) * 100, 1) if b > 0 else 0.0
    return {
        "name": "tpa_wait_reduction",
        "unit": "percent",
        "baseline": b,
        "jwis": s,
        "delta": reduction,
        "source": "queue_simulation seeded (arrival=32 peak, 2 weighbridges @30/h)",
        "classification": "simulated",
    }


def build_impact_report() -> dict[str, Any]:
    """Assemble reproducible impact metrics with per-metric provenance."""
    metrics: list[dict[str, Any]] = [
        _tpa_wait_reduction(),
        {
            "name": "route_deviation_detection",
            "unit": "meters",
            "baseline": "waypoint-only (false positives)",
            "jwis": "point-to-polyline",
            "source": "engine.distance_point_to_polyline_m + test_engine geometry suite",
            "classification": "derived",
        },
        {
            "name": "forecast_hotspot_rank",
            "unit": "spearman_rho",
            "baseline": 0.0,
            "jwis": 0.998,
            "source": "hybrid_forecaster_evaluation.md multi-resolution",
            "classification": "modeled",
        },
        {
            "name": "fuel_per_ton",
            "unit": "liters_per_ton",
            "baseline": 1.8,
            "jwis": 1.8,
            "source": "engine constant (1.8 L/ton) — reference factor, not measured savings",
            "classification": "reference",
        },
    ]
    return {
        "metrics": metrics,
        "note": "All values are simulated/derived/modeled/reference. None represent "
                "observed field impact; a live pilot is required for observed metrics.",
    }
