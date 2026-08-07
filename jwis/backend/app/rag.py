from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer


JWIS_ROOT = Path(__file__).resolve().parents[2]


CURATED_KNOWLEDGE = [
    {
        "source": "curated:jwis_overview",
        "title": "JWIS overview",
        "text": (
            "JWIS, the Jakarta Waste Intelligence System, is an AI command center for DLH Jakarta waste operations. "
            "Fitur utama JWIS dan cara kerja JWIS mencakup monitoring armada, prediksi sampah, perencanaan dispatch, "
            "asisten Ana, peta operasional, audit model, dan laporan eksekutif. "
            "It combines fleet supervision, route deviation detection, OSRM road-following routing, A* rerouting simulation, "
            "TPA Bantargebang queue awareness, seven-day waste tonnage forecasting, Open-Meteo weather risk, integrated planning, "
            "WhatsApp/field dispatch, field confirmation, audit history, and executive reporting."
        ),
    },
    {
        "source": "curated:waste_forecast",
        "title": "Waste forecast capability",
        "text": (
            "The Waste Forecast module predicts waste tonnage for the next 7 days. It uses district-level predictions with "
            "predicted_tons, baseline_tons, spike_percent, risk_level, recommended_extra_trucks, recommended_extra_crews, "
            "man_hours_required, crews_required, disposal_bins_required, fuel consumption, and CO2 impact. Forecast drivers include "
            "Open-Meteo rainfall, temperature, wind, weekends, holidays, and permitted crowd events. The frontend also has 14-day "
            "and 30-day projection controls for demo planning, extending the 7-day source baseline."
        ),
    },
    {
        "source": "curated:fleet_routing",
        "title": "Fleet routing and map operations",
        "text": (
            "Fleet Operations shows a MapLibre live supervision map. Vehicles are classified by corridor compliance and condition. "
            "T-047 is the critical route deviation demo truck. JWIS compares assigned and actual movement, highlights violation "
            "segments, and recommends recovery routes such as Route B - Daan Mogot Recovery. OSRM supplies road geometry, ETA, "
            "and route evidence. A* dynamic rerouting simulates corridor congestion and diverts trucks through recovery paths."
        ),
    },
    {
        "source": "curated:dispatch_loop",
        "title": "Dispatch and field confirmation loop",
        "text": (
            "JWIS is a closed operational loop: detect, predict, recommend, approve, dispatch, confirm, and audit. Managers approve "
            "dispatch actions in the command center. Drivers receive clear instructions in the field app or through WhatsApp Gateway "
            "when Baileys is connected. Field confirmations are stored in the backend history so managers can verify whether an "
            "instruction was received and acted on."
        ),
    },
    {
        "source": "curated:data_provenance",
        "title": "Data provenance and honest demo limits",
        "text": (
            "JWIS uses public and fallback sources: Open-Meteo weather forecast and historical weather, Indonesian holiday calendar, "
            "Jakarta administrative geography, SILIKA/DLH-derived waste references, SIPSN/Bantargebang references where available, "
            "OSRM public routing, and explicit simulated fleet/event inputs for prototype demonstration. The system must describe "
            "fleet GPS, event inputs, and some waste seed data as simulated or fallback when they are not official live feeds."
        ),
    },
    {
        "source": "curated:assistant_behavior",
        "title": "Ana assistant behavior",
        "text": (
            "Ana is the operational AI assistant inside JWIS. Ana should answer questions about JWIS features, data, forecast, routing, "
            "dispatch, map pins, WhatsApp Gateway, field app, model audit, demo limitations, and competition narrative. Ana should be "
            "clear, practical, and honest. Ana must not claim live WhatsApp delivery unless the gateway is connected and the send result "
            "confirms delivery. Ana should avoid raw JSON, snake_case fields, and unexplained technical labels in normal answers."
        ),
    },
]


DOCUMENT_PATHS = [
    "README.md",
    "PRODUCT.md",
    "DATA_RESEARCH_EDA.md",
    "EXECUTIVE_SUMMARY_CASE1.md",
    "EXECUTIVE_SUMMARY_CASE2.md",
    "SLIDE_DECK_15_SLIDES.md",
    "semifinal-video/NARRATION_SCRIPT_EN.md",
    "data/processed/eda_report.md",
    "data/processed/fleet_anomaly_evaluation.md",
    "data/processed/hybrid_forecaster_evaluation.md",
    "data/processed/system_impact_evaluation.md",
    "data/sources/DATA_RESEARCH_SUMMARY.md",
    "docs/evidence/PUBLIC_EVIDENCE_DOSSIER.md",
    "docs/audit/2026-07-13-project-readiness-audit.md",
    "frontend/DESIGN.md",
    "backend/driver_contacts.json",
    "backend/wa-gateway/package.json",
]


@dataclass(frozen=True)
class RagChunk:
    source: str
    title: str
    text: str


@dataclass
class RagIndex:
    chunks: list[RagChunk]
    vectorizer: TfidfVectorizer
    mean: np.ndarray
    components: np.ndarray
    scale: np.ndarray
    vectors: np.ndarray
    raw_vectors: np.ndarray


