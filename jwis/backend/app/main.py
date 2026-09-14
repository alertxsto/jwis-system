# -*- coding: utf-8 -*-
"""
main.py — FastAPI application routing.
Includes advanced DLH Case 1 & Case 2 features:
- Prophet + XGBoost ML Hybrid prediction per kelurahan
- Landfill Staggered Dispatch Simulator & OSRM ETA adjustments
- Crew Man-Hours, fuel, and facility requirements planner
- WhatsApp Alerts Hook
- Export Summary Report
"""
from __future__ import annotations

from dotenv import load_dotenv
load_dotenv()
import os
key = os.getenv("OPENAI_API_KEY", "")
print("JWIS STARTUP CWD:", os.getcwd())
print("JWIS STARTUP API_KEY EXISTS:", bool(key))
print("JWIS STARTUP API_KEY VALUE:", (key[:6] + "..." + key[-4:]) if key else "None")
print("JWIS STARTUP BASE_URL:", os.getenv("OPENAI_BASE_URL"))

import json
import logging
import re
import threading
import time
from datetime import date
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.data import build_predictions, build_alerts, command_center_snapshot, TRUCKS, ROUTE_OPTIONS, fleet_history_payload, tpa_queue_status_payload, events_permits_payload, unlicensed_collectors_payload, _route_b_osrm
from app.engine import (
    predict_waste_hybrid,
    predict_waste_hybrid_series,
    list_hybrid_models,
    estimate_tpa_queue_wait,
    simulate_staggered_dispatch,
    forecast_waste_risk,
    DispatchCenter
)
from app.astar_routing import reroute_payload
from app.gps_feed import latest_breadcrumbs
from app.cv_surveillance import surveillance_status
from app.map_truth import build_map_truth, _snapped_for
from app.queue_simulation import simulate_queue
from app.operations_optimizer import Demand, Vehicle, build_operational_plan
from app.forecast_metrics import suitability_labels
from app.auth import ROLES, authenticate, has_permission, token_for, role_for_token
from app.impact import build_impact_report
from app.osrm import fetch_osrm_route
from app.weather import fetch_jakarta_weather_forecast
from app.assistant import answer_with_openai_if_configured, build_executive_summary
from app.storage import HistoryStore
from app.whatsapp import OpenWAClient, build_alert_message
from app.real_data import data_provenance, load_official_events, load_city_timbulan, load_fleet_composition, load_kecamatan_map, build_provenance_records, load_kelurahan_heatmap, load_real_tps_coordinates, load_real_wr_coordinates
from app.astar_routing import is_traffic_jam_active, set_traffic_jam_active
from app.ai.actions.auto_reroute import AutoRerouter, note_manual_override
from app.ai.actions.auto_state import EVENT_FEED
from app.ai.detectors.deviation_trigger import DeviationTrigger
from app.ai.detectors.speed_anomaly import SpeedAnomalyDetector
from app.ai.detectors.stop_pattern import StopPatternDetector
from app.ai.engine_loop import maybe_start_engine
from app.ai.forecasters.event_impact import EventImpactForecaster
from app.ai.forecasters.fuel_model import CarbonCalculator
from app.ai.forecasters.queue_predictor import TpaQueuePredictor
from app.spj import SPJ_STORE, active_path_for as spj_active_path, \
    spj_summary_payload
from dataclasses import asdict as _asdict

app = FastAPI(title="JWIS FastAPI Backend", version="2.5.0")
history_store = HistoryStore()
dispatch_center = DispatchCenter()


@app.on_event("startup")
def _warm_route_cache() -> None:
    """Warm OSRM caches (A* edges + per-truck map-truth routes) in a background
    thread so the first live demo request is fast, never blocking on cold OSRM."""
    print("Warming predictions on main thread...")
    try:
        from app.data import build_predictions
        build_predictions()
        print("Predictions warmed successfully.")
    except Exception as e:
        print("Predictions warmup failed:", e)

    # Necessary: predictions warm the /api/predictions/kecamatan default cache
    # key (rainfall=0, no event, not weekend) so the first browser request never
    # pays a cold 42-model load. Must run on the MAIN thread: xgboost predict
    # spawns joblib workers, and Windows hangs when that happens from a daemon
    # thread (observed: warm loop stuck forever, spawning zombie processes).
    try:
        from app.engine import predict_waste_hybrid
        from app.real_data import load_kecamatan_map
        for k in load_kecamatan_map():
            predict_waste_hybrid(kelurahan=k["slug"], rainfall_mm=0.0, event_attendance=0, is_weekend=False)
        print("Kecamatan predictions warmed.")
    except Exception as e:
        print("Kecamatan predictions warmup failed:", e)

    try:
        from app.rag import build_rag_index
        build_rag_index()
        print("RAG index warmed.")
    except Exception as e:
        print("RAG warmup failed:", e)

    # Necessary: pre-builds the command-center snapshot (42-model predictions,
    # weather fetch, queue sim) so the first client request hits the 8s cache
    # instead of paying a ~10s cold build that trips the frontend's fetch cap
    # and empties the forecast weather strip (e2e layout timeouts).
    try:
        command_center()
        print("Command center cache warmed.")
    except Exception as e:
        print("Command center warmup failed:", e)

    # Necessary: pre-fills the keyed kecamatan predictions cache (the forecast
    # workspace's first request) and the TPA marker cache so e2e pages that
    # mount at t=0 of the suite never wait on a cold 42-model build.
    try:
        predictions_kecamatan(rainfall_mm=42, event_attendance=85000, is_weekend=True)
        print("Kecamatan endpoint cache warmed.")
    except Exception as e:
        print("Kecamatan endpoint warmup failed:", e)
    try:
        _tpa_cache["payload"] = tpa_queue_status_payload()
        _tpa_cache["ts"] = time.time()
        print("TPA cache warmed.")
    except Exception as e:
        print("TPA warmup failed:", e)

    import threading
    from app.astar_routing import warm_edge_cache

    def _warm():
        warm_edge_cache()
        try:
            _route_b_osrm()
            print("Route B warm cache ready.")
        except Exception as e:
            print("Route B warmup failed:", e)
        from concurrent.futures import ThreadPoolExecutor
        try:
            with ThreadPoolExecutor(max_workers=8) as ex:
                list(ex.map(build_map_truth, TRUCKS))
            fleet_map_truth()  # fill the payload cache too, not just per-truck caches
            print("Map truth warm cache ready.")
        except Exception as e:
            print("Map truth warmup failed:", e)

    threading.Thread(target=_warm, daemon=True).start()

    # Necessary: keeps the 30s snap cache perpetually fresh so request threads
    # never pay a cold OSRM snap fetch (public OSRM is slow; 6 parallel
    # map-truth calls each took ~6s during the cold window, stalling the
    # threadpool and tripping the frontend's 6s fetch abort). Pure I/O, so it
    # is safe in a daemon thread (no joblib/xgboost involved).
    def _snap_refresher():
        import time as _time
        from app.data import ASSIGNED_PATHS as _CURATED
        curated_codes = list(_CURATED.keys())
        idx = 0
        while True:
            _time.sleep(15)
            try:
                truck = next((t for t in TRUCKS if t["truck_code"] == curated_codes[idx % len(curated_codes)]), None)
                if truck is not None:
                    _snapped_for(truck)
            except Exception:
                pass
            idx += 1

    threading.Thread(target=_snap_refresher, daemon=True).start()

import os

_ALLOWED_ORIGINS = os.getenv(
    "JWIS_ALLOWED_ORIGINS",
    "http://localhost:5175,http://127.0.0.1:5175,http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# dispatch_center is instantiated below

# ── Request Models ───────────────────────────────────────────────────

class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list, max_length=8)
    file_data: str | None = Field(default=None, max_length=30_000_000)
    file_type: str | None = Field(default=None, pattern="^(image|pdf)$")

class WhatsAppAlertRequest(BaseModel):
    truck_code: str = Field(min_length=1, max_length=20)
    issue: str = Field(min_length=1, max_length=500)
    recommendation: str = Field(min_length=1, max_length=500)
    chat_id: str = "6289675877496@c.us" # User direct chat ID

class DispatchRequest(BaseModel):
    truck_code: str = Field(min_length=1, max_length=20)
    instruction: str = Field(min_length=1, max_length=500)
    manager_id: str = Field(default="manager_central", min_length=1, max_length=50)

class DispatchConfirmRequest(BaseModel):
    status: str = Field(min_length=1, max_length=30)
    note: str = Field(default="", max_length=500)

class HybridPredictRequest(BaseModel):
    kelurahan: str = Field(min_length=1, max_length=50)
    precipitation_mm: float = Field(default=0.0, ge=0, le=1000)
    temp_max_c: float = Field(default=31.0, ge=-10, le=60)
    wind_max_kmh: float = Field(default=10.0, ge=0, le=300)
    is_weekend: bool = False
    is_holiday: bool = False
    event_attendance: int = Field(default=0, ge=0, le=5_000_000)
    target_date: date | None = None

