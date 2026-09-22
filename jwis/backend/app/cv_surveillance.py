# -*- coding: utf-8 -*-
"""Computer-vision gate surveillance (Case 1 illegal-activity requirement).

Pipeline: a demo video file loops like a CCTV/ANPR gate feed -> YOLOv8n detects
trucks -> the plate region is cropped from the full-resolution frame -> EasyOCR
reads the plate -> `collector_registry.check_vehicle` decides whether the plate
is on the DLH authorized whitelist. Unlicensed plates surface as `critical`
events, exactly the "unlicensed waste collector" the case statement asks to
detect.

Like `gps_feed.py`, the feed is a SIMULATED feed (labeled `source="simulated"`).
The contract (events) is identical to what a real gate camera + ANPR would
produce: swap the frame source for a camera index/RTSP at pilot and nothing
downstream changes.

Engine (YOLO + EasyOCR) loads lazily on first use so the FastAPI app and test
suite start fast and offline. In tests the detector/OCR functions are
monkeypatched, so no model download or GPU is required.
"""
from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.collector_registry import check_vehicle

# Demo clips live next to the backend package: backend/demo_media/
DEMO_MEDIA_DIR = Path(__file__).resolve().parents[1] / "demo_media"
# Preferred file name; fall back to the first video found in demo_media/ so a
# freshly dropped clip is picked up with no code change.
DEMO_VIDEO = DEMO_MEDIA_DIR / "garbage_truck_demo.mp4"
YOLO_WEIGHTS = Path(__file__).resolve().parent / "yolov8n.pt"

# COCO class id for "truck"
TRUCK_CLASS_ID = 7

# Process ~1 frame per second from the 30 fps clip: plenty for a gate feed,
# keeps OCR cheap and event history readable.
FRAME_STEP = 30

# Plate lives in the lower band of the truck bbox (front/rear of chassis).
# The band is generous (bottom 45% of the bbox) because plate placement varies
# between front and rear views; a full-truck OCR pass is tried as fallback.
PLATE_BAND_FRAC = 0.45          # bottom fraction of bbox height to OCR first
PLATE_MIN_ALNUM = 5             # ignore OCR hits that are clearly not plates
PLATE_MIN_ALPHA = 2             # plates mix letters + digits; reject pure numbers
OCR_MIN_CONFIDENCE = 0.30
DEDUP_SECONDS = 20.0            # same plate re-emitted at most every N seconds
EVENT_HISTORY_SIZE = 50
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


def _discover_demo_video() -> Path:
    """Return the preferred demo clip, else the first video in demo_media/."""
    if DEMO_VIDEO.exists():
        return DEMO_VIDEO
    if DEMO_MEDIA_DIR.is_dir():
        for p in sorted(DEMO_MEDIA_DIR.iterdir()):
            if p.suffix.lower() in VIDEO_EXTENSIONS:
                return p
    return DEMO_VIDEO


@dataclass(frozen=True)
class SurveillanceEvent:
    cam_id: str
    plate: str
    raw_text: str
    confidence: float
    authorized: bool
    severity: str
    reason: str
    timestamp: str
    source: str = "simulated"


