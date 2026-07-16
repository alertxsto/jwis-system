from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen


JAKARTA_LAT = -6.2088
JAKARTA_LNG = 106.8456
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def build_weather_risk(
    rainfall_mm: float,
    precipitation_probability: float,
    wind_speed_kmh: float,
) -> dict[str, Any]:
    impact = 0
    drivers: list[str] = []

    if rainfall_mm >= 30:
        impact += 16
        drivers.append("Heavy rain can increase wet waste and slow collection.")
    elif rainfall_mm >= 10:
        impact += 8
        drivers.append("Rain can slow collection and raise wet waste weight.")

    if precipitation_probability >= 80:
        impact += 6
        drivers.append("High rain probability increases operational uncertainty.")
    elif precipitation_probability >= 50:
        impact += 3
        drivers.append("Moderate rain probability requires standby capacity.")

    if wind_speed_kmh >= 30:
        impact += 4
        drivers.append("Strong wind can disrupt transfer points and temporary bins.")

    if impact >= 20:
        level = "critical"
        advice = "Delay low-priority departures, protect flood-prone TPS routes, and prepare backup crews."
    elif impact >= 12:
        level = "high"
        advice = "Stage backup trucks near high-risk districts and monitor TPA queue timing."
    elif impact >= 6:
        level = "watch"
        advice = "Monitor rain bands and keep dispatch timing flexible."
    else:
        level = "normal"
        advice = "Normal dispatch plan can continue."

    return {
        "risk_level": level,
        "waste_impact_percent": impact,
        "drivers": drivers or ["No material weather disruption expected."],
        "operational_advice": advice,
    }


def parse_open_meteo_daily(payload: dict[str, Any]) -> list[dict[str, Any]]:
    daily = payload.get("daily", {})
    times = daily.get("time", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    rain = daily.get("precipitation_sum", [])
    rain_probability = daily.get("precipitation_probability_max", [])
    wind = daily.get("wind_speed_10m_max", [])

    forecast = []
    for index, day in enumerate(times):
        rainfall_mm = float(rain[index] if index < len(rain) else 0)
        probability = float(rain_probability[index] if index < len(rain_probability) else 0)
        wind_speed = float(wind[index] if index < len(wind) else 0)
        risk = build_weather_risk(rainfall_mm, probability, wind_speed)
        forecast.append(
            {
                "date": day,
                "temperature_max_c": float(max_temps[index] if index < len(max_temps) else 0),
                "temperature_min_c": float(min_temps[index] if index < len(min_temps) else 0),
                "rainfall_mm": rainfall_mm,
                "precipitation_probability": probability,
                "wind_speed_kmh": wind_speed,
                **risk,
            }
        )
    return forecast


def fallback_weather_forecast() -> list[dict[str, Any]]:
    today = date.today()
    scenarios = [
        (42.0, 91, 17.1),
        (18.5, 68, 14.2),
        (7.2, 42, 12.0),
        (11.1, 53, 13.4),
        (3.4, 24, 9.8),
        (0.0, 18, 8.5),
        (9.7, 49, 11.2),
    ]
    forecast = []
    for offset, (rainfall, probability, wind) in enumerate(scenarios, 1):
        risk = build_weather_risk(rainfall, probability, wind)
        forecast.append(
            {
                "date": (today + timedelta(days=offset)).isoformat(),
                "temperature_max_c": 31.5 - min(offset, 3) * 0.3,
                "temperature_min_c": 24.8,
                "rainfall_mm": rainfall,
                "precipitation_probability": probability,
                "wind_speed_kmh": wind,
                **risk,
            }
        )
    return forecast


_WEATHER_CACHE: dict[str, Any] | None = None
_WEATHER_CACHE_TIME: float = 0.0


def fetch_jakarta_weather_forecast(timeout_seconds: float = 5.0) -> dict[str, Any]:
    global _WEATHER_CACHE, _WEATHER_CACHE_TIME
    import time
    now = time.time()
    if _WEATHER_CACHE is not None and (now - _WEATHER_CACHE_TIME) < 300:
        return _WEATHER_CACHE

    params = {
        "latitude": JAKARTA_LAT,
        "longitude": JAKARTA_LNG,
        "daily": ",".join(
            [
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_sum",
                "precipitation_probability_max",
                "wind_speed_10m_max",
            ]
        ),
        "timezone": "Asia/Jakarta",
        "forecast_days": 7,
    }
    url = f"{OPEN_METEO_URL}?{urlencode(params)}"
    try:
        with urlopen(url, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        res = {
            "source": "open-meteo",
            "location": "Jakarta, Indonesia",
            "latitude": JAKARTA_LAT,
            "longitude": JAKARTA_LNG,
            "forecast": parse_open_meteo_daily(payload),
        }
        _WEATHER_CACHE = res
        _WEATHER_CACHE_TIME = now
        return res
    except Exception:
        res = {
            "source": "fallback-demo",
            "location": "Jakarta, Indonesia",
            "latitude": JAKARTA_LAT,
            "longitude": JAKARTA_LNG,
            "forecast": fallback_weather_forecast(),
        }
        # Cache fallback too so we don't spam if offline/rate-limited
        _WEATHER_CACHE = res
        _WEATHER_CACHE_TIME = now
        return res
