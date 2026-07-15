from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen


def _top_prediction(snapshot: dict[str, Any]) -> dict[str, Any]:
    predictions = snapshot.get("critical_predictions", [])
    return max(predictions, key=lambda item: item.get("spike_percent", 0), default={})


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
    kpis = snapshot.get("kpis", {})
    top = _top_prediction(snapshot)
    alerts = snapshot.get("alerts", [])
    alert_codes = ", ".join(alert.get("truck_code", "-") for alert in alerts[:3]) or "none"
    return (
        f"Based on the current command center, the biggest risk is {top.get('district', 'unknown')} "
        f"with a +{top.get('spike_percent', 0)}% waste spike forecast. Active truck issues: "
        f"{kpis.get('trucks_with_issues', 0)}; priority trucks: {alert_codes}; TPA wait is "
        f"{kpis.get('tpa_wait_minutes', 0)} minutes. Recommended response: dispatch the route fix, "
        "delay low-priority departures, and reserve extra crews for the highest-risk district."
    )


def answer_with_openai_if_configured(question: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "provider": "local-fallback",
            "answer": answer_operational_question(question, snapshot),
        }

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    url = f"{base_url}/chat/completions"
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "You are JWIS, a concise operational assistant for DLH Jakarta waste logistics.",
            },
            {
                "role": "user",
                "content": f"Question: {question}\n\nCommand center snapshot JSON:\n{json.dumps(snapshot)[:12000]}",
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
        with urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8")
        
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
            "answer": answer_operational_question(question, snapshot),
        }
