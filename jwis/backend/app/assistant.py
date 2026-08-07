from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib.request import Request, urlopen

from app.rag import format_rag_context, retrieve_jwis_context
from app.tools import TOOL_SCHEMAS, run_tools_pass, ToolContext


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


def _sanitize_history(history: list[dict] | None, max_messages: int = 8, max_chars: int = 2000) -> list[dict]:
    """Only user/assistant turns; cap count, cap per-message length."""
    if not history:
        return []
    clean: list[dict] = []
    for message in history[-max_messages:]:
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        if role not in {"user", "assistant"}:
            continue
        content = str(message.get("content", ""))[:max_chars]
        if not content:
            continue
        clean.append({"role": role, "content": content})
    return clean


SYSTEM_PROMPT = (
    "Kamu adalah Ana, asisten AI operasional utama untuk logistik sampah DLH Jakarta dalam sistem JWIS.\n"
    "Gaya bicara: natural seperti ChatGPT, rapi, jelas, langsung ke inti, dan nyaman untuk petugas lapangan.\n"
    "\n"
    "Kebijakan JANGKA WEWENANG\n"
    "- Pertanyaan di luar JWIS: tolak dengan halus lalu arahkan kembali. Misal: \"Maaf, aku asisten operasional JWIS untuk DLH "
    "Jakarta. Aku bisa bantu seputar monitoring armada, prediksi sampah, antrean TPA, dispatch, atau audit operasional.\"\n"
    "- Kamu TIDAK PERNAH mengeksekusi aksi (dispatch, approve, kirim WhatsApp). Kamu hanya merekomendasikan tindakan; "
    "operator yang mengklik tombol di dashboard.\n"
    "- Jangan pernah mengklaim WhatsApp terkirim; lihat status gateway dari tool dan jujur.\n"
    "\n"
    "PENGETAHUAN JWIS\n"
    "- Konteks RAG JWIS adalah sumber utama untuk fitur, arsitektur, data, model, workflow, dan batasan demo (lomba).\n"
    "- Untuk angka live (berapa truk, ton, antrean, prediksi), WAJIB pakai hasil tool. Jangan mengarang angka; jika tidak "
    "diketahui, katakan tidak tahu.\n"
    "- Jelaskan LOGIKA KEPUTUSAN: kenapa sistem merekomendasikan ini (ambang TPA 45/90 menit; hujan +16% di >=30mm; event "
    "+18% >=50.000 orang; weekend +7%; skor rute ETA/traffic/flood; stagger 15 menit).\n"
    "\n"
    "FORMAT JAWABAN\n"
    "- Paragraf pembuka 1 kalimat: risiko utama saat ini.\n"
    "- Bagian **Kenapa ini penting**: 2-3 poin singkat.\n"
    "- Bagian **Tindakan yang perlu dilakukan**: 3 langkah bernomor.\n"
    "- Markdown ringan (**bold**, bullet, numbered). Jangan tampilkan JSON mentah, snake_case field, koordinat mentah "
    "atau backtick code, kecuali user minta detail teknis. Field teknis diubah menjadi bahasa manusia "
    "(is_damaged -> 'truk dilaporkan rusak', off_corridor -> 'keluar dari koridor').\n"
)


def _parse_body(text: str) -> dict[str, Any]:
    text = text.replace("data: [DONE]", "").strip()
    try:
        return json.loads(text)
    except Exception:
        pass
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


def answer_with_openai_if_configured(question, snapshot, history=None, tool_ctx=None) -> dict[str, Any]:
    local_answer = answer_operational_question(question, snapshot)
    if not os.getenv("OPENAI_API_KEY"):
        return {"provider": "jwis-rag-local", "answer": local_answer}

    rag_context = format_rag_context(question, top_k=6, max_chars=6500)
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    clean_history = _sanitize_history(history)
    user_prompt = (
        f"Question: {question}\n\n"
        f"JWIS RAG context:\n{rag_context}\n\n"
        f"Command center snapshot JSON:\n{json.dumps(snapshot)[:12000]}"
    )
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(clean_history)
    messages.append({"role": "user", "content": user_prompt})

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": 2000,
    }
    if tool_ctx is not None:
        payload["tools"] = TOOL_SCHEMAS
        payload["tool_choice"] = "auto"

    tools_used: list[str] = []
    for _round in range(2):  # ≤2 LLM rounds: initial + tool follow-up
        request = Request(url, data=json.dumps(payload).encode("utf-8"),
                          headers={"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                                   "Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(request, timeout=15) as response:
                body = response.read().decode("utf-8")
        except Exception as error:
            return {"provider": "local-fallback", "error": str(error), "answer": local_answer}

        parsed = _parse_body(body)
        choice = parsed.get("choices", [{}])[0]
        message = choice.get("message", {})
        tool_calls = message.get("tool_calls") or []

        if tool_calls and tool_ctx is not None:
            messages.append(message)
            messages.extend(run_tools_pass(tool_calls, tool_ctx))
            tools_used.extend(call.get("function", {}).get("name", "") for call in tool_calls)
            payload["messages"] = messages
            continue

        answer = message.get("content") or ""
        if not answer:
            return {"provider": "local-fallback", "wrong": "empty model content", "answer": local_answer}
        return {"provider": "openai", "model": model, "answer": answer, "tools_used": tools_used}

    return {"provider": "local-fallback", "answer": local_answer}