class EventPermitRequest(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    location_name: str = Field(min_length=3, max_length=160)
    event_date: date
    expected_attendance: int = Field(gt=0, le=2_000_000)
    lat: float = Field(ge=-7.5, le=-5.5)
    lng: float = Field(ge=105.5, le=108.0)
    organizer: str | None = Field(default=None, max_length=120)

# ── Existing Endpoints ───────────────────────────────────────────────

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "service": "jwis-backend", "version": "2.5.0"}

@app.get("/api/health/detailed")
def health_detailed() -> dict[str, Any]:
    """Dependency-aware health: database, models, source files, weather, OSRM."""
    from pathlib import Path as _Path
    models_dir = _Path(__file__).resolve().parents[1] / "data" / "models"
    prophet_n = len(list(models_dir.glob("prophet_*.joblib"))) if models_dir.exists() else 0
    xgb_n = len(list(models_dir.glob("xgboost_*.joblib"))) if models_dir.exists() else 0
    real_dir = _Path(__file__).resolve().parents[2] / "data" / "real"
    source_files = len(list(real_dir.glob("*.csv"))) + len(list(real_dir.glob("*.geojson"))) if real_dir.exists() else 0
    db_ok = True
    try:
        history_store.list_events(limit=1)
    except Exception:
        db_ok = False
    components = {
        "database": {"status": "up" if db_ok else "degraded"},
        "models": {"available": prophet_n == 42 and xgb_n == 42, "prophet": prophet_n, "xgboost": xgb_n},
        "source_files": {"count": source_files, "status": "up" if source_files >= 8 else "degraded"},
        "weather": {"status": "external", "note": "Open-Meteo fetched on demand with fallback"},
        "osrm": {"status": "external", "note": "public OSRM with fallback route"},
    }
    degraded = (not db_ok) or prophet_n != 42 or xgb_n != 42 or source_files < 8
    return {"status": "degraded" if degraded else "healthy", "components": components}

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=200)

@app.post("/api/auth/login")
def auth_login(payload: LoginRequest) -> dict[str, Any]:
    """Backend role-aware login; replaces the frontend-only admin gate."""
    principal = authenticate(payload.username, payload.password)
    if principal is None:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    return {
        "username": principal["username"],
        "role": principal["role"],
        "permissions": sorted(ROLES[principal["role"]]),
        "token": token_for(principal),
    }


def require_permission(permission: str):
    """FastAPI dependency: 401 if no valid token, 403 if role lacks the permission."""
    def _dep(authorization: str | None = Header(default=None)) -> str:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Missing bearer token.")
        token = authorization.split(" ", 1)[1].strip()
        role = role_for_token(token)
        if role is None:
            raise HTTPException(status_code=401, detail="Invalid or expired token.")
        if not has_permission(role, permission):
            raise HTTPException(status_code=403, detail=f"Role '{role}' lacks '{permission}'.")
        return role
    return _dep

@app.get("/api/data/provenance")
def data_provenance_endpoint() -> dict[str, Any]:
    """Transparency: which real government datasets are currently loaded."""
    return {
        "provenance": data_provenance(),
        "records": build_provenance_records(),
        "city_timbulan": load_city_timbulan(),
    }

_kecamatan_cache: dict[str, Any] = {"key": None, "ts": 0.0, "payload": None}

@app.get("/api/predictions/kecamatan")
def predictions_kecamatan(
    rainfall_mm: float = Query(0.0, ge=0),
    event_attendance: int = Query(0, ge=0),
    is_weekend: bool = False,
    is_holiday: bool = False,
    target_date: date | None = None,
    event_lat: float | None = Query(None),
    event_lng: float | None = Query(None),
    horizon_days: int | None = Query(None, ge=2, le=30),
) -> dict[str, Any]:
    """Case 2 temporal-spatial map: per-kecamatan hybrid ML prediction over the
    real 42-kecamatan SILIKA baseline, with facility-readiness recommendation.

    Each kecamatan gets a live Prophet+XGBoost prediction plus operational needs
    (crews, man-hours, extra trucks) and a TPS capacity signal. When
    `horizon_days` is given, each kecamatan also carries a real per-day model
    series (weekday/holiday drivers vary per day) plus horizon aggregates.
    """
    from fastapi.params import Query as FastAPIQuery
    if isinstance(horizon_days, FastAPIQuery):
        horizon_days = None
    cache_key = (rainfall_mm, event_attendance, is_weekend, is_holiday, target_date, event_lat, event_lng, horizon_days)
    now = time.time()
    if _kecamatan_cache["key"] == cache_key and now - _kecamatan_cache["ts"] < 60.0:
        return _kecamatan_cache["payload"]

    kecs = load_kecamatan_map()
    
    target_slugs = set()
    if event_attendance > 0:
        from fastapi.params import Query as FastAPIQuery
        elat = -6.2183 if (isinstance(event_lat, FastAPIQuery) or event_lat is None) else event_lat
        elng = 106.8022 if (isinstance(event_lng, FastAPIQuery) or event_lng is None) else event_lng
        
        from app.engine import _haversine_meters
        closest_kec = None
        min_dist = float("inf")
        for k in kecs:
            klat = k.get("lat")
            klng = k.get("lng")
            if klat is not None and klng is not None:
                dist = _haversine_meters((elat, elng), (klat, klng))
                if dist <= 3500.0:
                    target_slugs.add(k["slug"])
                if dist < min_dist:
                    min_dist = dist
                    closest_kec = k
        if not target_slugs and closest_kec:
            target_slugs.add(closest_kec["slug"])

    features = []
    for k in kecs:
        current_attendance = event_attendance if k["slug"] in target_slugs else 0
        pred = predict_waste_hybrid(
            kelurahan=k["slug"],
            rainfall_mm=rainfall_mm,
            is_weekend=is_weekend,
            is_holiday=is_holiday,
            event_attendance=current_attendance,
            target_date=target_date.isoformat() if target_date else None,
        )
        tons = pred["predicted_tons"]
        cap = k.get("tps_capacity_ton_per_day")
        facility_alert = bool(cap is not None and tons > cap)
        horizon_block: dict[str, Any] = {}
        if horizon_days:
            series = predict_waste_hybrid_series(
                k["slug"],
                days=horizon_days,
                rainfall_mm=rainfall_mm,
                event_attendance=current_attendance,
                start_date=(target_date.isoformat() if target_date else None),
            )
            horizon_block = {
                "horizon_avg_daily_tons": series["avg_daily_tons"],
                "horizon_total_tons": series["total_tons"],
                "horizon_peak_date": series["peak_date"],
                "horizon_peak_tons": series["peak_tons"],
                "daily_series": series["series"],
            }
        features.append({
            **k,
            "predicted_tons": tons,
            **horizon_block,
            "model_available": pred["model_available"],
            "crews_required": pred["crews_required"],
            "man_hours_required": pred["man_hours_required"],
            "disposal_bins_required": pred["disposal_bins_required"],
            "trucks_required": max(1, round(tons / 18)),
            "facility_over_capacity": facility_alert,
            "prophet_baseline_tons": pred.get("prophet_baseline_tons"),
            "xgboost_residual": pred.get("xgboost_residual"),
            "factor_attribution": pred.get("factor_attribution"),
            "factors": pred.get("factors"),
            "prediction_interval_p10_p90": pred.get("prediction_interval_p10_p90"),
            "co2_emissions_kg": pred.get("co2_emissions_kg"),
            "fuel_consumption_liters": pred.get("fuel_consumption_liters"),
            "daily_district_suitability": pred.get("daily_district_suitability"),
        })
    features.sort(key=lambda f: f["predicted_tons"], reverse=True)
    total = sum(f["predicted_tons"] for f in features)
    # Necessary: each uncached build runs 42 model predicts (~1-3s), and 4
    # parallel workers can each issue one on mount; the 60s keyed cache keeps
    # repeated identical requests (the common case) at near-zero cost.
    _kecamatan_cache["key"] = cache_key
    _kecamatan_cache["ts"] = time.time()
    _kecamatan_cache["payload"] = {
        "generated_for": (target_date.isoformat() if target_date else date.today().isoformat()),
        "horizon_days": horizon_days or 1,
        "scenario": {
            "rainfall_mm": rainfall_mm, "event_attendance": event_attendance,
            "is_weekend": is_weekend, "is_holiday": is_holiday,
            "event_lat": event_lat, "event_lng": event_lng,
        },
        "kecamatan_count": len(features),
        "total_predicted_tons": round(total, 1),
        "top_hotspots": features[:5],
        "kecamatan": features,
        "source": "SILIKA DLH 2023 baseline + Prophet/XGBoost hybrid (real 5yr pipeline)",
    }
    return _kecamatan_cache["payload"]

