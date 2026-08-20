"""Read-only tool registry for the Ana assistant.

Tools call the same Python functions used by the API endpoints (single source
of truth). Ana is read-only: no dispatch/approve/send tools are exposed; she
recommends actions and the operator executes them in the dashboard.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from app.data import (
    command_center_snapshot,
    get_dynamic_trucks,
    events_permits_payload,
    fleet_history_payload,
    tpa_queue_status_payload,
    unlicensed_collectors_payload,
)
from app.engine import (
    list_hybrid_models,
    predict_waste_hybrid,
    simulate_staggered_dispatch,
)
from app.forecast_metrics import suitability_labels
from app.gps_feed import latest_breadcrumbs
from app.impact import build_impact_report
from app.osrm import fetch_osrm_route
from app.weather import fetch_jakarta_weather_forecast
from app.astar_routing import (
    is_traffic_jam_active,
    reroute_payload,
    set_traffic_jam_active,
)
from app.real_data import (
    build_provenance_records,
    data_provenance,
    load_city_timbulan,
    load_fleet_composition,
    load_official_events,
    load_real_wr_coordinates,
)
from app.queue_simulation import simulate_queue
from app.whatsapp import OpenWAClient


@dataclass
class ToolContext:
    dispatch_center: Any
    history_store: Any


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_command_center_snapshot",
            "description": "Snapshot terkini Komando JWIS: KPI (truk aktif, isu, antrean TPA), alert aktif, prediksi teratas, dan headline eksekutif.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fleet_status",
            "description": "Daftar status truk real-time: kondisi kerusakan, deviasi koridor, posisi, dan driver. Opsional: filter satu truck_code.",
            "parameters": {
                "type": "object",
                "properties": {"truck_code": {"type": "string", "description": "Opsional, misal T-047"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fleet_history",
            "description": "Riwayat perjalanan truk dalam sehari (jarak, bahan bakar, jumlah deviasi).",
            "parameters": {
                "type": "object",
                "properties": {
                    "truck_code": {"type": "string", "description": "Opsional filter truk"},
                    "date": {"type": "string", "description": "Opsional YYYY-MM-DD"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_truck_breadcrumbs",
            "description": "Jejak GPS (breadcrumbs) terakhir untuk satu truk, lengkap dengan timestamp dan kecepatan.",
            "parameters": {
                "type": "object",
                "properties": {"truck_code": {"type": "string", "description": "misal T-047"}},
                "required": ["truck_code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_route_options",
            "description": "Opsi rute pemulihan (Route B - Daan Mogot Recovery) dengan ETA dan geometri dari OSRM public routing.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_astar_reroute",
            "description": "Simulasi rerouting A* untuk sebuah truk: menyalakan/memadamkan kondisi kemacetan (jam_active true/false didapat) dan menghasilkan rute aktif + rute pemulihan.",
            "parameters": {
                "type": "object",
                "properties": {
                    "truck_code": {"type": "string", "description": "Default T-047"},
                    "jam_active": {"type": "boolean", "description": "Opsional; toggle status kemacetan simulasi"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_predictions",
            "description": "Prediksi tonase sampah 7 hari ke depan dan per kelurahan. Konteks driver (hujan/event/weekend) dan kebutuhan truk/kru.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Opsional YYYY-MM-DD"},
                    "kelurahan": {"type": "string", "description": "Opsional detail per kelurahan, misal 'Menteng'"},
                    "rainfall_mm": {"type": "number", "description": "Opsional curah hujan (mm) untuk detail"},
                    "event_attendance": {"type": "integer", "description": "Opsional jumlah pengunjung event"},
                    "is_weekend": {"type": "boolean", "description": "Opsional penanda akhir pekan"},
                    "is_holiday": {"type": "boolean", "description": "Opsional penanda hari libur"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ml_model_info",
            "description": "Status & kesesuaian model ML hybrid (Prophet + XGBoost). NOTA: akurasi harian per dae sensus berlabel kalibrasi-sintetik dan tidak diklaim sebagai akurasi terukur.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tpa_queue",
            "description": "Status antrean TPA Bantargebang: jumlah truk, waktu tunggu rata-rata/p95, status label, dan recommended action. Skenario 'live' (jam berjalan) atau 'peak' (puncak terdokumentasi DLH 47 truk/jam).",
            "parameters": {
                "type": "object",
                "properties": {"scenario": {"type": "string", "enum": ["live", "peak"], "description": "Default live"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_staggered_dispatch",
            "description": "Simulasi jadwal keberangkatan bertahap (staggered dispatch) untuk mengurangi antrean TPA; output pengurangan rata-rata waktu tunggu.",
            "parameters": {
                "type": "object",
                "properties": {"active_trucks": {"type": "integer", "description": "Jumlah truk aktif, default 5"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Prakiraan cuaca Jakarta (Open-Meteo): mm, probabilitas, angin, dan dampak estimasi terhadap operasional sampah.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_events",
            "description": "Event resmi Jakarta + event berizin dengan estimasi jumlah keramaian dan prediksi timbulan sampah di sekitar lokasi.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_whatsapp_status",
            "description": "Status gateway WhatsApp (Baileys/OpenWA): terkoneksi atau offline, plus info kontak. Bukan untuk mengirim.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_data_provenance",
            "description": "Provenance data JWIS: sumber data resmi vs simulasi, ringkasan timbulan, koordinat TPS/WR, laporan dampak, pengumpul ilegal terdeteksi.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


def sanitize_json_payload(value: Any, max_chars: int = 8000) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)[:max_chars]
    return text


def _command_snapshot(ctx: ToolContext) -> dict[str, Any]:
    weather = fetch_jakarta_weather_forecast()
    snap = command_center_snapshot(ctx.dispatch_center.audit_log(), weather=weather)
    return {
        "kpis": snap.get("kpis"),
        "tpa_queue": snap.get("tpa_queue"),
        "alerts": snap.get("alerts", [])[:8],
        "critical_predictions": snap.get("critical_predictions", [])[:5],
        "executive_summary": snap.get("executive_summary"),
        "weather_today": (snap.get("weather", {}).get("forecast") or [None])[0],
    }


def _fleet_status_tool(args: dict) -> dict[str, Any]:
    trucks = get_dynamic_trucks()
    if args.get("truck_code"):
        trucks = [t for t in trucks if t["truck_code"] == args["truck_code"]]
    slim = []
    for t in trucks:
        slim.append({
            "truck_code": t["truck_code"],
            "driver_name": t["driver_name"],
            "zone": t["assigned_zone"],
            "vehicle_type": t.get("vehicle_type"),
            "status": t["status"],
            "activity": t.get("activity", {}).get("label"),
            "is_damaged": t["is_damaged"],
            "damage_note": (t.get("damage_status") or {}).get("note"),
            "deviation_violated": t["deviation"]["violated"],
            "deviation_meters": t["deviation"]["distance_meters"],
            "severity": t["deviation"]["severity"],
            "speed_kmh": t["latest_position"]["speed_kmh"],
        })
    problem = [t for t in slim if t["deviation_violated"] or t["is_damaged"]]
    return {
        "total_trucks": len(slim),
        "problem_count": len(problem),
        "problem_trucks": problem,
        "note": "Kerusakan (is_damaged) dan deviasi rute (deviation_violated) adalah status TERPISAH — jangan digabung.",
        "trucks": slim if args.get("truck_code") else f"{len(slim)} units; only problem trucks listed inline",
    }


_TOOLS_IMPL: dict[str, Any] = {
    "get_command_center_snapshot": lambda args, ctx: _command_snapshot(ctx),
    "get_fleet_status": lambda args, ctx: _fleet_status_tool(args),
    "get_fleet_history": lambda args, ctx: fleet_history_payload(
        truck_code=args.get("truck_code"), date=args.get("date")
    ),
    "get_truck_breadcrumbs": lambda args, ctx: {
        "truck_code": args["truck_code"],
        "source": "simulated",
        "note": "Simulated breadcrumb feed; swap to DLH AVL at pilot with no contract change.",
        "breadcrumbs": [
            {"lat": b.lat, "lng": b.lng, "timestamp": b.timestamp, "speed_kmh": b.speed_kmh, "source": b.source}
            for b in latest_breadcrumbs(args["truck_code"])
        ],
    },
    "get_route_options": lambda args, ctx: fetch_osrm_route(
        "Route B - Daan Mogot Recovery", origin=(-6.1649, 106.7415), destination=(-6.1753, 106.7988)
    ),
    "simulate_astar_reroute": lambda args, ctx: _simulate_reroute(args),
    "get_predictions": lambda args, ctx: _predictions_payload(args),
    "get_ml_model_info": lambda args, ctx: {
        "models": list_hybrid_models(),
        "suitability": suitability_labels(),
        "note": "Daily per-district resolution is calibrated-synthetic and must not be presented as observed accuracy.",
    },
    "get_tpa_queue": lambda args, ctx: tpa_queue_status_payload(scenario=args.get("scenario", "live")),
    "simulate_staggered_dispatch": lambda args, ctx: simulate_staggered_dispatch(int(args.get("active_trucks", 47))),
    "get_weather": lambda args, ctx: fetch_jakarta_weather_forecast(),
    "get_events": lambda args, ctx: [
        *[{"id": e.get("id"), "name": e.get("title") or e.get("name"), **e} for e in load_official_events()],
        *events_permits_payload(),
    ],
    "get_whatsapp_status": lambda args, ctx: {
        "openwa": OpenWAClient.from_env().health(),
        "note": "STATUS ONLY - Ana must not claim a send.",
    },
    "get_data_provenance": lambda args, ctx: {
        "provenance": data_provenance(),
        "records": build_provenance_records(),
        "city_timbulan": load_city_timbulan(),
        "fleet_composition": load_fleet_composition(),
        "tps_coordinates_total": len(load_real_wr_coordinates()),
        "unlicensed_collectors": unlicensed_collectors_payload(),
        "impact_report": build_impact_report(),
    },
}


def _simulate_reroute(args: dict) -> dict[str, Any]:
    truck_code = args.get("truck_code", "T-047")
    if args.get("jam_active") is not None:
        set_traffic_jam_active(bool(args["jam_active"]))
    trucks = get_dynamic_trucks()
    truck = next((t for t in trucks if t["truck_code"] == truck_code), None)
    if truck is None:
        raise TypeError(f"Truck {truck_code} not found.")
    origin = None
    if truck.get("latest_position"):
        origin = {"lat": truck["latest_position"]["lat"], "lng": truck["latest_position"]["lng"]}
    return reroute_payload(is_traffic_jam_active(), origin_position=origin)


def _predictions_payload(args: dict) -> dict[str, Any]:
    from app.data import build_predictions
    from app.real_data import load_kecamatan_map

    preds = build_predictions()
    if args.get("date"):
        preds = [p for p in preds if p["date"] == args["date"]]
    out: dict[str, Any] = {"predictions_daily_city": preds[:14]}

    hotspots = []
    for k in load_kecamatan_map():
        pred = predict_waste_hybrid(
            kelurahan=k["slug"],
            rainfall_mm=float(args.get("rainfall_mm", 0)),
            is_weekend=bool(args.get("is_weekend", False)),
            is_holiday=bool(args.get("is_holiday", False)),
            event_attendance=int(args.get("event_attendance", 0)),
        )
        hotspots.append({
            "kecamatan": k["kecamatan"], "city": k["city"],
            "predicted_tons": pred["predicted_tons"],
            "trucks_required": max(1, round(pred["predicted_tons"] / 18)),
            "crews_required": pred["crews_required"],
            "man_hours_required": pred["man_hours_required"],
        })
    hotspots.sort(key=lambda h: -h["predicted_tons"])
    out["kecamatan_hotspots_top5"] = hotspots[:5]
    out["kecamatan_count"] = len(hotspots)
    out["note"] = "kecamatan_hotspots_top5 dari model hybrid Prophet+XGBoost per kecamatan; pakai angka ini apa adanya."

    if args.get("kelurahan"):
        out["detail"] = predict_waste_hybrid(
            kelurahan=args["kelurahan"],
            rainfall_mm=float(args.get("rainfall_mm", 0)),
            is_weekend=bool(args.get("is_weekend", False)),
            is_holiday=bool(args.get("is_holiday", False)),
            event_attendance=int(args.get("event_attendance", 0)),
        )
    return out


def execute_tool(name: str, args: dict, ctx: ToolContext) -> dict[str, Any]:
    if name not in _TOOLS_IMPL:
        raise KeyError(f"Unknown tool: {name}")
    impl = _TOOLS_IMPL[name]
    try:
        return impl(args or {}, ctx)
    except Exception as error:
        return {"tool": name, "error": f"Tool execution failed: {error}"}


def run_tools_pass(tool_calls: list[dict], ctx: ToolContext) -> list[dict]:
    """Turn OpenAI tool_calls into assistant('tool') messages."""
    messages = []
    for call in tool_calls:
        fname = call.get("function", {}).get("name", "")
        raw_args = call.get("function", {}).get("arguments", "{}")
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else (raw_args or {})
        except json.JSONDecodeError:
            args = {}
        try:
            output = execute_tool(fname, args, ctx)
        except KeyError:
            output = {"tool": fname, "error": f"Unknown or unavailable tool: {fname}"}
        messages.append({
            "role": "tool",
            "tool_call_id": call.get("id", ""),
            "name": fname,
            "content": sanitize_json_payload(output),
        })
    return messages