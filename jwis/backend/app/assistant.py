from __future__ import annotations

import json
import os
import re
from urllib.request import Request, urlopen

from app.rag import format_rag_context
from app.tools import TOOL_SCHEMAS, execute_tool, run_tools_pass, ToolContext

_GATEWAY_TIMEOUT = 18
_IMAGE_GATEWAY_TIMEOUT = 30
_MAX_TOOL_CALLS = 2


def _top_prediction(snapshot: dict[str, Any]) -> dict[str, Any]:
    predictions = snapshot.get("critical_predictions", [])
    return max(predictions, key=lambda item: item.get("spike_percent", 0), default={})


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
    "Kamu Ana, asisten operasional JWIS untuk DLH Jakarta. Jawab pertanyaan pengguna secara langsung "
    "dalam bahasa yang dipakai pengguna; pertanyaan sederhana boleh dijawab satu atau dua kalimat. "
    "Gunakan daftar, tabel, atau langkah tindakan hanya jika membantu pertanyaan itu. Jangan membuka "
    "jawaban dengan prediksi, risiko, atau rekomendasi yang tidak diminta.\n"
    "Gunakan konteks pengetahuan JWIS hanya untuk menjelaskan fitur dan proses, bukan sebagai angka "
    "operasional terkini. Untuk angka/status terkini, prakiraan, atau klaim data, panggil tool yang "
    "sesuai jika tersedia. Jangan mengarang angka atau menyimpulkan status truk rusak sebagai deviasi "
    "rute. Bedakan kota, kecamatan, dan kelurahan; nyatakan keterbatasan sumber atau kegagalan tool.\n"
    "Pilih paling banyak dua tool yang relevan jika pertanyaan memerlukan data; jangan panggil tool "
    "untuk sapaan atau penjelasan umum. Jika butuh prakiraan kecamatan, minta include_kecamatan=true "
    "pada get_predictions; untuk prakiraan kota saja, jangan minta itu. Semua tool bersifat baca-saja: "
    "jangan klaim telah dispatch, approve, atau mengirim WhatsApp. Tolak permintaan di luar JWIS dengan "
    "sopan. Jangan tampilkan JSON mentah atau nama field teknis kecuali diminta."
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


def _knowledge_context(question: str, images: list[str] | None = None) -> str:
    """Documentation is useful for explanations, not as a substitute for live tools."""
    if images or re.search(r"\b(status|saat ini|sekarang|today|now|berapa|jumlah)\b", question.lower()):
        return ""
    q = question.lower().strip()
    if not any(word in q for word in (
        "apa itu", "bagaimana", "gimana", "mengapa", "kenapa", "cara ", "alur ",
        "sumber ", "metode ", "model ", "fitur ", "batasan ", "jelaskan",
        "how ", "why ", "what is", "explain", "workflow",
    )):
        return ""
    return format_rag_context(question, top_k=2, max_chars=1600)

def _required_live_tools(question: str) -> set[str]:
    q = question.lower()
    if re.search(r"\b(apa itu|how does|bagaimana cara)\b", q) or "sumber data" in q:
        return set()
    if any(term in q for term in ("prediksi", "forecast", "prakiraan ton", "timbulan")):
        return {"get_predictions"}
    if any(term in q for term in ("tpa", "antrean", "antrian")):
        return {"get_tpa_queue", "get_command_center_snapshot"}
    if any(term in q for term in ("truk", "armada", "fleet")):
        if any(term in q for term in ("deviasi", "menyimpang", "rusak", "kerusakan")):
            return {"get_fleet_status"}
        if any(term in q for term in ("berapa", "jumlah", "bermasalah", "how many")):
            return {"get_fleet_status", "get_command_center_snapshot"}
        return {"get_fleet_status", "get_fleet_history", "get_truck_breadcrumbs",
                "get_route_options", "simulate_astar_reroute", "get_command_center_snapshot"}
    if any(term in q for term in ("cuaca", "hujan", "weather")):
        return {"get_weather", "get_command_center_snapshot"}
    if "whatsapp" in q or "gateway" in q:
        return {"get_whatsapp_status"}
    if any(term in q for term in ("berapa", "jumlah", "status saat ini", "how many")):
        return {"get_command_center_snapshot", "get_fleet_status", "get_tpa_queue",
                "get_predictions", "get_weather", "get_events", "get_data_provenance"}
    return set()


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