@app.get("/api/fleet/composition")
def fleet_composition() -> dict[str, Any]:
    """Real DKI waste-truck fleet census (Case 1 grounding)."""
    return load_fleet_composition()

@app.get("/api/events/official")
def official_events() -> list[dict[str, Any]]:
    """Real, officially-scraped Jakarta events (attendance may be unknown)."""
    return load_official_events()

# Necessary: the snapshot costs ~3.2s (42 models + per-truck OSRM reroutes), so
# parallel dashboard clients (e.g. the 4 Playwright workers) would each recompute
# it and stall. An 8s TTL shares one computation while keeping truck motion live
# (position liveness comes from /api/map-truth and the feed, not this snapshot).
_command_center_lock = threading.Lock()
_command_center_cache: dict[str, Any] = {"ts": 0.0, "payload": None}

@app.get("/api/command-center")
def command_center() -> dict:
    cached = _command_center_cache
    now = time.time()
    if cached["payload"] is None or now - cached["ts"] > 8.0:
        with _command_center_lock:
            now = time.time()
            if cached["payload"] is None or now - cached["ts"] > 8.0:
                dispatches = dispatch_center.audit_log()
                cached["payload"] = command_center_snapshot(dispatches, weather=fetch_jakarta_weather_forecast())
                cached["ts"] = time.time()
    return cached["payload"]

@app.get("/api/fleet")
def fleet() -> list[dict]:
    from app.data import get_dynamic_trucks
    return get_dynamic_trucks()


@app.get("/api/fleet/status-overview")
def fleet_status_overview() -> dict[str, Any]:
    """Case 1 'position AND activity' + fleet damage status: fleet-wide roll-up
    of operational activity states and maintenance condition."""
    from app.data import get_dynamic_trucks
    trucks = get_dynamic_trucks()
    by_activity: dict[str, int] = {}
    for t in trucks:
        state = t.get("activity", {}).get("state", "unknown")
        by_activity[state] = by_activity.get(state, 0) + 1
    damaged = [t for t in trucks if t.get("is_damaged")]
    return {
        "total_trucks": len(trucks),
        "by_activity": by_activity,
        "damaged_count": len(damaged),
        "damaged_trucks": [
            {
                "truck_code": t["truck_code"],
                "driver_name": t["driver_name"],
                "vehicle_type": t.get("vehicle_type"),
                "damage_status": t.get("damage_status"),
            }
            for t in damaged
        ],
        "activity_labels": {t["truck_code"]: t.get("activity") for t in trucks},
        "telemetry_class": "SIMULATED fleet telemetry on real census mix; not live AVL",
    }

@app.get("/api/predictions")
def predictions(
    date: str | None = Query(None, description="Filter predictions by date (YYYY-MM-DD)"),
    event_scale: float | None = Query(None, ge=0.5, le=3.0, description="Simulate an event multiplier (0.5x - 3.0x)")
) -> list[dict]:
    """
    Enhanced waste prediction endpoint supporting dynamic simulation and filtering.
    """
    preds = build_predictions()
    
    # Apply dynamic parameters
    if date:
        preds = [p for p in preds if p["date"] == date]
        
    if event_scale is not None:
        for p in preds:
            # Recalculate baseline waste under custom simulated event load
            new_attendance = int(85000 * event_scale) if p.get("spike_percent", 0) > 10 else 0
            risk = forecast_waste_risk(
                baseline_tons=p["baseline_tons"],
                rainfall_mm=42.0 if event_scale > 1.5 else 5.0,
                expected_attendance=new_attendance,
                is_weekend=p["date"] == date
            )
            p.update(risk)
            
    return preds

@app.get("/api/routes/osrm")
def osrm_route() -> dict:
    return fetch_osrm_route(
        "Route B - Daan Mogot Recovery",
        origin=(-6.221, 106.785),
        destination=(-6.195, 106.802),
    )

@app.get("/api/geo/kelurahan-heatmap")
def kelurahan_heatmap(
    rainfall_mm: float = Query(0.0, ge=0),
    event_attendance: int = Query(0, ge=0),
    is_weekend: bool = False,
    is_holiday: bool = False,
    event_lat: float | None = Query(None),
    event_lng: float | None = Query(None),
) -> JSONResponse:
    """267-kelurahan risk heatmap joined to real SILIKA kecamatan baselines."""
    try:
        preds = predictions_kecamatan(
            rainfall_mm=rainfall_mm,
            event_attendance=event_attendance,
            is_weekend=is_weekend,
            is_holiday=is_holiday,
            event_lat=event_lat,
            event_lng=event_lng,
        )
        kec_predictions = {k["kecamatan"]: k["predicted_tons"] for k in preds["kecamatan"]}
        return JSONResponse(load_kelurahan_heatmap(kec_predictions))
    except (OSError, ValueError):
        fallback = Path(__file__).resolve().parents[2] / "data" / "raw" / "jakarta_kelurahan_heatmap.geojson"
        if fallback.exists():
            return JSONResponse(json.loads(fallback.read_text(encoding="utf-8")))
        raise HTTPException(status_code=404, detail="Kelurahan heatmap GeoJSON has not been generated.")

@app.get("/api/facilities/gap-analysis")
def facility_gap_analysis(
    rainfall_mm: float = Query(0.0, ge=0),
    event_attendance: int = Query(0, ge=0),
    is_weekend: bool = False,
) -> dict[str, Any]:
    """Case 2 facility readiness: predicted demand vs TPS capacity proxy per
    kecamatan, with concrete new-site counts, extra trucks, and kelurahan
    siting candidates. Capacity is a labeled proxy, never official capacity."""
    from app.facility_planning import build_facility_gap_analysis
    preds = predictions_kecamatan(
        rainfall_mm=rainfall_mm,
        event_attendance=event_attendance,
        is_weekend=is_weekend,
    )
    kec_predictions = {k["kecamatan"]: k["predicted_tons"] for k in preds["kecamatan"]}
    result = build_facility_gap_analysis(kec_predictions)
    result["scenario"] = {
        "rainfall_mm": rainfall_mm,
        "event_attendance": event_attendance,
        "is_weekend": is_weekend,
    }
    return result

@app.get("/api/weather")
def weather() -> dict:
    return fetch_jakarta_weather_forecast()

@app.post("/api/assistant/query")
async def assistant_query(payload: AssistantRequest) -> dict:
    # Run everything synchronously on the main thread to avoid Session 0 threadpool deadlock
    print("SYNC STEP 1: Route start")
    try:
        from app.tools import ToolContext
        weather = fetch_jakarta_weather_forecast()
        print("SYNC STEP 2: Weather done")
        snapshot = command_center_snapshot(dispatch_center.audit_log(), weather=weather)
        print("SYNC STEP 3: Snapshot done")
        tool_ctx = ToolContext(dispatch_center=dispatch_center, history_store=history_store)
        images = None
        if payload.file_data and payload.file_type:
            from app.pdf_vision import resolve_file_to_images
            images = resolve_file_to_images(payload.file_data, payload.file_type)
        result = answer_with_openai_if_configured(
            payload.question, snapshot, history=payload.history, tool_ctx=tool_ctx,
            images=images
        )
        print("SYNC STEP 4: OpenAI done")
    except Exception as e:
        print("SYNC STEP ERROR:", str(e))
        raise HTTPException(status_code=502, detail=f"AI gateway error: {e}") from e

    if result.get("provider") == "error":
        raise HTTPException(status_code=502, detail=f"AI gateway error: {result.get('error', 'unknown')}")

    history_store.record_event(
        "assistant_query",
        {"question": payload.question, "provider": result["provider"]}
    )
    return result

