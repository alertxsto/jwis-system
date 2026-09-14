"""Weighbridge display OCR via OpenAI-compatible vision API (Fase 3).

Never fabricates a number: any parse/transport/config failure yields
weight_kg=None with an explicit confidence label — the driver falls back
to manual entry with a clear message.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
from typing import Any, Callable

logger = logging.getLogger(__name__)

MAX_WEIGHT_KG = 100_000.0
_TIMEOUT_SECONDS = 15.0

_SYSTEM_PROMPT = "Kamu pembaca display timbangan digital. Jawab HANYA JSON."
_USER_PROMPT = ("Baca angka berat (kg) pada foto display timbangan ini. "
                "Jawab JSON {\"weight_kg\": <number|null>} — null bila tidak terbaca.")


def _default_http_post(url: str, headers: dict, json_body: dict,
                       timeout: float) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(json_body).encode(),
        headers={"Content-Type": "application/json", **headers}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _extract_weight(content: str) -> float | None:
    match = re.search(r'\{[^{}]*"weight_kg"[^{}]*\}', content)
    if not match:
        return None
    try:
        value = json.loads(match.group(0)).get("weight_kg")
    except (json.JSONDecodeError, AttributeError):
        return None
    if value is None:
        return None
    try:
        weight = float(value)
    except (TypeError, ValueError):
        return None
    if 0 < weight < MAX_WEIGHT_KG:
        return weight
    return None


def read_weight_from_photo(photo_b64: str,
                           http_post: Callable[..., dict] | None = None) -> dict[str, Any]:
    source = f"openai-vision ({os.getenv('OPENAI_MODEL', 'gpt-4.1-mini')})"
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"weight_kg": None, "raw_text": "OPENAI_API_KEY is not set",
                "confidence": "failed", "source": source}
    post = http_post or _default_http_post
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    body = {
        "model": os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": _USER_PROMPT},
                {"type": "image_url", "image_url": {"url": photo_b64}},
            ]},
        ],
        "max_tokens": 100,
    }
    try:
        resp = post(url=f"{base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json_body=body, timeout=_TIMEOUT_SECONDS)
        content = resp["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        logger.exception("timbangan OCR call failed")
        return {"weight_kg": None, "raw_text": f"OCR call failed: {exc}",
                "confidence": "failed", "source": source}
    if not isinstance(content, str):
        return {"weight_kg": None, "raw_text": "OCR returned empty content",
                "confidence": "failed", "source": source}
    weight = _extract_weight(content)
    if weight is None:
        return {"weight_kg": None, "raw_text": content[:200],
                "confidence": "low", "source": source}
    return {"weight_kg": weight, "raw_text": content[:200],
            "confidence": "high", "source": source}
