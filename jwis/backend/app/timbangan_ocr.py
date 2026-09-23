"""Read the loaded truck's weighbridge receipt/display via GutsAI vision.

Never fabricate a number: config, transport, or parsing failures return null
so the driver can confirm the weight manually against the same photo.
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

_SYSTEM_PROMPT = "Kamu pembaca struk atau display timbangan truk. Jawab HANYA JSON."
_USER_PROMPT = (
    'Baca berat truk berisi sampah dalam kg pada foto ini. Jika struk memuat '
    'bruto/gross dan tara/netto, gunakan bruto/gross (berat truk bermuatan). '
    'Jika hanya ada satu angka berat jelas pada display, gunakan angka itu. '
    'Jangan menebak angka yang buram atau ambigu. '
    'Jawab JSON {"weight_kg": <number|null>} — null jika tidak terbaca.'
)


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
    if isinstance(value, bool) or not isinstance(value, (int, float)):
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
    model = os.getenv("GUTS_VISION_MODEL") or "gemini-3.8-flash"
    source = f"gutsai-vision ({model})"
    api_key = os.getenv("GUTS_API_KEY")
    if not api_key:
        return {"weight_kg": None, "raw_text": "GUTS_API_KEY is not set",
                "confidence": "failed", "source": source}
    post = http_post or _default_http_post
    base_url = (os.getenv("GUTS_BASE_URL") or "https://api.gutsai.id/v1").rstrip("/")
    body = {
        "model": model,
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
    except Exception:  # noqa: BLE001
        logger.exception("timbangan OCR call failed")
        return {"weight_kg": None, "raw_text": "OCR request failed",
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