@app.get("/api/reports/executive-summary")
def executive_summary() -> dict:
    snapshot = command_center_snapshot(dispatch_center.audit_log(), weather=fetch_jakarta_weather_forecast())
    summary = build_executive_summary(snapshot)
    
    from app.assistant import _top_prediction
    top = _top_prediction(snapshot)
    top_district = top.get("district", "Jakarta Barat")
    top_spike = top.get("spike_percent", 41)
    extra_trucks = top.get("recommended_extra_trucks", 28)
    extra_crews = top.get("recommended_extra_crews", 14)
    tpa_wait = snapshot["kpis"]["tpa_wait_minutes"]
    summary_id = (
        f"JWIS mendeteksi {snapshot['kpis']['trucks_with_issues']} kendala operasional di lapangan. "
        f"Proyeksi peningkatan volume sampah puncak sebesar {top_spike}% terjadi di {top_district}, didorong curah hujan/event, "
        f"yang membutuhkan {extra_trucks} armada truk tambahan. "
        f"Antrian di Bantargebang saat ini mencapai {tpa_wait} menit. Direkomendasikan implementasi staggered dispatch "
        f"untuk mereduksi beban TPA dan pengerahan {extra_crews} tim kru tambahan ke kelurahan terdampak."
    )
    
    history_store.record_event("executive_summary", {"summary": summary})
    impact = simulate_staggered_dispatch(int(snapshot["kpis"]["active_trucks"]))

    preds = predictions_kecamatan(rainfall_mm=0.0, event_attendance=0)
    hotspots = [
        {
            "kecamatan": h["kecamatan"],
            "city": h["city"],
            "predicted_tons": h["predicted_tons"],
            "trucks_required": h["trucks_required"],
            "crews_required": h["crews_required"],
            "man_hours_required": h["man_hours_required"],
            "facility_readiness": h.get("facility_readiness"),
        }
        for h in preds["top_hotspots"][:5]
    ]
    from app.facility_planning import build_facility_gap_analysis
    gap = build_facility_gap_analysis({k["kecamatan"]: k["predicted_tons"] for k in preds["kecamatan"]})
    fleet_status = fleet_status_overview()
    return {
        "summary": summary_id,
        "summary_en": summary,
        "queue_impact": impact,
        "top_hotspots": hotspots,
        "facility_summary": gap["summary"],
        "fleet_status": {
            "total_trucks": fleet_status["total_trucks"],
            "by_activity": fleet_status["by_activity"],
            "damaged_count": fleet_status["damaged_count"],
        },
        "model_suitability_note": (
            "District-daily figures are calibrated-synthetic anchored to real SILIKA 2023 "
            "baselines; weekly/monthly and hotspot-rank resolutions are the supported "
            "decision levels (see /api/ml/suitability)."
        ),
    }

@app.get("/api/history")
def history() -> list[dict]:
    return history_store.list_events()

FOLLOW_UP_STATUSES = {"OPEN", "DISPATCHED", "RESOLVED"}

@app.get("/api/alert/follow-ups")
def alert_follow_ups() -> list[dict]:
    """Audit trail of alert follow-ups (OPEN -> DISPATCHED -> RESOLVED)."""
    return [
        event for event in history_store.list_events(limit=200)
        if event["event_type"] == "alert_followup"
    ]

@app.post("/api/alert/follow-up")
def alert_follow_up(payload: dict[str, Any]) -> dict[str, Any]:
    """Record a supervisor follow-up action (status + operator + note)."""
    alert_id = str(payload.get("alert_id", "")).strip()
    status = str(payload.get("status", "OPEN")).upper()
    if status not in FOLLOW_UP_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(FOLLOW_UP_STATUSES)}")
    if not alert_id:
        raise HTTPException(status_code=400, detail="alert_id is required")
    record = {
        "alert_id": alert_id,
        "status": status,
        "operator": str(payload.get("operator", "dispatcher")).strip() or "dispatcher",
        "note": str(payload.get("note", "")).strip(),
    }
    history_store.record_event("alert_followup", record)
    return {"recorded": True, **record}

CONTACTS_FILE = "driver_contacts.json"
DEFAULT_CONTACTS = {
    "drivers": {
        "Budi Santoso": "6289675877496@c.us",
        "Agus Pratama": "6289675877496@c.us",
        "Joko Wijaya": "6289675877496@c.us",
        "Rizky Maulana": "6289675877496@c.us"
    },
    "group_jid": "6285229890542-1620000000@g.us",
    "send_to_group": True,
    "send_to_driver": True
}

def normalize_phone_number(raw: str) -> str:
    """Normalize operator input: '08xx', '+62xx', '628xx' -> '628xx@c.us'."""
    if not raw:
        return ""
    cleaned = re.sub(r"[^\d]", "", raw)
    if not cleaned:
        return ""
    if cleaned.startswith("0"):
        cleaned = "62" + cleaned[1:]
    if "@" not in cleaned:
        cleaned += "@c.us"
    return cleaned


def normalize_group_jid(raw: str) -> str:
    """Normalize group input: phone number -> '628xx@g.us', or keep full JID."""
    if not raw:
        return ""
    cleaned = raw.strip()
    if "@" in cleaned and cleaned.endswith("@g.us"):
        return cleaned
    digits = re.sub(r"[^\d]", "", cleaned)
    if not digits:
        return cleaned
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    if "@" not in digits:
        digits += "@g.us"
    return digits

def load_contacts():
    if not os.path.exists(CONTACTS_FILE):
        with open(CONTACTS_FILE, "w") as f:
            json.dump(DEFAULT_CONTACTS, f, indent=4)
        return DEFAULT_CONTACTS
    try:
        with open(CONTACTS_FILE, "r") as f:
            data = json.load(f)
        if isinstance(data.get("drivers"), dict):
            data["drivers"] = {name: normalize_phone_number(num) for name, num in data["drivers"].items()}
        data["group_jid"] = normalize_group_jid(data.get("group_jid", ""))
        return data
    except Exception:
        return DEFAULT_CONTACTS

def save_contacts(data):
    normalized = dict(data)
    if isinstance(normalized.get("drivers"), dict):
        normalized["drivers"] = {name: normalize_phone_number(num) for name, num in normalized["drivers"].items()}
    normalized["group_jid"] = normalize_group_jid(normalized.get("group_jid", ""))
    with open(CONTACTS_FILE, "w") as f:
        json.dump(normalized, f, indent=4)

def get_truck_info(truck_code: str) -> dict:
    from app.data import get_dynamic_trucks
    for t in get_dynamic_trucks():
        if t["truck_code"] == truck_code:
            return t
    return {
        "driver_name": "Supir JWIS",
        "plate_number": "B 1234 CD"
    }

@app.get("/api/whatsapp/contacts")
def get_whatsapp_contacts():
    return load_contacts()

@app.post("/api/whatsapp/contacts")
def post_whatsapp_contacts(payload: dict):
    save_contacts(payload)
    return {"status": "success"}

@app.get("/api/whatsapp/status")
def whatsapp_status() -> dict:
    client = OpenWAClient.from_env()
    health = client.health()
    return {
        "configured": client.is_configured(),
        "connected": health.get("connected", False),
        "message": health.get("message", ""),
        "provider": health.get("provider", "baileys"),
        "state": health.get("state"),
        "base_url": client.base_url,
        "session_id": client.session_id,
    }

@app.get("/api/whatsapp/qr")
def whatsapp_qr() -> dict:
    return OpenWAClient.from_env().qr()

@app.get("/api/whatsapp/groups")
def whatsapp_groups() -> dict:
    return OpenWAClient.from_env().groups()

@app.post("/api/whatsapp/logout")
def whatsapp_logout() -> dict:
    return OpenWAClient.from_env().logout()

@app.post("/api/whatsapp/alert")
def whatsapp_alert(payload: WhatsAppAlertRequest) -> dict:
    client = OpenWAClient.from_env()
    config = load_contacts()
    info = get_truck_info(payload.truck_code)
    
    driver_name = info.get("driver_name", "Supir JWIS")
    plate_number = info.get("plate_number", "B 1234 CD")
    
    responses = {}
    attempted = []
    
    # 1. Send to Driver
    if config.get("send_to_driver", True):
        driver_jid = config.get("drivers", {}).get(driver_name, "6289675877496@c.us")
        driver_msg = (
            f"Yth. Bapak {driver_name} (Supir Unit {payload.truck_code} / {plate_number}),\n"
            f"Anda terdeteksi mengalami kendala: {payload.issue}.\n"
            f"Rekomendasi rute/tindakan: {payload.recommendation}.\n"
            f"Harap segera respon di aplikasi JWIS Field App."
        )
        res_driver = client.send_text(driver_jid, driver_msg)
        responses["driver"] = res_driver
        attempted.append(("driver", res_driver))
        history_store.record_event("whatsapp_alert", {
            "recipient": f"Driver: {driver_name} ({driver_jid})",
            "truck_code": payload.truck_code,
            "sent": res_driver.get("sent", False),
            "message": res_driver.get("message", ""),
            "msg": driver_msg
        })
        
    # 2. Send to Group
    if config.get("send_to_group", True):
        group_jid = config.get("group_jid", "6285229890542-1620000000@g.us")
        group_msg = (
            "⚠️ JWIS OPERATIONAL ALERT ⚠️\n"
            f"Unit: {payload.truck_code} ({driver_name} / {plate_number})\n"
            f"Kendala: {payload.issue}\n"
            f"Rekomendasi Tindakan: {payload.recommendation}"
        )
        res_group = client.send_text(group_jid, group_msg)
        responses["group"] = res_group
        attempted.append(("group", res_group))
        history_store.record_event("whatsapp_alert", {
            "recipient": f"Group: {group_jid}",
            "truck_code": payload.truck_code,
            "sent": res_group.get("sent", False),
            "message": res_group.get("message", ""),
            "msg": group_msg
        })
        
    if not attempted:
        return {
            "status": "skipped",
            "sent": False,
            "message": "WhatsApp routing is disabled. Enable driver or group delivery.",
            "results": responses,
        }

    delivered = [name for name, result in attempted if result.get("sent")]
    failed = [f"{name}: {result.get('message', 'send failed')}" for name, result in attempted if not result.get("sent")]
    all_sent = len(delivered) == len(attempted)
    if all_sent:
        message = "WhatsApp alert delivered to " + ", ".join(delivered) + "."
    elif delivered:
        message = "WhatsApp alert partially delivered to " + ", ".join(delivered) + "; failed " + "; ".join(failed)
    else:
        message = "WhatsApp alert failed: " + "; ".join(failed)

    return {
        "status": "processed",
        "sent": all_sent,
        "partial": bool(delivered) and not all_sent,
        "message": message,
        "results": responses,
    }


