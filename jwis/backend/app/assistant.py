from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.request import Request, urlopen

from app.rag import format_rag_context, retrieve_jwis_context


def _top_prediction(snapshot: dict[str, Any]) -> dict[str, Any]:
    predictions = snapshot.get("critical_predictions", [])
    return max(predictions, key=lambda item: item.get("spike_percent", 0), default={})


def _forecast_window(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    predictions = snapshot.get("predictions") or snapshot.get("critical_predictions") or []
    return sorted(
        predictions,
        key=lambda item: (str(item.get("date", "")), -float(item.get("predicted_tons", 0) or 0)),
    )


def _forecast_summary(snapshot: dict[str, Any]) -> dict[str, Any]:
    rows = _forecast_window(snapshot)
    if not rows:
        return {
            "days": 0,
            "total_tons": 0.0,
            "peak": {},
            "daily_totals": [],
        }

    totals_by_date: dict[str, float] = {}
    for row in rows:
        date = str(row.get("date", "unknown"))
        totals_by_date[date] = totals_by_date.get(date, 0.0) + float(row.get("predicted_tons", 0) or 0)

    daily_totals = [
        {"date": date, "predicted_tons": round(total, 1)}
        for date, total in sorted(totals_by_date.items())
    ]
    peak = max(rows, key=lambda item: float(item.get("predicted_tons", 0) or 0), default={})
    return {
        "days": len(daily_totals),
        "total_tons": round(sum(item["predicted_tons"] for item in daily_totals), 1),
        "peak": peak,
        "daily_totals": daily_totals,
    }


def _rag_answer_points(question: str, max_items: int = 4) -> str:
    items = retrieve_jwis_context(question, top_k=max_items)
    lines = []
    for item in items:
        text = re.sub(r"[#>*`_\[\]]+", "", str(item["text"]))
        text = " ".join(text.split())
        if len(text) > 260:
            text = text[:257].rstrip() + "..."
        lines.append(f"- **{item['title']}**: {text}")
    return "\n".join(lines)


def _is_jwis_fact_question(question: str) -> bool:
    question_lc = (question or "").lower()
    factual_terms = (
        "jwis",
        "ana",
        "fitur",
        "feature",
        "data",
        "model",
        "arsitektur",
        "architecture",
        "cara kerja",
        "workflow",
        "map",
        "peta",
        "pin",
        "routing",
        "rute",
        "osrm",
        "a*",
        "astar",
        "whatsapp",
        "wa",
        "field",
        "audit",
        "report",
        "laporan",
        "forecast",
        "prediksi",
        "tonase",
        "sampah",
        "7 hari",
        "7-day",
        "seven day",
        "tpa",
        "bantargebang",
        "dispatch",
        "truck",
        "truk",
        "driver",
        "supir",
        "open meteo",
        "open-meteo",
        "cuaca",
    )
    return any(term in question_lc for term in factual_terms)


def build_executive_summary(snapshot: dict[str, Any]) -> str:
    kpis = snapshot.get("kpis", {})
    top = _top_prediction(snapshot)
    first_alert = (snapshot.get("alerts") or [{}])[0]
    return (
        f"JWIS detects {kpis.get('trucks_with_issues', 0)} operational issues across "
        f"{kpis.get('active_trucks', 0)} active trucks. The highest predicted waste spike is "
        f"{top.get('spike_percent', 0)}% in {top.get('district', 'the monitored district')}, requiring "
        f"{top.get('recommended_extra_trucks', 0)} additional trucks. TPA delay is "
        f"{kpis.get('tpa_wait_minutes', 0)} minutes. Immediate action: resolve "
        f"{first_alert.get('truck_code', 'priority truck')} via dispatch and stagger landfill arrivals."
    )


def answer_operational_question(question: str, snapshot: dict[str, Any]) -> str:
    question_lc = (question or "").lower()
    kpis = snapshot.get("kpis", {})
    top = _top_prediction(snapshot)
    alerts = snapshot.get("alerts", [])
    alert_codes = ", ".join(alert.get("truck_code", "-") for alert in alerts[:3]) or "none"
    forecast = _forecast_summary(snapshot)
    rag_points = _rag_answer_points(question, max_items=4)

    if any(token in question_lc for token in ("7 hari", "7-day", "seven day", "forecast", "prediksi", "tonase", "sampah")):
        peak = forecast["peak"]
        daily_lines = "\n".join(
            f"- {item['date']}: {item['predicted_tons']:,.1f} tons"
            for item in forecast["daily_totals"][:7]
        ) or "- Forecast data is not available in the current snapshot."
        return (
            "Yes. JWIS can estimate waste tonnage for the next 7 days using the Waste Forecast module.\n\n"
            "**Current 7-day forecast**\n"
            f"- Forecast horizon: {forecast['days']} days\n"
            f"- Total projected waste: {forecast['total_tons']:,.1f} tons across the displayed forecast window\n"
            f"- Peak district/day: {peak.get('district', 'not available')} on {peak.get('date', 'not available')} "
            f"with {float(peak.get('predicted_tons', 0) or 0):,.1f} tons "
            f"(+{peak.get('spike_percent', 0)}% vs baseline)\n\n"
            "**Daily total view**\n"
            f"{daily_lines}\n\n"
            "**How to use it operationally**\n"
            "1. Open Waste Forecast to inspect district-level tonnage and risk drivers.\n"
            "2. Use the highest-spike district as the first dispatch priority.\n"
            "3. Send the forecast into Integrated Planning to allocate trucks, crews, and backup capacity."
        )

    if any(token in question_lc for token in ("jwis", "fitur", "feature", "data", "model", "arsitektur", "architecture", "cara kerja", "workflow", "map", "whatsapp", "field", "audit", "report")):
        return (
            "JWIS is an operational command center for Jakarta waste logistics. It connects live fleet supervision, "
            "waste forecasting, dispatch planning, field confirmation, and audit reporting into one workflow.\n\n"
            "**What Ana knows from JWIS RAG**\n"
            f"{rag_points}\n\n"
            "**Current operational snapshot**\n"
            f"- Active truck issues: {kpis.get('trucks_with_issues', 0)}\n"
            f"- Priority trucks: {alert_codes}\n"
            f"- TPA Bantargebang wait: {kpis.get('tpa_wait_minutes', 0)} minutes\n"
            f"- Highest forecast risk: {top.get('district', 'unknown')} (+{top.get('spike_percent', 0)}%)\n\n"
            "**Practical next step**\n"
            "Ask Ana about a specific area: forecast tonnage, route deviation, OSRM/A* routing, WhatsApp dispatch, field app confirmation, data sources, or model audit."
        )

    return (
        f"Based on the current command center, the biggest risk is {top.get('district', 'unknown')} "
        f"with a +{top.get('spike_percent', 0)}% waste spike forecast. Active truck issues: "
        f"{kpis.get('trucks_with_issues', 0)}; priority trucks: {alert_codes}; TPA wait is "
        f"{kpis.get('tpa_wait_minutes', 0)} minutes. Recommended response: dispatch the route fix, "
        "delay low-priority departures, and reserve extra crews for the highest-risk district."
    )


def answer_with_openai_if_configured(question: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    print("ASSISTANT: Entering answer_with_openai_if_configured")
    local_answer = answer_operational_question(question, snapshot)
    if _is_jwis_fact_question(question):
        return {
            "provider": "jwis-rag-local",
            "answer": local_answer,
        }

    rag_context = format_rag_context(question, top_k=6, max_chars=6500)
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("ASSISTANT: No API key, using local fallback")
        return {
            "provider": "local-fallback",
            "answer": local_answer,
        }

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    print(f"ASSISTANT: Configured URL: {url}, Model: {model}")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Kamu adalah Ana, asisten AI operasional utama untuk logistik sampah DLH Jakarta di sistem JWIS.\n"
                    "Gaya bicara: natural seperti ChatGPT, rapi, jelas, langsung ke inti, dan praktis untuk petugas lapangan.\n"
                    "Kamu memiliki RAG knowledge base JWIS. Gunakan konteks RAG sebagai sumber utama untuk menjawab hal tentang fitur, arsitektur, data, model, workflow, demo limit, dan narasi lomba JWIS.\n"
                    "Kamu menguasai seluruh aspek operasional JWIS:\n"
                    "1. Real-time Tracking & Anomaly (Case 1): Memantau rute truk, mendeteksi deviasi rute (geofencing corridor), estimasi rute pemulihan menggunakan A* routing dan OSRM, queue time TPA Bantargebang, serta simulasi staggered dispatch.\n"
                    "2. Waste Forecasting & Optimization (Case 2): Prediksi timbulan sampah per kecamatan/kelurahan untuk 7 hari ke depan berbasis Prophet + XGBoost (dipengaruhi curah hujan, cuaca, event keramaian, hari libur), alokasi armada (truk & kru) optimal menggunakan OR-Tools CP-SAT, serta audit kesesuaian armada.\n"
                    "Jika user bertanya apakah JWIS bisa memprediksi tonase sampah 7 hari ke depan, jawab tegas: YA. Jelaskan bahwa snapshot berisi daftar predictions 7 hari dengan predicted_tons, baseline_tons, spike_percent, risk_level, recommended_extra_trucks, recommended_extra_crews, dan faktor cuaca/event. Berikan angka tonase dari snapshot, bukan jawaban generik.\n"
                    "Gunakan data snapshot Pusat Komando JWIS untuk menjawab konkret, tetapi jangan menyalin field JSON mentah.\n"
                    "JANGAN tampilkan key teknis seperti is_damaged, flags, confidence, alert id, nama field snake_case, backtick code, atau koordinat mentah kecuali user memang meminta detail teknis.\n"
                    "Ubah field teknis menjadi bahasa manusia, misalnya is_damaged true menjadi 'truk dilaporkan rusak', off_corridor menjadi 'keluar dari koridor', dan far_off_corridor menjadi 'deviasi jauh dari rute'.\n"
                    "Format jawaban wajib rapi:\n"
                    "- Paragraf pembuka 1 kalimat berisi risiko utama.\n"
                    "- Bagian **Kenapa ini penting** berisi 2-3 poin singkat.\n"
                    "- Bagian **Tindakan yang perlu dilakukan** berisi 3 langkah bernomor yang siap dieksekusi.\n"
                    "Gunakan Markdown ringan saja: **judul tebal**, bullet, dan numbered list. Jangan pakai LaTeX, tabel panjang, atau dump data mentah."
                )
            },
            {
                "role": "user",
                "content": (
                    f"Question: {question}\n\n"
                    f"JWIS RAG context:\n{rag_context}\n\n"
                    f"Command center snapshot JSON:\n{json.dumps(snapshot)[:12000]}"
                ),
            },
        ],
    }
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        print("ASSISTANT: Calling urlopen...")
        with urlopen(request, timeout=15) as response:
            print("ASSISTANT: urlopen returned. Reading body...")
            body = response.read().decode("utf-8")
            print(f"ASSISTANT: Body read complete. Length: {len(body)}")
        
        # Robust parsing of stream or raw JSON
        def parse_body(text: str) -> dict[str, Any]:
            # Clean up the SSE stream noise
            text = text.replace("data: [DONE]", "").strip()
            
            # Try parsing the whole cleaned text
            try:
                return json.loads(text)
            except Exception:
                pass
                
            # If that fails, look for the JSON object within lines
            for line in reversed(text.splitlines()):
                line = line.strip()
                if not line:
                    continue
                if line.startswith("data: "):
                    line = line[6:].strip()
                try:
                    return json.loads(line)
                except Exception:
                    pass
            raise ValueError("Invalid JSON stream")

        parsed = parse_body(body)
        
        # Handle chat.completions format
        if "choices" in parsed and len(parsed["choices"]) > 0:
            answer = parsed["choices"][0]["message"]["content"]
            return {"provider": "openai", "model": model, "answer": answer}
            
        # Handle responses format fallback
        text_parts = []
        for output in parsed.get("output", []):
            for content in output.get("content", []):
                if content.get("type") == "output_text":
                    text_parts.append(content.get("text", ""))
        if text_parts:
            return {"provider": "openai", "model": model, "answer": "\n".join(text_parts).strip()}

        raise ValueError("Unknown JSON format")
    except Exception as error:
        return {
            "provider": "local-fallback",
            "error": str(error),
            "answer": local_answer,
        }