def _answer_locally(question: str, snapshot: dict[str, Any], tool_ctx: ToolContext | None = None,
                    images: list[str] | None = None) -> dict[str, Any]:
    """No-key fallback: use only data from a tool matching the question."""
    if images:
        return {
            "provider": "local", "mode": "local", "tools_used": [],
            "answer": "Mode lokal aktif (asisten LLM tidak dikonfigurasi). Analisis foto/PDF memerlukan layanan AI.",
        }
    q = question.lower()
    answer = None
    used: list[str] = []
    if tool_ctx is not None and not re.search(r"\b(apa itu|how does|bagaimana cara)\b", q):
        name = None
        args: dict[str, Any] = {}
        if any(term in q for term in ("prediksi", "forecast", "prakiraan ton", "timbulan")):
            name = "get_predictions"
        elif "tpa" in q or "antrean" in q or "antrian" in q:
            name = "get_tpa_queue"
        elif any(term in q for term in ("truk", "armada", "fleet")):
            name = "get_fleet_status"
            code = re.search(r"\bT-\d+\b", question, re.IGNORECASE)
            if code:
                args["truck_code"] = code.group().upper()
        if name:
            result = execute_tool(name, args, tool_ctx)
            if "error" not in result:
                used = [name]
                if name == "get_fleet_status":
                    if args.get("truck_code"):
                        truck = (result.get("trucks") or [None])[0]
                        if truck:
                            answer = (
                                f"Armada {truck['truck_code']}: status {truck['status']}; "
                                f"kerusakan: {'ya' if truck['is_damaged'] else 'tidak'}; "
                                f"deviasi rute: {'ya' if truck['deviation_violated'] else 'tidak'}."
                            )
                        else:
                            answer = f"Data armada {args['truck_code']} tidak tersedia."
                    else:
                        if any(term in q for term in ("deviasi", "menyimpang")):
                            label, count = "mengalami deviasi rute", result["deviation_count"]
                            affected = [t for t in result["problem_trucks"] if t["deviation_violated"]]
                        elif any(term in q for term in ("rusak", "kerusakan")):
                            label, count = "mengalami kerusakan", result["damaged_count"]
                            affected = [t for t in result["problem_trucks"] if t["is_damaged"]]
                        elif "aktif" in q:
                            label, count = "aktif", result["active_count"]
                            affected = []
                        else:
                            label, count = "bermasalah", result["problem_count"]
                            affected = result.get("problem_trucks", [])
                        answer = f"Data armada JWIS: {count} truk {label} dari {result['total_trucks']} truk."
                        if affected and re.search(r"\b(mana|which|siapa)\b", q):
                            codes = ", ".join(t["truck_code"] for t in affected[:5])
                            answer += f" Truk terkait: {codes}."
                elif name == "get_tpa_queue":
                    answer = (
                        f"Simulasi antrean TPST Bantargebang: {result['trucks_in_queue']} truk, "
                        f"perkiraan tunggu rata-rata {result['avg_wait_minutes']} menit "
                        f"({result['status_label']}). Ini simulasi, bukan pengamatan langsung."
                    )
                else:
                    predictions = result.get("predictions_daily_city", [])
                    if predictions:
                        district = next((p["district"] for p in predictions
                                         if p.get("district", "").lower() in q), None)
                        first_date = predictions[0]["date"]
                        day = [p for p in predictions if p["date"] == first_date
                               and (district is None or p["district"] == district)]
                        figures = "; ".join(
                            f"{p['district']}: {p['predicted_tons']} ton" for p in day
                        )
                        answer = f"Prediksi JWIS {first_date} per kota: {figures}."
    if answer is None:
        rag = _knowledge_context(question).strip()
        if rag and rag.lower() != "no matching jwis knowledge found.":
            answer = f"Informasi terkait dari basis pengetahuan JWIS:\n{rag}"
        else:
            answer = "Data yang sesuai pertanyaan belum tersedia dalam mode lokal. Layanan AI diperlukan untuk jawaban lebih rinci."
    return {
        "provider": "local", "mode": "local",
        "answer": f"Mode lokal aktif (asisten LLM tidak dikonfigurasi).\n\n{answer}",
        "tools_used": used,
    }


def answer_with_openai_if_configured(question, snapshot, history=None, tool_ctx=None,
                                     images=None) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _answer_locally(question, snapshot, tool_ctx, images)

    rag_context = _knowledge_context(question, images)
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    clean_history = _sanitize_history(history)
    user_prompt = question
    if rag_context:
        user_prompt += f"\n\nReferensi dokumentasi JWIS (bukan status/angka live):\n{rag_context}"

    if images:
        content: list[dict[str, Any]] = [{"type": "text", "text": user_prompt}]
        for img in images[:5]:
            content.append({"type": "image_url", "image_url": {"url": img}})
        user_message: dict[str, Any] = {"role": "user", "content": content}
    else:
        user_message = {"role": "user", "content": user_prompt}

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(clean_history)
    messages.append(user_message)

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": 600,
        "stream": False,
    }
    if tool_ctx is not None:
        payload["tools"] = TOOL_SCHEMAS
        payload["tool_choice"] = "auto"

    def call_gateway() -> dict[str, Any]:
        request = Request(url, data=json.dumps(payload).encode("utf-8"),
                          headers={"Authorization": f"Bearer {api_key}",
                                   "Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=_IMAGE_GATEWAY_TIMEOUT if images else _GATEWAY_TIMEOUT) as response:
            return _parse_body(response.read().decode("utf-8"))

    try:
        message = call_gateway().get("choices", [{}])[0].get("message", {})
        tool_calls = message.get("tool_calls") or []
        tools_used: list[str] = []
        if tool_calls and tool_ctx is not None:
            messages.append(message)
            tool_messages = run_tools_pass(tool_calls, tool_ctx, max_calls=_MAX_TOOL_CALLS)
            messages.extend(tool_messages)
            for tool_message in tool_messages:
                result = json.loads(tool_message["content"])
                if not isinstance(result, dict) or "error" not in result:
                    name = tool_message["name"]
                    if name not in tools_used:
                        tools_used.append(name)
            payload["messages"] = messages
            payload.pop("tools", None)
            payload.pop("tool_choice", None)
            message = call_gateway().get("choices", [{}])[0].get("message", {})
        answer = message.get("content") or ""
        if not isinstance(answer, str) or not answer.strip():
            return {"provider": "error", "error": "empty model content", "answer": ""}
        required = _required_live_tools(question)
        if tool_ctx is not None and required and not required.intersection(tools_used):
            answer = "Saya belum dapat memverifikasi data operasional yang sesuai pertanyaan dari tool JWIS."
        return {"provider": "openai", "model": model, "answer": answer, "tools_used": tools_used}
    except Exception as error:
        return {"provider": "error", "error": str(error), "answer": ""}