@app.post("/api/whatsapp/alert/simulate")
def whatsapp_alert_simulate(payload: WhatsAppAlertRequest) -> dict:
    """Explicit demo-only simulation of a WhatsApp alert (clearly not a real send)."""
    msg = build_alert_message(payload.truck_code, payload.issue, payload.recommendation)
    return {
        "provider": "openwa-simulated",
        "sent": False,
        "simulated": True,
        "message": "Demo simulation only — no real WhatsApp message was sent.",
        "payload": {"recipient": payload.chat_id, "body": msg},
    }

@app.post("/api/dispatch")
def create_dispatch(payload: DispatchRequest) -> dict:
    d = history_store.save_dispatch(payload.truck_code, payload.instruction, payload.manager_id)
    dispatch_center._dispatches.append(d)
    history_store.record_event("dispatch_created", {"truck_code": payload.truck_code, "dispatch_id": d["id"]})
    return d

@app.get("/api/dispatch/{truck_code}")
def pending_dispatches(truck_code: str) -> list[dict]:
    return history_store.pending_dispatches(truck_code)

@app.post("/api/dispatch/{dispatch_id}/confirm")
def confirm_dispatch(dispatch_id: str, payload: DispatchConfirmRequest) -> dict:
    try:
        d = history_store.update_dispatch_status(dispatch_id, payload.status, payload.note)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    history_store.record_event("dispatch_confirmed", {"dispatch_id": dispatch_id, "status": payload.status})
    return d

# ── New Hybrid ML Endpoints ──────────────────────────────────────────
@app.get("/api/ml/models")
def ml_models_status() -> list[dict[str, Any]]:
    return list_hybrid_models()

@app.get("/api/ml/suitability")
def ml_suitability() -> dict[str, Any]:
    """Honest per-resolution suitability; daily-district is not claimed reliable."""
    return {
        "resolutions": suitability_labels(),
        "note": "Daily per-district resolution is calibrated-synthetic and must not be presented as observed accuracy.",
    }

@app.get("/api/impact")
def impact_report() -> dict[str, Any]:
    """Reproducible impact metrics with per-metric provenance and honest labels."""
    return build_impact_report()

@app.post("/api/ml/predict")
def ml_predict_district(payload: HybridPredictRequest) -> dict[str, Any]:
    res = predict_waste_hybrid(
        kelurahan=payload.kelurahan,
        rainfall_mm=payload.precipitation_mm,
        temp_max_c=payload.temp_max_c,
        wind_max_kmh=payload.wind_max_kmh,
        is_weekend=payload.is_weekend,
        is_holiday=payload.is_holiday,
        event_attendance=payload.event_attendance,
        target_date=payload.target_date.isoformat() if payload.target_date else None,
    )
    return res

@app.post("/api/ml/predict-all")
def ml_predict_all(
    precipitation_mm: float = 0.0,
    temp_max_c: float = 31.0,
    wind_max_kmh: float = 10.0,
    is_weekend: bool = False,
    is_holiday: bool = False,
    event_attendance: int = 0,
    target_date: date | None = None,
) -> list[dict[str, Any]]:
    models = list_hybrid_models()
    results = []
    for m in models:
        res = predict_waste_hybrid(
            kelurahan=m["kelurahan"],
            rainfall_mm=precipitation_mm,
            temp_max_c=temp_max_c,
            wind_max_kmh=wind_max_kmh,
            is_weekend=is_weekend,
            is_holiday=is_holiday,
            event_attendance=event_attendance,
            target_date=target_date.isoformat() if target_date else None,
        )
        results.append(res)
    return results

# ── Integrated Operations Optimizer (Case 2 -> Case 1 bridge) ────────

_OPERATIONS_PLANS: dict[str, dict[str, Any]] = {}


@app.post("/api/operations/plan")
def create_operations_plan(
    rainfall_mm: float = 0.0,
    event_attendance: int = 0,
    is_weekend: bool = False,
    top_n: int = 5,
) -> dict[str, Any]:
    """Build a dispatch plan from forecast hotspots + real fleet via CP-SAT."""
    preds = predictions_kecamatan(rainfall_mm=rainfall_mm, event_attendance=event_attendance,
                                  is_weekend=is_weekend)
    hotspots = preds["top_hotspots"][:top_n]
    demands = [
        Demand(area=h["slug"], tons=float(h["predicted_tons"]),
               lat=float(h.get("lat") or 0.0), lng=float(h.get("lng") or 0.0),
               priority=rank)
        for rank, h in enumerate(reversed(hotspots), start=1)
    ]
    vehicles = [
        Vehicle(truck_code=t["truck_code"], capacity_tons=18.0,
                available=not t["is_damaged"],
                permit_compliant=not t["deviation"]["violated"])
        for t in TRUCKS
    ]
    plan = build_operational_plan(demands, vehicles)
    payload = {
        "plan_id": plan.plan_id,
        "status": "proposed",
        "assignments": [
            {"truck_code": a.truck_code, "area": a.area,
             "assigned_tons": a.assigned_tons, "evidence": a.evidence}
            for a in plan.assignments
        ],
        "unmet_reasons": plan.unmet_reasons,
        "total_demand_tons": plan.total_demand_tons,
        "total_assigned_tons": plan.total_assigned_tons,
        "scenario": {"rainfall_mm": rainfall_mm, "event_attendance": event_attendance,
                     "is_weekend": is_weekend},
    }
    _OPERATIONS_PLANS[plan.plan_id] = payload
    history_store.record_event("operations_plan_created", {"plan_id": plan.plan_id})
    return payload


@app.post("/api/operations/{plan_id}/approve")
def approve_operations_plan(plan_id: str, _role: str = Depends(require_permission("operations:approve"))) -> dict[str, Any]:
    """Approve a plan and push each assignment through the dispatch contract."""
    plan = _OPERATIONS_PLANS.get(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail=f"Plan {plan_id} not found.")
    plan["status"] = "approved"
    created = []
    for a in plan["assignments"]:
        d = history_store.save_dispatch(
            truck_code=a["truck_code"],
            instruction=f"Collect {a['assigned_tons']:.0f}t at {a['area']} (plan {plan_id})",
            manager_id="operations_optimizer",
        )
        dispatch_center._dispatches.append(d)
        created.append(d["id"])
    plan["dispatch_ids"] = created
    history_store.record_event("operations_plan_approved", {"plan_id": plan_id, "dispatches": len(created)})
    return plan

# ── Advanced Fleet Intelligence Endpoints (New) ──────────────────────

@app.get("/api/fleet/history")
def fleet_history(
    truck_code: str | None = Query(None, description="Filter history by truck code"),
    date: str | None = Query(None, description="Filter history by date (YYYY-MM-DD)"),
) -> list[dict[str, Any]]:
    return fleet_history_payload(truck_code=truck_code, date=date)

@app.get("/api/fleet/carbon")
def fleet_carbon() -> dict[str, Any]:
    return {
        "co2_factor_kg_per_km": 0.95,
        "total_fleet_distance_km": 216.9,
        "total_co2_emitted_kg": round(216.9 * 0.95, 1),
        "carbon_saved_today_kg": 17.6, # Saving achieved by route optimization on T-047 (Route B instead of deviant A)
        "fuel_saved_equivalent_liters": round(17.6 / 2.68, 1),
        "compliance_rate_percent": 80.0
    }

@app.post("/api/simulator/stagger")
def post_stagger_simulation(active_trucks: int = 5) -> dict[str, Any]:
    return simulate_staggered_dispatch(active_trucks)


# ── A* Dynamic Rerouting Endpoints (Case 1 Handoff) ───────────────────


# ── TPA Queue Status & Crowd Events (Case 1 & 2 Gaps) ────────────────

# Necessary: the TPA payload is deterministic per 5s; caching it keeps the
# map marker render (one-shot, no retry) from vanishing on a slow first fetch.
_tpa_cache: dict[str, Any] = {}

@app.get("/api/tpa/queue-status")
def get_tpa_queue_status(scenario: str = Query("live", pattern="^(live|peak)$")) -> dict[str, Any]:
    cached = _tpa_cache.get(scenario)
    now = time.time()
    if cached is None or now - cached["ts"] > 5.0:
        cached = {"payload": tpa_queue_status_payload(scenario=scenario), "ts": now}
        _tpa_cache[scenario] = cached
    return cached["payload"]

