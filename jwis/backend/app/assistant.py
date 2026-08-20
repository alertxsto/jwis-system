from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen

from app.rag import format_rag_context
from app.tools import TOOL_SCHEMAS, run_tools_pass, ToolContext

_GATEWAY_TIMEOUT = 45


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
    "- Panggil MAKSIMAL 2 tool yang paling relevan per pertanyaan; jangan panggil tool yang sama berulang.\n"
    "- AKURASI DI ATAS SEGALANYA: (a) status truk jangan digabung — truk rusak (is_damaged) BUKAN berarti deviasi rute; "
    "(b) jawab pada granularity yang ditanya — kecamatan BUKAN kota, kelurahan BUKAN kecamatan; (c) pakai angka dari tool "
    "apa adanya (trucks_required, crews_required), jangan hitung ulang dengan asumsi sendiri; (d) jangan mengarang detail "
    "yang tidak ada di hasil tool.\n"
    "- Jelaskan LOGIKA KEPUTUSAN: kenapa sistem merekomendasikan ini (ambang TPA 45/90 menit; hujan +16% di >=30mm; event "
    "+18% >=50.000 orang; weekend +7%; skor rute ETA/traffic/flood; stagger 15 menit).\n"
    "\n"
    "FORMAT JAWABAN\n"
    "- Gunakan Markdown kaya (rich) agar jawaban rapi seperti asisten AI modern: **bold** untuk penekanan, *italic* untuk "
    "istilah asing, bullet dan numbered list untuk langkah, ### heading kecil untuk bagian, dan Tabel markdown (| kolom | ) "
    "saat membandingkan angka (misal perbandingan antar truk, kecamatan, atau skenario). Tabel hanya jika memang "
    "membantu; jangan memaksakan tabel kalau jawaban sederhana.\n"
    "- Paragraf pembuka 1 kalimat: risiko utama saat ini.\n"
    "- Bagian **Kenapa ini penting**: 2-3 poin singkat (bisa bullet).\n"
    "- Bagian **Tindakan yang perlu dilakukan**: 3 langkah bernomor.\n"
    "- Jangan tampilkan JSON mentah, snake_case field, koordinat mentah atau backtick code, kecuali user minta detail "
    "teknis. Field teknis diubah menjadi bahasa manusia (is_damaged -> 'truk dilaporkan rusak', off_corridor -> 'keluar "
    "dari koridor').\n"
    "- Jawaban harus lengkap namun padat; target 120-220 kata, tabel maksimal 6 baris, dan tidak boleh hanya 1-2 kalimat.\n"
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


def _snapshot_digest(snapshot: dict[str, Any]) -> str:
    """Compact command-center digest for the prompt (~600 chars).

    The full snapshot JSON is megabytes of paths/predictions; tools fetch
    details on demand. The prompt only needs the headline state so the model
    knows what to drill into.
    """
    kpis = snapshot.get("kpis", {})
    queue = snapshot.get("tpa_queue", {})
    alerts = snapshot.get("alerts", [])[:5]
    preds = snapshot.get("critical_predictions", [])[:3]
    lines = [
        f"KPI: {kpis.get('active_trucks')} truk aktif, {kpis.get('trucks_with_issues')} bermasalah, "
        f"{kpis.get('pending_dispatches')} dispatch pending.",
        f"TPA Bantargebang: {queue.get('trucks_waiting')} truk antre, tunggu ~{queue.get('estimated_wait_minutes')} mnt "
        f"({queue.get('status')}).",
        f"Lonjakan prediksi terbesar: +{kpis.get('predicted_spike_percent')}%.",
        "Alert teratas: " + ("; ".join(
            f"{a.get('truck_code') or a.get('plate','?')}:{a.get('severity','?')}:{str(a.get('title',''))[:60]}"
            for a in alerts) or "tidak ada"),
        "Prediksi kritis: " + ("; ".join(
            f"{p.get('district','?')} +{p.get('spike_percent','?')}% ({p.get('predicted_tons','?')}t)"
            for p in preds) or "tidak ada"),
    ]
    return "\n".join(lines)


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


def answer_with_openai_if_configured(question, snapshot, history=None, tool_ctx=None,
                                     images=None) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"provider": "error", "error": "OPENAI_API_KEY is not configured", "answer": ""}

    rag_context = format_rag_context(question, top_k=5, max_chars=3000)
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    clean_history = _sanitize_history(history)
    user_prompt = (
        f"Question: {question}\n\n"
        f"JWIS RAG context:\n{rag_context}\n\n"
        f"Command center state (ringkasan; detail live tersedia via tools):\n{_snapshot_digest(snapshot)}"
    )

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
        "max_tokens": 1500,
        "stream": False,
    }
    if tool_ctx is not None:
        payload["tools"] = TOOL_SCHEMAS
        payload["tool_choice"] = "auto"

    def call_gateway() -> str:
        request = Request(url, data=json.dumps(payload).encode("utf-8"),
                          headers={"Authorization": f"Bearer {api_key}",
                                   "Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=_GATEWAY_TIMEOUT) as response:
            return response.read().decode("utf-8")

    tools_used: list[str] = []
    for _round in range(2):
        try:
            body = call_gateway()
        except Exception as error:
            return {"provider": "error", "error": str(error), "answer": ""}

        message = _parse_body(body).get("choices", [{}])[0].get("message", {})
        tool_calls = message.get("tool_calls") or []

        if tool_calls and tool_ctx is not None:
            messages.append(message)
            messages.extend(run_tools_pass(tool_calls, tool_ctx))
            tools_used.extend(call.get("function", {}).get("name", "") for call in tool_calls)
            payload["messages"] = messages
            continue

        answer = message.get("content") or ""
        if not answer:
            return {"provider": "error", "error": "empty model content", "answer": ""}
        return {"provider": "openai", "model": model, "answer": answer, "tools_used": tools_used}

    if tools_used:
        payload.pop("tools", None)
        payload.pop("tool_choice", None)
        try:
            body = call_gateway()
        except Exception as error:
            return {"provider": "error", "error": str(error), "answer": ""}
        final_answer = _parse_body(body).get("choices", [{}])[0].get("message", {}).get("content") or ""
        if final_answer:
            return {"provider": "openai", "model": model, "answer": final_answer, "tools_used": tools_used}

    return {"provider": "error", "error": "model did not answer after tool rounds", "answer": ""}