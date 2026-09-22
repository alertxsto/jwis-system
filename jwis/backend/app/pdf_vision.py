# -*- coding: utf-8 -*-
"""PDF page → image conversion for ANA's multimodal vision pipeline.

The gateway model (ag/gemini-3-flash) supports vision:true but pdf:false.
This module bridges that gap: render each PDF page to a PNG at 150 DPI and
return data URLs the model can ingest as image_url content.
"""
from __future__ import annotations

import base64
import io
from typing import Any

import pymupdf


_MAX_PAGES = 3
_RENDER_DPI = 100


def pdf_bytes_to_image_data_urls(pdf_bytes: bytes, max_pages: int = _MAX_PAGES) -> list[str]:
    """Render up to max_pages PDF pages as base64 JPEG data URLs."""
    urls: list[str] = []
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    zoom = _RENDER_DPI / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    for page in doc:
        if len(urls) >= max_pages:
            break
        pix = page.get_pixmap(matrix=matrix)
        jpg_bytes = pix.tobytes("jpeg", jpg_quality=85)
        b64 = base64.b64encode(jpg_bytes).decode("ascii")
        urls.append(f"data:image/jpeg;base64,{b64}")
    doc.close()
    return urls


def data_url_to_bytes(data_url: str) -> tuple[bytes, str]:
    """Split a data URL into raw bytes and its mime type."""
    header, _, b64 = data_url.partition(",")
    mime = header.split(":")[1].split(";")[0] if ":" in header else "application/octet-stream"
    return base64.b64decode(b64), mime


def resolve_file_to_images(file_data: str, file_type: str) -> list[str]:
    """Resolve an uploaded file (image or PDF) into a list of image data URLs."""
    if file_type == "image":
        return [file_data]
    if file_type == "pdf":
        raw, _ = data_url_to_bytes(file_data)
        return pdf_bytes_to_image_data_urls(raw)
    return []