_SUBMITTED_PERMITS: list[dict[str, Any]] = []


@app.get("/api/events/permits")
def get_events_permits() -> list[dict[str, Any]]:
    return events_permits_payload() + list(_SUBMITTED_PERMITS)


_EVENT_WASTE_KG_PER_PERSON = 1.2  # consistent with the labeled fixture permits (45k -> 54 t)


@app.post("/api/events/permits", status_code=201)
def submit_event_permit(payload: EventPermitRequest) -> dict[str, Any]:
    """Case 2 crowd-permit intake: a permit submitted to the authority becomes a
    live scenario — the system estimates waste generation, resource needs, and
    the affected kecamatan, and the permit joins the map's event layer."""
    from math import ceil as _ceil
    from app.engine import _haversine_meters

    tons = round(payload.expected_attendance * _EVENT_WASTE_KG_PER_PERSON / 1000.0, 1)
    trucks = max(1, _ceil(tons / 18.0))
    crews = trucks * 4
    impact = {
        "predicted_waste_tons": tons,
        "backup_trucks_required": trucks,
        "crews_required": crews,
        "man_hours_required": crews * 8,
        "large_bins_required": max(1, _ceil(tons / 2.5)),
        "resource_basis": "engine constants: 18 t/truck, 4 crew/truck, 8h shift, 2.5 t/bin; 1.2 kg waste/person/event",
    }

    affected = []
    for k in load_kecamatan_map():
        klat, klng = k.get("lat"), k.get("lng")
        if klat is None or klng is None:
            continue
        dist = _haversine_meters((payload.lat, payload.lng), (klat, klng))
        if dist <= 3500.0:
            affected.append({"kecamatan": k["kecamatan"], "slug": k["slug"], "distance_m": round(dist)})
    if not affected:
        nearest = min(
            (k for k in load_kecamatan_map() if k.get("lat") is not None and k.get("lng") is not None),
            key=lambda k: _haversine_meters((payload.lat, payload.lng), (k["lat"], k["lng"])),
            default=None,
        )
        if nearest:
            affected.append({
                "kecamatan": nearest["kecamatan"], "slug": nearest["slug"],
                "distance_m": round(_haversine_meters((payload.lat, payload.lng), (nearest["lat"], nearest["lng"]))),
            })
    affected.sort(key=lambda a: a["distance_m"])

    permit = {
        "id": f"EV-USER-{len(_SUBMITTED_PERMITS) + 1:03d}",
        "name": payload.name,
        "permit_number": f"SUBMITTED-{payload.event_date.isoformat()}",
        "location_name": payload.location_name,
        "lat": payload.lat,
        "lng": payload.lng,
        "event_date": payload.event_date.isoformat(),
        "organizer": payload.organizer,
        "expected_attendance": payload.expected_attendance,
        "status": "SUBMITTED",
        "data_class": "USER_SUBMITTED",
        "data_note": "Scenario permit entered via dashboard; not an official DLH/police permit record.",
        **impact,
        "affected_kecamatan": affected,
    }
    _SUBMITTED_PERMITS.append(permit)
    history_store.record_event("event_permit_submitted", {
        "id": permit["id"], "name": permit["name"],
        "expected_attendance": permit["expected_attendance"],
        "affected_kecamatan": [a["slug"] for a in affected],
    })
    return {"permit": permit, "impact": impact, "affected_kecamatan": affected}

@app.get("/api/fleet/astar-reroute")
def get_astar_reroute(truck_code: str = "T-047") -> dict[str, Any]:
    truck = next((t for t in TRUCKS if t["truck_code"] == truck_code), None)
    if truck is None:
        raise HTTPException(status_code=404, detail=f"Truck {truck_code} not found.")
    origin = None
    if truck.get("latest_position"):
        # Necessary: snapped (30s-cached) keeps reroute consistent with
        # map-truth and avoids a fresh OSRM connector fetch every call.
        origin = _snapped_for(truck)["snapped"]
    return reroute_payload(is_traffic_jam_active(), origin_position=origin)


@app.get("/api/fleet/route-alternatives")
def get_route_alternatives(truck_code: str = "T-047", permit_hour: int | None = Query(None, ge=0, le=23)) -> dict[str, Any]:
    """Case 1: >=2 computed permit-compliant route alternatives with real OSRM
    ETAs. Route 1 is optimal; route 2 is penalty-diversified (recomputed, not
    canned). permit_hour applies the simulated truck-hour restriction windows."""
    from app.astar_routing import find_alternative_routes, build_gps_graph, DEMO_CONGESTED_EDGES
    truck = next((t for t in TRUCKS if t["truck_code"] == truck_code), None)
    if truck is None:
        raise HTTPException(status_code=404, detail=f"Truck {truck_code} not found.")
    jam = is_traffic_jam_active()
    congested = DEMO_CONGESTED_EDGES if jam else []
    if truck.get("latest_position"):
        origin = _snapped_for(truck)["snapped"]
        nodes, edges = build_gps_graph(origin)
        from app.astar_routing import find_astar_route
        routes = []
        first = find_astar_route(start="ORIGIN", nodes=nodes, edges=edges,
                                 congested_edges=congested, permit_hour=permit_hour)
        if first.get("success"):
            first["rank"] = 1
            first["diversified"] = False
            routes.append(first)
            diversified = list(congested) + list(zip(first["sequence"], first["sequence"][1:]))
            second = find_astar_route(start="ORIGIN", nodes=nodes, edges=edges,
                                      congested_edges=diversified, permit_hour=permit_hour)
            if second.get("success") and tuple(second["sequence"]) != tuple(first["sequence"]):
                second["rank"] = 2
                second["diversified"] = True
                routes.append(second)
    else:
        routes = find_alternative_routes(k=2, congested_edges=congested, permit_hour=permit_hour)
    return {
        "truck_code": truck_code,
        "jam_active": jam,
        "permit_hour": permit_hour,
        "route_count": len(routes),
        "routes": routes,
        "permit_source": "SIMULATED PERMIT CONSTRAINT (not official DLH permit dataset)",
    }
@app.get("/api/fleet/route-decision")
def route_decision(truck_code: str = "T-047") -> dict[str, Any]:
    """One payload unifying every Case-1 route signal for a truck: OSRM ETA/
    distance, vehicle damage status, TPA queue, traffic, and permit — so a
    dispatcher sees a single decision, not five disconnected panels."""
    truck = next((t for t in TRUCKS if t["truck_code"] == truck_code), None)
    if truck is None:
        raise HTTPException(status_code=404, detail=f"Truck {truck_code} not found.")
    origin = None
    if truck.get("latest_position"):
        # Necessary: snapped (30s-cached) keeps reroute consistent with
        # map-truth and avoids a fresh OSRM connector fetch every call.
        origin = _snapped_for(truck)["snapped"]
    jam_active = is_traffic_jam_active()
    route = reroute_payload(jam_active, origin_position=origin)
    active = route["active_route"]
    queue = simulate_queue(47 if jam_active else 14, weighbridges=2, service_rate_per_hour=4.5, seed=42)
    vehicle_status = "DAMAGED" if truck.get("is_damaged") else ("DEVIATION" if truck["deviation"]["violated"] else "OK")
    recs = []
    if truck.get("is_damaged"):
        recs.append("Vehicle damaged — assign backup capacity.")
    if truck["deviation"]["violated"]:
        recs.append("Off assigned corridor — redirect to recommended route.")
    if jam_active:
        recs.append("Active-route congestion — A* diversion applied.")
    if queue["mean_wait_minutes"] > 45:
        recs.append("TPA queue high — stagger arrival.")
    return {
        "truck_code": truck_code,
        "eta_minutes": active["eta_minutes"],
        "physical_distance_km": active["physical_distance_km"],
        "optimization_cost": active["optimization_cost"],
        "vehicle_status": vehicle_status,
        "tpa_queue": {"wait_minutes": queue["mean_wait_minutes"], "p95": queue["p95_wait_minutes"],
                      "source": "MODEL OUTPUT"},
        "traffic": {"jam_active": jam_active, "source": "SIMULATED CONGESTION"},
        "permit": {"source": active.get("permit_source", "SIMULATED PERMIT CONSTRAINT")},
        "recommendation": recs or ["Normal operation; no intervention needed."],
    }

# Necessary: each build_map_truth costs 1-4.5s (per-truck snap + T-047 reroute
# hit OSRM). With 4 Playwright workers polling every 8s, uncached recomputes
# overlapped and the frontend's fetch-settle checks timed out. A 4s TTL shares
# one recompute across all clients while GPS freshness stays within 4s.
_map_truth_lock = threading.Lock()
_map_truth_cache: dict[str, Any] = {"ts": 0.0, "payload": None}

