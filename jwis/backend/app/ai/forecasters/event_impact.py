"""Feature D: automatic 7-day event/weather impact forecast (hourly refresh)."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Callable

from app.ai.actions.auto_state import AiEvent, EventFeed
from app.engine import _holiday_dates
from app.real_data import load_official_events
from app.weather import fetch_jakarta_weather_forecast

logger = logging.getLogger(__name__)

MATERIAL_DELTA_PCT = 10.0


def _parse_event_date(date_raw: str | None) -> str | None:
    if not date_raw:
        return None
    try:
        return datetime.strptime(str(date_raw)[:10], "%Y-%m-%d").date().isoformat()
    except ValueError:
        return None


class EventImpactForecaster:
    def __init__(self, feed: EventFeed,
                 weather_fn: Callable = fetch_jakarta_weather_forecast,
                 events_fn: Callable = load_official_events,
                 holidays_fn: Callable = _holiday_dates) -> None:
        self._feed = feed
        self._weather_fn = weather_fn
        self._events_fn = events_fn
        self._holidays_fn = holidays_fn
        self._latest: list[dict] = []
        self._prev_deltas: dict[str, float] = {}
        self._lock = threading.Lock()

    def refresh(self) -> list[dict]:
        try:
            weather = self._weather_fn()
        except Exception:  # noqa: BLE001 — degradation by design
            logger.exception("weather fetch failed; serving stale outlook")
            with self._lock:
                return [dict(d, stale=True) for d in self._latest]

        events_by_date: dict[str, list[dict]] = {}
        for event in self._events_fn():
            iso = _parse_event_date(event.get("date_raw"))
            if iso:
                events_by_date.setdefault(iso, []).append({
                    "name": event.get("name"),
                    "expected_attendance": event.get("expected_attendance") or 0,
                })

        holidays = self._holidays_fn()
        outlook: list[dict] = []
        for day in weather.get("forecast", [])[:7]:
            date = day["date"]
            day_events = events_by_date.get(date, [])
            attendance = sum(e["expected_attendance"] for e in day_events)
            is_holiday = date in holidays
            delta = float(day.get("waste_impact_percent") or 0.0)
            delta += min(30.0, attendance / 5000.0)
            if is_holiday:
                delta += 5.0
            outlook.append({
                "date": date,
                "rainfall_mm": day.get("rainfall_mm"),
                "precipitation_probability": day.get("precipitation_probability"),
                "risk_level": day.get("risk_level"),
                "events": day_events,
                "is_holiday": is_holiday,
                "volume_delta_pct": round(delta, 1),
                "operational_advice": day.get("operational_advice"),
                "source": weather.get("source", "unknown"),
                "stale": False,
            })

        for day in outlook:
            prev = self._prev_deltas.get(day["date"])
            if prev is not None and abs(day["volume_delta_pct"] - prev) > MATERIAL_DELTA_PCT:
                self._feed.append(AiEvent(
                    event_type="forecast_update",
                    truck_code=None,
                    title=f"Prediksi volume {day['date']} berubah signifikan",
                    detail={"date": day["date"], "old_delta_pct": prev,
                            "new_delta_pct": day["volume_delta_pct"]},
                    confidence=0.7,
                    created_at=datetime.now(timezone.utc).isoformat(),
                ))
        self._prev_deltas = {d["date"]: d["volume_delta_pct"] for d in outlook}
        with self._lock:
            self._latest = outlook
        return outlook

    def latest(self) -> list[dict]:
        with self._lock:
            return [dict(d) for d in self._latest]