class SurveillanceEngine:
    """YOLO + EasyOCR pipeline with a background looping feed thread."""

    def __init__(self, video_path: Path = DEMO_VIDEO, weights: Path = YOLO_WEIGHTS) -> None:
        self.video_path = Path(video_path)
        self.weights = Path(weights)
        self._lock = threading.Lock()
        self._engine: dict[str, Any] | None = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._events: deque[SurveillanceEvent] = deque(maxlen=EVENT_HISTORY_SIZE)
        self._last_seen: dict[str, float] = {}
        self._error: str | None = None
        self._frame_count = 0
        self._truck_seen_count = 0
        self._plate_read_count = 0

    # ── engine lifecycle ────────────────────────────────────────────────

    def _ensure_engine(self) -> dict[str, Any]:
        """Load YOLO + EasyOCR once; safe to call from any thread."""
        if self._engine is None:
            with self._lock:
                if self._engine is None:
                    from ultralytics import YOLO  # lazy: heavy import
                    import easyocr

                    import torch
                    device = "cuda" if torch.cuda.is_available() else "cpu"

                    model = YOLO(str(self.weights))
                    if device == "cuda":
                        try:
                            model = model.to("cuda")
                        except Exception:
                            device = "cpu"
                    reader = easyocr.Reader(["en"], gpu=(device == "cuda"), verbose=False)
                    self._engine = {"model": model, "reader": reader, "device": device}
        return self._engine

    @property
    def device(self) -> str | None:
        return None if self._engine is None else self._engine["device"]

    # ── frame pipeline (unit-testable, no engine required) ─────────────

    def detect_trucks(self, frame: Any) -> list[dict[str, Any]]:
        """Return truck detections: [{"bbox": [x1,y1,x2,y2], "conf": float}]."""
        engine = self._ensure_engine()
        import numpy as np
        model = engine["model"]
        h, w = frame.shape[:2]
        results = model(frame, imgsz=1280, classes=[TRUCK_CLASS_ID], verbose=False)
        dets: list[dict[str, Any]] = []
        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                # scale back to original frame coordinates
                dets.append({
                    "bbox": [int(x1 * w / r.orig_shape[1]),
                             int(y1 * h / r.orig_shape[0]),
                             int(x2 * w / r.orig_shape[1]),
                             int(y2 * h / r.orig_shape[0])],
                    "conf": conf,
                })
        return dets

    def read_plate(self, frame: Any, bbox: list[int]) -> tuple[str, float] | None:
        """OCR a plate from the truck bbox: bottom band first, full truck fallback."""
        engine = self._ensure_engine()
        x1, y1, x2, y2 = bbox
        bh = y2 - y1
        if bh <= 0:
            return None

        regions: list[Any] = []
        band_top = y1 + int(bh * (1.0 - PLATE_BAND_FRAC))
        band = frame[max(0, band_top):min(frame.shape[0], y2 + 12),
                     max(0, x1 - 8):min(frame.shape[1], x2 + 8)]
        if band.size > 0:
            regions.append(band)
        truck = frame[max(0, y1):min(frame.shape[0], y2 + 12),
                      max(0, x1 - 8):min(frame.shape[1], x2 + 8)]
        if truck.size > 0 and truck.shape != band.shape:
            regions.append(truck)

        reader = engine["reader"]
        best_text, best_conf = "", 0.0
        for region in regions:
            rh = region.shape[0]
            scale = max(2.0, 320.0 / max(1, rh))
            region = cv_resize(region, scale)
            gray = cv_to_gray(region)
            hits = reader.readtext(gray, detail=1, paragraph=False)
            for (_box, text, conf) in hits:
                if not is_plate_like(str(text)):
                    continue
                if float(conf) > best_conf:
                    best_text, best_conf = str(text).upper(), float(conf)
        if not best_text or best_conf < OCR_MIN_CONFIDENCE:
            return None
        return best_text, best_conf

    def process_frame(self, frame: Any, cam_id: str = "gate-01") -> SurveillanceEvent | None:
        """Run the full pipeline on one frame; None when nothing plate-worthy."""
        dets = self.detect_trucks(frame)
        self._truck_seen_count += 1 if dets else 0
        if not dets:
            return None
        # Try the biggest truck first (closest to gate), then others.
        dets.sort(key=lambda d: (d["bbox"][2] - d["bbox"][0]) * (d["bbox"][3] - d["bbox"][1]), reverse=True)
        for d in dets[:2]:
            read = self.read_plate(frame, d["bbox"])
            if read is None:
                continue
            text, conf = read
            self._plate_read_count += 1
            verdict = check_vehicle(text)
            now = time.time()
            key = "".join(ch for ch in text if ch.isalnum())
            if now - self._last_seen.get(key, 0.0) < DEDUP_SECONDS:
                continue
            self._last_seen[key] = now
            event = SurveillanceEvent(
                cam_id=cam_id,
                plate=text,
                raw_text=text,
                confidence=round(conf, 3),
                authorized=verdict["authorized"],
                severity=verdict["severity"],
                reason=verdict["reason"],
                timestamp=datetime.now(timezone.utc).isoformat(),
            )
            self._events.append(event)
            return event
        return None

    # ── looping feed thread ────────────────────────────────────────────

    def start(self) -> str | None:
        """Start the background feed loop; returns error string or None."""
        if not self.video_path.exists():
            self.video_path = _discover_demo_video()
        if not self.video_path.exists():
            self._error = f"Demo video not found: {self.video_path}"
            return self._error
        with self._lock:
            if self._thread and self._thread.is_alive():
                return None
            self._running = True
            self._thread = threading.Thread(target=self._feed_loop, daemon=True,
                                            name="cv-surveillance-feed")
            self._thread.start()
        return None

    def _feed_loop(self) -> None:
        import cv2
        try:
            cap = cv2.VideoCapture(str(self.video_path))
            if not cap.isOpened():
                self._error = f"Cannot open video: {self.video_path}"
                self._running = False
                return
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
            while self._running:
                ok, frame = cap.read()
                if not ok:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop the clip
                    continue
                self._frame_count += 1
                if self._frame_count % FRAME_STEP == 0:
                    try:
                        self.process_frame(frame)
                    except Exception as exc:  # never kill the feed thread
                        print(f"CV feed frame error: {exc}")
                time.sleep(1.0 / max(1.0, fps / FRAME_STEP))
            cap.release()
        except Exception as exc:
            self._error = str(exc)
            self._running = False

    def stop(self) -> None:
        self._running = False

    # ── output ──────────────────────────────────────────────────────────

    def events(self, limit: int = 20) -> list[dict[str, Any]]:
        out = list(self._events)
        out.reverse()
        return [e.__dict__.copy() for e in out[:limit]]

    def status(self) -> dict[str, Any]:
        return {
            "status": "streaming" if self._running else ("error" if self._error else "idle"),
            "source": "simulated",
            "note": "Simulated gate feed from demo clip; swap to a DLH camera at pilot with no contract change.",
            "video": str(self.video_path),
            "device": self.device,
            "error": self._error,
            "frames_processed": self._frame_count,
            "trucks_detected": self._truck_seen_count,
            "plates_read": self._plate_read_count,
            "events": self.events(),
        }


# ── module-level singleton (mirrors gps_feed's simple call surface) ────

_engine: SurveillanceEngine | None = None
_start_lock = threading.Lock()


def get_surveillance() -> SurveillanceEngine:
    global _engine
    if _engine is None:
        with _start_lock:
            if _engine is None:
                _engine = SurveillanceEngine()
    return _engine


def surveillance_status() -> dict[str, Any]:
    sv = get_surveillance()
    sv.start()  # idempotent
    return sv.status()


# small cv helpers so read_plate stays testable without importing cv2 globally
def is_plate_like(text: str) -> bool:
    """Plate-shaped OCR hit: enough characters, mixes letters and digits."""
    alnum = "".join(ch for ch in str(text).upper() if ch.isalnum())
    alpha = sum(ch.isalpha() for ch in alnum)
    return len(alnum) >= PLATE_MIN_ALNUM and alpha >= PLATE_MIN_ALPHA and any(ch.isdigit() for ch in alnum)


def cv_resize(img: Any, scale: float) -> Any:
    import cv2
    import numpy as np
    return cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def cv_to_gray(img: Any) -> Any:
    import cv2
    if img.ndim == 2:
        return img
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