@app.get("/api/fleet/map-truth")
def fleet_map_truth() -> dict[str, Any]:
    """Single geospatial-truth payload for every truck (frontend renders verbatim)."""
    cached = _map_truth_cache
    now = time.time()
    if cached["payload"] is None or now - cached["ts"] > 15.0:
        with _map_truth_lock:
            now = time.time()
            if cached["payload"] is None or now - cached["ts"] > 15.0:
                cached["payload"] = {"trucks": [build_map_truth(t) for t in TRUCKS]}
                cached["ts"] = time.time()
    return cached["payload"]

@app.get("/api/fleet/unlicensed-collectors")
def unlicensed_collectors() -> dict[str, Any]:
    return unlicensed_collectors_payload()

@app.get("/api/cv/surveillance-feed")
def cv_surveillance_feed() -> dict[str, Any]:
    """Computer-vision gate feed (Case 1): plate reads verified against the DLH
    whitelist. Simulated feed from a demo clip, pilot-ready ANPR contract."""
    return surveillance_status()

@app.get("/api/fleet/{truck_code}/breadcrumbs")
def fleet_breadcrumbs(truck_code: str) -> dict[str, Any]:
    """Timestamped GPS trail for a truck (simulated feed, pilot-ready contract)."""
    trail = latest_breadcrumbs(truck_code)
    return {
        "truck_code": truck_code,
        "source": "simulated",
        "note": "Simulated breadcrumb feed; swap to DLH AVL at pilot with no contract change.",
        "breadcrumbs": [
            {"lat": b.lat, "lng": b.lng, "timestamp": b.timestamp,
             "speed_kmh": b.speed_kmh, "source": b.source}
            for b in trail
        ],
    }

@app.post("/api/fleet/astar-simulate-jam")
def post_astar_simulate_jam(active: bool) -> dict[str, Any]:
    set_traffic_jam_active(active)
    note_manual_override()
    # Necessary: the toggled jam state feeds map-truth (jam_active, abandoned
    # route), so any cached payload would report stale state to clients — the
    # jam-toggle e2e reads map-truth right after POSTing the toggle.
    _map_truth_cache["ts"] = 0.0
    return {
        "status": "success",
        "traffic_jam_active": is_traffic_jam_active(),
        "message": "Traffic jam state toggled successfully."
    }

@app.get("/api/fleet/summary")
def get_fleet_executive_report() -> JSONResponse:
    """
    Export operational executive summary formatted in Markdown for DLH managers.
    """
    today_str = date.today().strftime("%d %B %Y")

    # Case 2 numbers computed live from the 42-kecamatan hybrid model under a
    # heavy-rain weekend scenario, so the report matches the actual model output.
    scenario_kecs = predictions_kecamatan(
        rainfall_mm=42.0, event_attendance=0, is_weekend=True, is_holiday=False,
    )
    baseline_kecs = predictions_kecamatan(
        rainfall_mm=0.0, event_attendance=0, is_weekend=False, is_holiday=False,
    )
    top = scenario_kecs["top_hotspots"][0]
    base_lookup = {k["slug"]: k["predicted_tons"] for k in baseline_kecs["kecamatan"]}
    top_base = base_lookup.get(top["slug"], top["predicted_tons"])
    spike_pct = round((top["predicted_tons"] - top_base) / top_base * 100, 1) if top_base else 0.0
    extra_crews = sum(k["crews_required"] for k in scenario_kecs["top_hotspots"])
    extra_manhours = sum(k["man_hours_required"] for k in scenario_kecs["top_hotspots"])
    extra_trucks = sum(k["trucks_required"] for k in scenario_kecs["top_hotspots"])
    extra_bins = sum(k["disposal_bins_required"] for k in scenario_kecs["top_hotspots"])

    stagger = simulate_staggered_dispatch(32)

    report = f"""# LAPORAN EKSEKUTIF JWIS
Tanggal Cetak: {today_str}
Sistem: Jakarta Waste Intelligence System (JWIS)

## 1. PENILAIAN DAMPAK OPERASIONAL (CASE 1)
Sistem optimalisasi logistik JWIS meningkatkan efisiensi armada (angka dari simulasi discrete-event, bukan estimasi tetap):
- **Reduksi Waktu Antri TPA (simulasi):** waktu tunggu puncak turun **{stagger['queue_reduction_percent']}%** (dari {stagger['baseline_wait_minutes']} menjadi {stagger['optimized_wait_minutes']} menit) via Staggered Dispatch. Sumber: simulasi antrian ter-seed, bukan pengukuran lapangan.
- **Faktor Emisi (referensi):** estimasi bahan bakar 1.8 L/ton adalah faktor rujukan teknik, bukan penghematan terukur. Penghematan nyata butuh pilot lapangan.
- **Kepatuhan Koridor Rute:** deteksi deviasi berbasis point-to-polyline (T-047 terdeteksi menyimpang 2.373 m).

## 2. PREDIKSI VOLUME & KEBUTUHAN SUMBER DAYA (CASE 2)
Hasil prediksi spasial-temporal model Hybrid Prophet + XGBoost untuk {scenario_kecs['kecamatan_count']} kecamatan Jakarta (skenario hujan ekstrim 42mm + akhir pekan):
- **Puncak Prediksi Volume:** Kecamatan {top['kecamatan']} ({top['city']}) diproyeksikan mengalami volume sampah tertinggi sebesar **{top['predicted_tons']:.1f} ton/hari** (**+{spike_pct}%** vs kondisi normal).
- **Total Volume Kota:** Estimasi total {scenario_kecs['kecamatan_count']} kecamatan mencapai **{scenario_kecs['total_predicted_tons']:.1f} ton/hari** pada skenario ini.
- **Kebutuhan Manpower (5 hotspot teratas):** Dibutuhkan **{extra_crews} kru lapangan** dengan alokasi total **{extra_manhours} man-hours**.
- **Kesiapan Armada & Fasilitas (5 hotspot teratas):** Merekomendasikan pengerahan **{extra_trucks} unit armada** dan penempatan **{extra_bins} unit tempat penampungan sampah besar**.

## 3. REKOMENDASI MANAJEMEN SEGERA
1. Aktifkan penundaan staggered keberangkatan truk non-darurat sebesar 15 menit.
2. Kirim notifikasi alert penyesuaian rute otomatis ke sopir truk B 5678 EF (T-047) via integrasi WhatsApp Gateway.
3. Siagakan tim sapu bersih cadangan di Kelurahan Kebon Jeruk dan Tebet.
"""
    return JSONResponse({"report": report})


@app.get("/api/geo/tps-coordinates")
def get_tps_coordinates() -> dict[str, Any]:
    """Returns all 1,081 official TPS locations as a GeoJSON FeatureCollection."""
    tps_list = load_real_tps_coordinates()
    features = []
    for t in tps_list:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [t["lng"], t["lat"]]
            },
            "properties": {
                "name": t["name"],
                "kecamatan": t["kecamatan"],
                "kelurahan": t["kelurahan"]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "source": "Official SILIKA 2023 coordinates",
        "total": len(features)
    }


@app.get("/api/geo/wr-coordinates")
def get_wr_coordinates() -> dict[str, Any]:
    """Returns all official Wajib Retribusi locations as a GeoJSON FeatureCollection."""
    wr_list = load_real_wr_coordinates()
    features = []
    for w in wr_list:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [w["lng"], w["lat"]]
            },
            "properties": {
                "name": w["name"],
                "type": w["jns"],
                "address": w["almt"],
                "kecamatan": w["kec"],
                "kelurahan": w["kel"]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "source": "Official SILIKA Wajib Retribusi 2023 coordinates",
        "total": len(features)
    }


# ── AI ENGINE (production AI-first) ──────────────────────────────────────────

_ai_detector = SpeedAnomalyDetector()
_ai_rerouter = AutoRerouter(detector=_ai_detector, feed=EVENT_FEED)
_ai_queue = TpaQueuePredictor()
_ai_deviation = DeviationTrigger(feed=EVENT_FEED)
_ai_stop = StopPatternDetector()
_ai_carbon = CarbonCalculator()
_ai_forecast = EventImpactForecaster(feed=EVENT_FEED)


@app.on_event("startup")
def _start_ai_engine() -> None:
    engine = maybe_start_engine()
    if engine is None:
        return
    engine.register("auto_reroute", _ai_rerouter.run)
    engine.register("tpa_queue", _ai_queue.update)
    engine.register("deviation_replay", _ai_deviation.check)
    engine.register("stop_pattern", lambda source: _ai_stop.scan())
    engine.register("carbon", _ai_carbon.update)

    def _forecast_loop() -> None:
        while True:
            try:
                _ai_forecast.refresh()
            except Exception:  # noqa: BLE001
                logging.getLogger(__name__).exception("event forecast refresh failed")
            threading.Event().wait(3600)

    threading.Thread(target=_forecast_loop, daemon=True,
                     name="jwis-ai-forecast").start()


@app.get("/api/ai/events")
def ai_events() -> dict[str, Any]:
    events = EVENT_FEED.snapshot()
    return {"events": events, "count": len(events)}