def _clean_text(text: str) -> str:
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _read_document(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if path.suffix == ".json":
        try:
            text = json.dumps(json.loads(text), indent=2, ensure_ascii=False)
        except Exception:
            pass
    return _clean_text(text[:30000])


def _chunk_text(source: str, title: str, text: str, max_chars: int = 1400, overlap: int = 220) -> list[RagChunk]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[RagChunk] = []
    current = ""
    for paragraph in paragraphs:
        if len(current) + len(paragraph) + 2 <= max_chars:
            current = f"{current}\n\n{paragraph}".strip()
            continue
        if current:
            chunks.append(RagChunk(source=source, title=title, text=current))
        current = paragraph[-max_chars:]
    if current:
        chunks.append(RagChunk(source=source, title=title, text=current))

    if overlap <= 0 or len(chunks) <= 1:
        return chunks
    overlapped: list[RagChunk] = []
    prev_tail = ""
    for chunk in chunks:
        text_with_overlap = f"{prev_tail}\n\n{chunk.text}".strip() if prev_tail else chunk.text
        overlapped.append(RagChunk(source=chunk.source, title=chunk.title, text=text_with_overlap[-max_chars:]))
        prev_tail = chunk.text[-overlap:]
    return overlapped


def load_rag_chunks() -> list[RagChunk]:
    chunks: list[RagChunk] = [
        RagChunk(source=item["source"], title=item["title"], text=item["text"])
        for item in CURATED_KNOWLEDGE
    ]
    for relative in DOCUMENT_PATHS:
        path = JWIS_ROOT / relative
        if not path.exists():
            continue
        text = _read_document(path)
        if not text:
            continue
        title = path.stem.replace("_", " ").replace("-", " ").title()
        chunks.extend(_chunk_text(source=relative, title=title, text=text))
    return chunks


def _fit_whitening(vectors: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    mean = vectors.mean(axis=0, keepdims=True)
    centered = vectors - mean
    if centered.shape[0] < 2:
        components = np.eye(centered.shape[1], dtype=np.float32)
        scale = np.ones(centered.shape[1], dtype=np.float32)
        return mean, components, scale

    _, singular_values, vt = np.linalg.svd(centered, full_matrices=False)
    eps = 1e-6
    scale = np.sqrt(max(centered.shape[0] - 1, 1)) / np.maximum(singular_values, eps)
    return mean.astype(np.float32), vt.astype(np.float32), scale.astype(np.float32)


def _apply_whitening(vectors: np.ndarray, mean: np.ndarray, components: np.ndarray, scale: np.ndarray) -> np.ndarray:
    projected = (vectors - mean) @ components.T
    whitened = projected * scale
    norm = np.linalg.norm(whitened, axis=1, keepdims=True)
    return whitened / np.maximum(norm, 1e-9)


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.maximum(norm, 1e-9)


@lru_cache(maxsize=1)
def build_rag_index() -> RagIndex:
    chunks = load_rag_chunks()
    texts = [f"{chunk.title}\n{chunk.text}" for chunk in chunks]
    vectorizer = TfidfVectorizer(
        lowercase=True,
        strip_accents="unicode",
        ngram_range=(1, 2),
        max_features=5000,
        min_df=1,
        sublinear_tf=True,
    )
    raw = vectorizer.fit_transform(texts).astype(np.float32).toarray()
    raw_vectors = _normalize(raw)
    mean, components, scale = _fit_whitening(raw)
    vectors = _apply_whitening(raw, mean, components, scale)
    return RagIndex(
        chunks=chunks,
        vectorizer=vectorizer,
        mean=mean,
        components=components,
        scale=scale,
        vectors=vectors,
        raw_vectors=raw_vectors,
    )


def retrieve_jwis_context(question: str, top_k: int = 5) -> list[dict[str, Any]]:
    index = build_rag_index()
    query_text = (
        f"{question or 'JWIS overview'} "
        "JWIS fitur feature cara kerja workflow overview arsitektur architecture forecast routing dispatch audit map"
    )
    query_raw = index.vectorizer.transform([query_text]).astype(np.float32).toarray()
    query = _apply_whitening(query_raw, index.mean, index.components, index.scale)[0]
    query_lexical = _normalize(query_raw)[0]
    whitened_scores = index.vectors @ query
    lexical_scores = index.raw_vectors @ query_lexical
    scores = (0.55 * whitened_scores) + (0.45 * lexical_scores)
    order = np.argsort(scores)[::-1][:top_k]
    results = []
    for idx in order:
        chunk = index.chunks[int(idx)]
        results.append(
            {
                "source": chunk.source,
                "title": chunk.title,
                "text": chunk.text,
                "score": float(scores[int(idx)]),
            }
        )
    return results


def format_rag_context(question: str, top_k: int = 5, max_chars: int = 5000) -> str:
    parts = []
    for item in retrieve_jwis_context(question, top_k=top_k):
        parts.append(
            f"[{item['title']} | {item['source']} | score={item['score']:.3f}]\n{item['text']}"
        )
    context = "\n\n---\n\n".join(parts)
    return context[:max_chars]
