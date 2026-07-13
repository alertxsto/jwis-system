# -*- coding: utf-8 -*-
"""
engine.py — JWIS Winning System core logic.
Includes:
- Hybrid Predict (Prophet + XGBoost per district)
- Route Deviation Detection (Isolation Forest)
- Landfill Staggered Dispatch Simulator & OSRM ETA adjustments
- Crew Man-Hours, fuel, and facility requirements planner
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from uuid import uuid4
from typing import Any
import numpy as np
import pandas as pd
import joblib

MODELS_DIR = Path(__file__).resolve().parents[1] / "data" / "models"
# 42 Jakarta kecamatan (matches scripts/train_models.py; models named by slug).
_KELURAHAN_SLUGS = [
    "gambir", "sawah_besar", "kemayoran", "senen", "cempaka_putih", "menteng",
    "tanah_abang", "johar_baru", "penjaringan", "tanjung_priok", "koja",
    "cilincing", "pademangan", "kelapa_gading", "cengkareng", "grogol_petamburan",
    "taman_sari", "tambora", "kebon_jeruk", "kali_deres", "palmerah", "kembangan",
    "tebet", "setiabudi", "mampang_prapatan", "pasar_minggu", "kebayoran_lama",
    "cilandak", "kebayoran_baru", "pancoran", "jagakarsa", "pesanggrahan",
    "matraman", "pulo_gadung", "jatinegara", "kramat_jati", "pasar_rebo",
    "cakung", "duren_sawit", "makasar", "ciracas", "cipayung",
]

def _load_hybrid(kelurahan_slug: str) -> tuple[Any, Any] | None:
    try:
        p_path = MODELS_DIR / f"prophet_{kelurahan_slug}.joblib"
        x_path = MODELS_DIR / f"xgboost_{kelurahan_slug}.joblib"
        if p_path.exists() and x_path.exists():
            return joblib.load(p_path), joblib.load(x_path)
    except Exception:
        pass
    return None

try:
    _ISOLATION_MODEL = joblib.load(MODELS_DIR / "isolation_forest_fleet.joblib")
except Exception:
    _ISOLATION_MODEL = None


# ═════════════════════════════════════════════════════════════════════
# 1. FLEET ROUTING & ANOMALY DETECTION (CASE 1)
# ═════════════════════════════════════════════════════════════════════

def _haversine_meters(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371000.0  # Earth's radius in meters
    lat1, lon1 = radians(a[0]), radians(a[1])
    lat2, lon2 = radians(b[0]), radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    val = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    return 2 * R * asin(sqrt(val))


def _latlng_to_local_m(point, origin) -> tuple[float, float]:
    """Equirectangular projection to local metres around origin (small-area ok)."""
    R = 6371000.0
    lat0 = radians(origin[0])
    x = radians(point[1] - origin[1]) * cos(lat0) * R
    y = radians(point[0] - origin[0]) * R
    return x, y


def _point_to_segment_m(p, a, b) -> float:
    """Shortest distance (metres) from point p to segment a-b."""
    px, py = _latlng_to_local_m(p, a)
    bx, by = _latlng_to_local_m(b, a)
    seg_len_sq = bx * bx + by * by
    if seg_len_sq == 0:
        return sqrt(px * px + py * py)
    t = max(0.0, min(1.0, (px * bx + py * by) / seg_len_sq))
    cx, cy = t * bx, t * by
    return sqrt((px - cx) ** 2 + (py - cy) ** 2)


def distance_point_to_polyline_m(position, path) -> float:
    """Shortest distance (metres) from a position to a polyline route.

    Distance is measured to the nearest route SEGMENT, not the nearest
    waypoint — a truck mid-segment is on-route even if far from any vertex.
    """
    if not path:
        return float("inf")
    if len(path) == 1:
        return _haversine_meters(position, path[0])
    return min(_point_to_segment_m(position, path[i], path[i + 1])
              for i in range(len(path) - 1))


def detect_route_deviation(
    assigned_path: list[tuple[float, float]],
    latest_position: tuple[float, float],
    speed_kmh: float = 30.0,
    threshold_meters: float = 500.0,
) -> dict[str, Any]:
    if not assigned_path:
        return {
            "violated": True,
            "distance_meters": 0,
            "ml_outlier": False,
            "ml_score": None,
            "rule_flags": ["no_assigned_route"],
            "confidence": 1.0,
            "severity": "unknown",
            "message": "No assigned route is available for comparison.",
        }

    distance = distance_point_to_polyline_m(latest_position, assigned_path)
    rule_flags: list[str] = []
    if distance > threshold_meters:
        rule_flags.append("off_corridor")
    if distance > threshold_meters * 2:
        rule_flags.append("far_off_corridor")

    ml_flagged = False
    ml_score: float | None = None
    if _ISOLATION_MODEL is not None:
        try:
            arr = np.array([[latest_position[0], latest_position[1], speed_kmh]])
            ml_flagged = bool(_ISOLATION_MODEL.predict(arr)[0] == -1)
            ml_score = float(_ISOLATION_MODEL.score_samples(arr)[0])
            if ml_flagged:
                rule_flags.append("ml_outlier")
        except Exception:
            pass

    heuristic_violated = distance > threshold_meters
    violated = heuristic_violated or ml_flagged

    # Severity: distance-driven rules are authoritative; ML alone is a warning.
    severity = "normal"
    if distance > threshold_meters * 2:
        severity = "critical"
    elif violated:
        severity = "warning"

    # Confidence: high when rule and ML agree, moderate when only one fires.
    if heuristic_violated and ml_flagged:
        confidence = 0.95
    elif heuristic_violated:
        confidence = 0.8
    elif ml_flagged:
        confidence = 0.5
    else:
        confidence = 0.9

    return {
        "violated": violated,
        "distance_meters": round(distance, 1),
        "ml_outlier": ml_flagged,
        "ml_score": round(ml_score, 4) if ml_score is not None else None,
        "rule_flags": rule_flags,
        "confidence": confidence,
        "severity": severity,
        "message": (
            f"Truck is {distance:.0f} meters from the assigned corridor."
            if violated
            else "Truck remains inside the assigned corridor."
        ),
    }


def recommend_routes(routes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    compliant = [r for r in routes if r.get("permit_compliant", False)]
    scored = []
    for route in compliant:
        score = route["eta_minutes"] * 0.55 + route["traffic_level"] * 35 + route["flood_risk"] * 45
        scored.append({
            **route,
            "score": round(score, 2),
            "reason": (
                "recommended because it is permit-compliant, has the lowest combined "
                f"ETA/traffic/flood risk score ({score:.1f})"
            ),
        })
    return sorted(scored, key=lambda item: item["score"])


def estimate_tpa_queue_wait(waiting_trucks: int, throughput_per_hour: int = 30) -> dict[str, Any]:
    """
    Calculate TPA queue status dynamically.
    Throughput is standard 30 trucks/hour (2 minutes per truck dump time).
    """
    wait_minutes = round((waiting_trucks / throughput_per_hour) * 60)
    
    status = "green"
    if wait_minutes >= 90:
        status = "red"
    elif wait_minutes >= 45:
        status = "yellow"
        
    recommendation = "Delay departures of non-essential trucks by 30-45 minutes to relieve Bantargebang gridlock."
    if status == "green":
        recommendation = "Green corridor clear. Normal dispatch speed approved."
    elif status == "yellow":
        recommendation = "Stagger dispatch cycles by 20 minutes to flatten landfill load spike."
        
    return {
        "trucks_waiting": waiting_trucks,
        "estimated_wait_minutes": wait_minutes,
        "throughput_trucks_per_hour": throughput_per_hour,
        "status": status,
        "recommendation": recommendation
    }


def simulate_staggered_dispatch(active_trucks: int, weighbridges: int = 2,
                                service_rate_per_hour: float = 30.0) -> dict[str, Any]:
    """Compare unstaggered vs staggered arrivals using the queue simulation.

    Baseline crowds all trucks into the peak hour; staggering spreads the same
    trucks across a wider window (modeled as a lower effective peak-hour load).
    Both waits come from the seeded discrete-event simulation, not fixed numbers.
    """
    from app.queue_simulation import simulate_queue

    active_trucks = max(0, int(active_trucks))
    baseline = simulate_queue(active_trucks, weighbridges, service_rate_per_hour, seed=42)
    # Staggering spreads arrivals; model as ~40% of trucks landing in the peak hour.
    staggered_peak = max(1, round(active_trucks * 0.6))
    staggered = simulate_queue(staggered_peak, weighbridges, service_rate_per_hour, seed=42)

    stagger_intervals_minutes = 15
    schedule = []
    today = datetime.now()
    for i in range(active_trucks):
        dept_time = (today + timedelta(minutes=i * stagger_intervals_minutes)).strftime("%H:%M")
        schedule.append({
            "truck_index": i + 1,
            "suggested_departure": dept_time,
            "slot_status": "assigned",
            "tpa_wait_est_minutes": staggered["mean_wait_minutes"],
        })

    b_wait = baseline["mean_wait_minutes"]
    s_wait = staggered["mean_wait_minutes"]
    reduction = round(((b_wait - s_wait) / b_wait) * 100, 1) if b_wait > 0 else 0.0
    return {
        "baseline_wait_minutes": b_wait,
        "baseline_p95_minutes": baseline["p95_wait_minutes"],
        "baseline_queue_trucks": baseline["max_queue"],
        "optimized_wait_minutes": s_wait,
        "optimized_p95_minutes": staggered["p95_wait_minutes"],
        "optimized_queue_trucks": staggered["max_queue"],
        "queue_reduction_percent": reduction,
        "recommended_stagger_minutes": stagger_intervals_minutes,
        "wait_ci95": staggered["wait_ci95"],
        "method": "seeded discrete-event queue simulation",
        "dispatch_slots": schedule,
    }


# ═════════════════════════════════════════════════════════════════════
# 2. WASTE FORECAST — HEURISTIC (deterministic, test-validated)
# ═════════════════════════════════════════════════════════════════════

def forecast_waste_risk(
    baseline_tons: float,
    rainfall_mm: float,
    expected_attendance: int,
    is_weekend: bool,
) -> dict[str, Any]:
    spike = 0.0
    factors: list[str] = []

    if rainfall_mm >= 30:
        spike += 0.16
        factors.append("Heavy rainfall adds flood-related waste and slows collection (+16%).")
    elif rainfall_mm >= 10:
        spike += 0.08
        factors.append("Rainfall may slow collection and increase wet waste (+8%).")

    if expected_attendance >= 50_000:
        spike += 0.18
        factors.append("Large permitted event increases waste around crowded areas (+18%).")
    elif expected_attendance >= 10_000:
        spike += 0.09
        factors.append("Medium event increases localized waste generation (+9%).")

    if is_weekend:
        spike += 0.07
        factors.append("Weekend activity raises commercial and public-space waste (+7%).")

    spike_percent = round(spike * 100)
    predicted_tons = round(baseline_tons * (1 + spike), 1)
    risk_level = "normal"
    if spike_percent >= 30:
        risk_level = "critical"
    elif spike_percent >= 20:
        risk_level = "high"
    elif spike_percent >= 10:
        risk_level = "watch"

    extra_trucks = max(0, round((predicted_tons - baseline_tons) / 18))
    
    # Estimate operational requirements (Case 2: man-hours, crews, facilities)
    # 1 truck carries 18 tons. Crew size = 4 people per truck.
    # 1 crew works 8 hours. Man-hours = crews * 8.
    crews_needed = int(np.ceil(predicted_tons / 18))
    man_hours = crews_needed * 8
    disposal_bins_needed = int(np.ceil(predicted_tons / 2.5))  # 2.5 tons per large trash bin

    return {
        "baseline_tons": baseline_tons,
        "predicted_tons": predicted_tons,
        "spike_percent": spike_percent,
        "risk_level": risk_level,
        "factors": factors or ["No unusual driver detected."],
        "recommended_extra_trucks": extra_trucks,
        "recommended_extra_crews": max(0, round(extra_trucks / 2)),
        "man_hours_required": man_hours,
        "crews_required": crews_needed,
        "disposal_bins_required": disposal_bins_needed,
        "fuel_consumption_liters": round(predicted_tons * 1.8, 1),
        "co2_emissions_kg": round(predicted_tons * 1.8 * 2.68, 1), # 2.68 kg CO2 per liter solar
    }


# ═════════════════════════════════════════════════════════════════════
# 3. WASTE FORECAST — HYBRID ML (Prophet + XGBoost per kelurahan)
# ═════════════════════════════════════════════════════════════════════

def predict_waste_hybrid(
    kelurahan: str,
    rainfall_mm: float = 0,
    temp_max_c: float = 31.0,
    wind_max_kmh: float = 10.0,
    is_weekend: bool = False,
    is_holiday: bool = False,
    event_attendance: int = 0,
    target_date: str | None = None,
) -> dict[str, Any]:
    slug = kelurahan.lower().replace(" ", "_")
    models = _load_hybrid(slug)

    if models is None:
        # Fallback when a model file is missing: coarse heuristic, clearly labeled.
        fallback_baseline = 150.0
        prophet_pred = fallback_baseline * (1.05 if is_weekend else 1.0)
        residual_pred = (rainfall_mm * 1.2) + (event_attendance * 0.003)
        predicted_tons = max(0.0, round(float(prophet_pred + residual_pred), 1))
        
        # Calculate requirements
        crews = int(np.ceil(predicted_tons / 18))
        man_hours = crews * 8
        bins = int(np.ceil(predicted_tons / 2.5))
        
        return {
            "kelurahan": kelurahan,
            "model_available": False,
            "prophet_baseline_tons": round(float(prophet_pred), 1),
            "xgboost_residual": round(float(residual_pred), 1),
            "predicted_tons": predicted_tons,
            "prediction_interval_p10_p90": [round(predicted_tons * 0.6, 1), round(predicted_tons * 1.4, 1)],
            "daily_district_suitability": "not_supported_fallback_heuristic",
            "features_used": {
                "precipitation_mm": rainfall_mm,
                "temp_max_c": temp_max_c,
                "wind_max_kmh": wind_max_kmh,
                "is_weekend": int(is_weekend),
                "is_holiday": int(is_holiday),
                "event_attendance": event_attendance
            },
            "factors": ["Model files missing; loaded robust statistical fallback heuristics for demo."],
            "man_hours_required": man_hours,
            "crews_required": crews,
            "disposal_bins_required": bins,
            "fuel_consumption_liters": round(predicted_tons * 1.8, 1),
            "co2_emissions_kg": round(predicted_tons * 1.8 * 2.68, 1)
        }

    prophet_model, xgboost_model = models
    from_date = pd.Timestamp(target_date) if target_date else pd.Timestamp.now()

    # Prophet baseline prediction
    ds_df = pd.DataFrame({"ds": [from_date]})
    prophet_pred = prophet_model.predict(ds_df)["yhat"].values[0]

    # XGBoost residual correction
    X_features = pd.DataFrame([{
        "precipitation_mm": rainfall_mm,
        "temp_max_c": temp_max_c,
        "wind_max_kmh": wind_max_kmh,
        "is_weekend": int(is_weekend),
        "is_holiday": int(is_holiday),
        "event_attendance": event_attendance,
    }])
    residual_pred = xgboost_model.predict(X_features)[0]

    predicted_tons = max(0.0, round(float(prophet_pred + residual_pred), 1))

    factors: list[str] = []
    if rainfall_mm >= 30:
        factors.append(f"Heavy rainfall (+{round(residual_pred):.0f}t residual correction from XGBoost).")
    elif rainfall_mm >= 10:
        factors.append(f"Moderate rainfall contributing to wet-waste increase.")
    if event_attendance >= 50_000:
        factors.append(f"Major event ({event_attendance:,} attendees) spiking localized volume.")
    elif event_attendance >= 10_000:
        factors.append(f"Moderate event ({event_attendance:,} attendees) adding to baseline.")
    if is_weekend:
        factors.append("Weekend cycle activated (Prophet weekly seasonality).")
    if is_holiday:
        factors.append("National holiday detected — reduced commercial waste, possible spike from public gatherings.")

    # Requirements calculations
    crews = int(np.ceil(predicted_tons / 18))
    man_hours = crews * 8
    bins = int(np.ceil(predicted_tons / 2.5))

    # Honest uncertainty band: daily-district resolution is calibrated-synthetic,
    # so expose a wide interval and a suitability flag instead of a point claim.
    lo = round(predicted_tons * 0.75, 1)
    hi = round(predicted_tons * 1.25, 1)

    return {
        "kelurahan": kelurahan,
        "model_available": True,
        "prophet_baseline_tons": round(float(prophet_pred), 1),
        "xgboost_residual": round(float(residual_pred), 1),
        "predicted_tons": predicted_tons,
        "prediction_interval_p10_p90": [lo, hi],
        "daily_district_suitability": "not_supported_calibrated_synthetic",
        "features_used": dict(X_features.iloc[0]),
        "factors": factors or ["Prophet baseline trend stable; no exceptional drivers."],
        "man_hours_required": man_hours,
        "crews_required": crews,
        "disposal_bins_required": bins,
        "fuel_consumption_liters": round(predicted_tons * 1.8, 1),
        "co2_emissions_kg": round(predicted_tons * 1.8 * 2.68, 1)
    }


def list_hybrid_models() -> list[dict[str, Any]]:
    results = []
    for slug in _KELURAHAN_SLUGS:
        p_exists = (MODELS_DIR / f"prophet_{slug}.joblib").exists()
        x_exists = (MODELS_DIR / f"xgboost_{slug}.joblib").exists()
        results.append({
            "kelurahan": slug.replace("_", " ").title(),
            "slug": slug,
            "prophet_available": p_exists,
            "xgboost_available": x_exists,
            "hybrid_available": p_exists and x_exists,
        })
    return results


# ═════════════════════════════════════════════════════════════════════
# 4. DISPATCH CENTER
# ═════════════════════════════════════════════════════════════════════

@dataclass
class DispatchCenter:
    _dispatches: list[dict[str, Any]] = field(default_factory=list)

    def create_dispatch(self, truck_code: str, instruction: str, manager_id: str) -> dict[str, Any]:
        dispatch = {
            "id": str(uuid4()),
            "truck_code": truck_code,
            "instruction": instruction,
            "manager_id": manager_id,
            "field_status": "PENDING",
            "confirmed_note": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "confirmed_at": None,
        }
        self._dispatches.append(dispatch)
        return dispatch

    def confirm(self, dispatch_id: str, status: str, note: str = "") -> dict[str, Any]:
        for dispatch in self._dispatches:
            if dispatch["id"] == dispatch_id:
                dispatch["field_status"] = status
                dispatch["confirmed_note"] = note
                dispatch["confirmed_at"] = datetime.now(timezone.utc).isoformat()
                return dispatch
        raise KeyError(f"Dispatch {dispatch_id} was not found.")

    def pending_for_truck(self, truck_code: str) -> list[dict[str, Any]]:
        return [
            d for d in self._dispatches
            if d["truck_code"] == truck_code and d["field_status"] == "PENDING"
        ]

    def audit_log(self) -> list[dict[str, Any]]:
        return list(self._dispatches)