@app.post("/api/ai/events/{index}/ack")
def ai_event_ack(index: int) -> dict[str, Any]:
    return {"ok": EVENT_FEED.acknowledge(index)}


@app.get("/api/ai/tpa-queue-live")
def ai_tpa_queue_live() -> dict[str, Any]:
    return _ai_queue.latest()


@app.get("/api/ai/unlicensed-flags")
def ai_unlicensed_flags() -> dict[str, Any]:
    flags = _ai_stop.flags()
    return {"flags": flags, "count": len(flags)}


@app.get("/api/ai/carbon-live")
def ai_carbon_live() -> dict[str, Any]:
    return _ai_carbon.latest()


@app.get("/api/ai/event-forecast")
def ai_event_forecast() -> dict[str, Any]:
    outlook = _ai_forecast.latest()
    return {"outlook": outlook, "count": len(outlook)}


# ── SPJ (Surat Perintah Jalan) ───────────────────────────────────────────────

def _spj_payload(spj) -> dict[str, Any]:
    return _asdict(spj)


def _spj_or_409(fn, *args, **kwargs):
    try:
        return _spj_payload(fn(*args, **kwargs))
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


class SpjCreateBody(BaseModel):
    driver_name: str
    truck_code: str
    destination: str
    weigh_on_site: bool = False
    priority: str = "normal"
    note: str = ""


class SpjStopBody(BaseModel):
    name: str
    kecamatan: str
    address: str
    lat: float
    lng: float
    location_type: str = "Pemukiman Kelas Menengah"


class SpjCompleteBody(BaseModel):
    evidence: dict | None = None


class SpjReceiptBody(BaseModel):
    photo_name: str
    photo_b64: str = Field(default="", max_length=7_000_000)
    total_weight_kg: float | None = None


class PretripBody(BaseModel):
    truck_code: str
    driver_name: str
    items: dict[str, bool]
    note: str = ""


class DamageReportBody(BaseModel):
    truck_code: str
    driver_name: str
    component: str
    severity: str
    note: str
    photo_name: str | None = None
    photo_b64: str | None = Field(default=None, max_length=7_000_000)
    source: str = "driver_pwa"


@app.get("/api/spj")
def list_spj(status: str | None = None) -> dict[str, Any]:
    items = SPJ_STORE.list(status=status)
    return {"spj": [spj_summary_payload(s) for s in items], "count": len(items)}


@app.get("/api/spj/active-path/{truck_code}")
def spj_active_path_endpoint(truck_code: str) -> dict[str, Any]:
    path = spj_active_path(truck_code)
    return {
        "truck_code": truck_code,
        "has_active_spj": path is not None,
        "path": [{"lat": lat, "lng": lng} for lat, lng in (path or [])],
    }


@app.get("/api/spj/{spj_id}")
def get_spj(spj_id: str) -> dict[str, Any]:
    spj = SPJ_STORE.get(spj_id)
    if spj is None:
        raise HTTPException(status_code=404, detail=f"SPJ {spj_id} not found")
    return _spj_payload(spj)


@app.post("/api/spj", status_code=201)
def create_spj(body: SpjCreateBody) -> dict[str, Any]:
    return _spj_or_409(SPJ_STORE.create, body.driver_name, body.truck_code,
                       body.destination, body.weigh_on_site, body.priority,
                       body.note)


@app.post("/api/spj/{spj_id}/stops")
def add_spj_stop(spj_id: str, body: SpjStopBody) -> dict[str, Any]:
    return _spj_or_409(SPJ_STORE.add_stop, spj_id, body.name, body.kecamatan,
                       body.address, body.lat, body.lng, body.location_type)


def _refresh_fleet_caches() -> None:
    from app.data import _fleet_cache
    from app.fleet_generator import _gen_cache
    _fleet_cache["ts"] = 0.0
    _gen_cache["ts"] = 0.0
    _map_truth_cache["ts"] = 0.0


@app.post("/api/spj/{spj_id}/activate")
def activate_spj(spj_id: str) -> dict[str, Any]:
    result = _spj_or_409(SPJ_STORE.activate, spj_id)
    _refresh_fleet_caches()
    return result


@app.post("/api/spj/{spj_id}/stops/{index}/complete")
def complete_spj_stop(spj_id: str, index: int,
                      body: SpjCompleteBody | None = None) -> dict[str, Any]:
    result = _spj_or_409(SPJ_STORE.complete_stop, spj_id, index,
                         (body.evidence if body else None))
    _refresh_fleet_caches()
    return result


@app.post("/api/spj/{spj_id}/complete")
def complete_spj(spj_id: str) -> dict[str, Any]:
    result = _spj_or_409(SPJ_STORE.complete, spj_id)
    _refresh_fleet_caches()
    return result


@app.post("/api/spj/{spj_id}/cancel")
def cancel_spj(spj_id: str) -> dict[str, Any]:
    result = _spj_or_409(SPJ_STORE.cancel, spj_id)
    _refresh_fleet_caches()
    return result


# ── SPJ evidence / receipt + Driver PWA (pretrip, damage reports) ────────────

from app.pretrip import PRETRIP_STORE
from app.damage_reports import DAMAGE_STORE


@app.get("/api/spj/{spj_id}/evidence-summary")
def spj_evidence_summary(spj_id: str) -> dict[str, Any]:
    spj = SPJ_STORE.get(spj_id)
    if spj is None:
        raise HTTPException(status_code=404, detail=f"SPJ {spj_id} not found")
    stops = []
    for i, stop in enumerate(spj.stops):
        ev = stop.evidence or {}
        weighing = ev.get("weighing") or []
        total = round(sum(float(w.get("weight_kg") or 0) for w in weighing), 1)
        fractions: dict[str, float] = {}
        for w in weighing:
            key = w.get("fraction") or "Lainnya"
            fractions[key] = round(fractions.get(key, 0.0)
                                   + float(w.get("weight_kg") or 0), 1)
        stops.append({
            "index": i, "name": stop.name, "status": stop.status,
            "has_arrival": bool((ev.get("arrival") or {}).get("photo_name")),
            "weighing_count": len(weighing),
            "total_weight_kg": total,
            "fractions": fractions,
            "officer_name": (ev.get("officer") or {}).get("name"),
        })
    return {"spj_id": spj_id, "stops": stops,
            "complete": all(s["has_arrival"] for s in stops) and len(stops) > 0}


@app.post("/api/spj/{spj_id}/receipt", status_code=201)
def submit_spj_receipt(spj_id: str, body: SpjReceiptBody) -> dict[str, Any]:
    spj = SPJ_STORE.get(spj_id)
    if spj is None:
        raise HTTPException(status_code=404, detail=f"SPJ {spj_id} not found")
    if spj.status != "selesai":
        raise HTTPException(status_code=409,
                            detail="receipt can only be submitted after the SPJ is selesai")
    if not body.photo_name.strip() or not body.photo_b64.strip():
        raise HTTPException(status_code=409,
                            detail="receipt photo_name and photo_b64 are required")
    history_store.record_event("spj_receipt_submitted", {
        "spj_id": spj_id, "spj_number": spj.spj_number,
        "photo_name": body.photo_name,
        "total_weight_kg": body.total_weight_kg,
    })
    return {"status": "recorded", "spj_id": spj_id}


@app.post("/api/pretrip", status_code=201)
def submit_pretrip(body: PretripBody) -> dict[str, Any]:
    try:
        rec = PRETRIP_STORE.submit(body.truck_code, body.driver_name,
                                   body.items, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return _asdict(rec)


@app.get("/api/pretrip/today/{truck_code}")
def pretrip_today(truck_code: str) -> dict[str, Any]:
    rec = PRETRIP_STORE.today(truck_code)
    return {"record": _asdict(rec) if rec else None, "done": rec is not None}


@app.post("/api/damage-reports", status_code=201)
def create_damage_report(body: DamageReportBody) -> dict[str, Any]:
    try:
        rep = DAMAGE_STORE.create(body.truck_code, body.driver_name,
                                  body.component, body.severity, body.note,
                                  body.photo_name, body.photo_b64, body.source)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    history_store.record_event("damage_reported", {
        "report_id": rep.report_id, "truck_code": rep.truck_code,
        "component": rep.component, "severity": rep.severity,
        "source": rep.source,
    })
    _refresh_fleet_caches()
    return _asdict(rep)


@app.get("/api/damage-reports")
def list_damage_reports(status: str | None = None) -> dict[str, Any]:
    reports = DAMAGE_STORE.list(status=status)
    return {"reports": [_asdict(r) for r in reports], "count": len(reports)}


@app.post("/api/damage-reports/{report_id}/resolve")
def resolve_damage_report(report_id: str) -> dict[str, Any]:
    try:
        rep = DAMAGE_STORE.resolve(report_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    _refresh_fleet_caches()
    return _asdict(rep)
