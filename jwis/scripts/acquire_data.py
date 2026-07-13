from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
SOURCES = ROOT / "data" / "sources"
REAL = ROOT / "data" / "real"


def fetch_json(url: str, timeout: float = 30) -> dict | list:
    request = Request(url, headers={"User-Agent": "JWIS-Competition-Prototype/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def verify_real_datasets() -> dict:
    """
    Report on the real, government-sourced datasets bundled under data/real.

    These are pulled from SIPSN KLHK (sampahnasional.kemenlh.go.id),
    data.go.id (TPST Bantargebang weighing records), and official Jakarta
    event schedules. Unlike the synthetic seed below, these are authoritative
    and are used as the primary baselines by the backend (see real_data.py).
    """
    expected = {
        "sipsn_timbulan_2018_2025_dki.csv": "SIPSN KLHK per-city daily timbulan (2021-2025)",
        "sipsn_timbulan_2025_dki.csv": "SIPSN KLHK per-city daily timbulan (2025)",
        "bantargebang_hasil_penimbangan.csv": "data.go.id TPST Bantargebang weighing (to 2026-04)",
        "jakarta_events_2026_scraped_official_clean.csv": "Official Jakarta Fair/JIExpo/GBK events",
        "kelurahan_dki_full_267.geojson": "267 DKI kelurahan polygons",
    }
    present = {name: (REAL / name).exists() for name in expected}
    return {
        "name": "real_datasets",
        "url": "https://sampahnasional.kemenlh.go.id | https://data.go.id",
        "status": "verified" if all(present.values()) else "partial",
        "files_present": present,
        "descriptions": expected,
    }


def acquire_open_meteo_history() -> dict:
    end_date = date.today() - timedelta(days=2)
    start_date = end_date - timedelta(days=730)
    params = {
        "latitude": -6.2088,
        "longitude": 106.8456,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
        "timezone": "Asia/Jakarta",
    }
    url = "https://archive-api.open-meteo.com/v1/archive?" + urlencode(params)
    payload = fetch_json(url, timeout=45)
    write_json(RAW / "open_meteo_jakarta_history_2y.json", payload)
    return {"name": "open_meteo_history", "url": url, "status": "downloaded"}


def acquire_holidays() -> dict:
    url = "https://api-hari-libur.vercel.app/api?year=2026"
    payload = fetch_json(url)
    write_json(RAW / "indonesia_holidays_2026.json", payload)
    return {"name": "indonesia_holidays_2026", "url": url, "status": "downloaded"}


def acquire_gadm_jakarta() -> dict:
    url = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_2.json"
    payload = fetch_json(url, timeout=60)
    features = payload.get("features", [])
    jakarta_features = [
        feature
        for feature in features
        if "jakarta" in json.dumps(feature.get("properties", {}), ensure_ascii=False).lower()
    ]
    jakarta_payload = {"type": "FeatureCollection", "features": jakarta_features}
    write_json(RAW / "gadm_jakarta_admin2.geojson", jakarta_payload)
    return {
        "name": "gadm_jakarta_admin2",
        "url": url,
        "status": "downloaded",
        "features": len(jakarta_features),
    }


def generate_kelurahan_heatmap_fallback() -> dict:
    centers = [
        ("Gambir", "Jakarta Pusat", -6.1767, 106.8306, 990, 25),
        ("Tanah Abang", "Jakarta Pusat", -6.2059, 106.8106, 1040, 18),
        ("Penjaringan", "Jakarta Utara", -6.1264, 106.7799, 1190, 24),
        ("Tanjung Priok", "Jakarta Utara", -6.1299, 106.8719, 1215, 17),
        ("Cengkareng", "Jakarta Barat", -6.1447, 106.7346, 1280, 31),
        ("Kebon Jeruk", "Jakarta Barat", -6.1918, 106.7698, 1240, 41),
        ("Pulogadung", "Jakarta Timur", -6.1916, 106.9056, 1510, 15),
        ("Cakung", "Jakarta Timur", -6.1858, 106.9518, 1580, 13),
        ("Tebet", "Jakarta Selatan", -6.2322, 106.8473, 1365, 19),
        ("Kebayoran Baru", "Jakarta Selatan", -6.2440, 106.7992, 1400, 22),
    ]
    features = []
    for idx, (name, city, lat, lng, baseline, spike) in enumerate(centers, 1):
        size = 0.018
        coordinates = [
            [
                [lng - size, lat - size],
                [lng + size, lat - size],
                [lng + size, lat + size],
                [lng - size, lat + size],
                [lng - size, lat - size],
            ]
        ]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"KL-{idx:03d}",
                    "name": name,
                    "city": city,
                    "baseline_tons": baseline,
                    "spike_percent": spike,
                    "predicted_tons": round(baseline * (1 + spike / 100), 1),
                },
                "geometry": {"type": "Polygon", "coordinates": coordinates},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def acquire_kelurahan_heatmap() -> dict:
    candidates = [
        "https://raw.githubusercontent.com/navigo-id/indonesia-geojson/main/jakarta/kelurahan.geojson",
        "https://raw.githubusercontent.com/navigo-id/indonesia-geojson/main/dki-jakarta/kelurahan.geojson",
        "https://raw.githubusercontent.com/navigo-id/indonesia-geojson/main/geojson/dki-jakarta/kelurahan.geojson",
        "https://raw.githubusercontent.com/navigo-id/indonesia-geojson/master/jakarta/kelurahan.geojson",
    ]
    for url in candidates:
        try:
            payload = fetch_json(url, timeout=30)
            features = payload.get("features", []) if isinstance(payload, dict) else []
            if features:
                write_json(RAW / "jakarta_kelurahan_heatmap.geojson", payload)
                return {"name": "jakarta_kelurahan_heatmap", "url": url, "status": "downloaded", "features": len(features)}
        except (HTTPError, URLError, TimeoutError, OSError, ValueError):
            continue

    fallback = generate_kelurahan_heatmap_fallback()
    write_json(RAW / "jakarta_kelurahan_heatmap.geojson", fallback)
    return {
        "name": "jakarta_kelurahan_heatmap",
        "url": "https://github.com/navigo-id/indonesia-geojson",
        "status": "fallback-generated",
        "features": len(fallback["features"]),
    }


def acquire_waste_dataset_metadata() -> dict:
    dataset_id = "9ca7c1f3-c982-44cb-8fdc-f2ef3e27c1a5"
    url = f"https://data.go.id/api/3/action/package_show?id={dataset_id}"
    try:
        payload = fetch_json(url)
        status = "downloaded"
    except Exception:
        payload = {
            "dataset_id": dataset_id,
            "source_page": "https://data.go.id/dataset/dataset/data-timbulan-dan-berat-jenis-sampah-di-setiap-sumber-sampah",
            "title": "Data Timbulan dan Berat Jenis Sampah di Setiap Sumber Sampah",
            "note": "API package_show unavailable; source page metadata captured for proposal evidence.",
        }
        status = "metadata-fallback"
    write_json(RAW / "jakarta_waste_dataset_metadata.json", payload)
    return {"name": "jakarta_waste_dataset_metadata", "url": url, "status": status}


def acquire_waste_csv_fallback() -> dict:
    """
    Synthetic seed retained ONLY as a last-resort fallback. Real per-city
    baselines now come from data/real (SIPSN KLHK); see verify_real_datasets
    and backend/app/real_data.py. This file is explicitly labeled synthetic.
    """
    rows = [
        ["date", "kelurahan", "city", "baseline_tons", "predicted_tons", "source"],
        ["2026-06-01", "Kebon Jeruk", "Jakarta Barat", 1240, 1748.4, "synthetic_fallback_only"],
        ["2026-06-01", "Cengkareng", "Jakarta Barat", 1280, 1676.8, "synthetic_fallback_only"],
        ["2026-06-01", "Gambir", "Jakarta Pusat", 990, 1237.5, "synthetic_fallback_only"],
        ["2026-06-01", "Pulogadung", "Jakarta Timur", 1510, 1736.5, "synthetic_fallback_only"],
        ["2026-06-01", "Tebet", "Jakarta Selatan", 1365, 1624.4, "synthetic_fallback_only"],
    ]
    path = RAW / "jakarta_waste_forecast_seed.csv"
    path.write_text("\n".join(",".join(map(str, row)) for row in rows), encoding="utf-8")
    return {
        "name": "jakarta_waste_forecast_seed_csv",
        "url": "https://satudata.jakarta.go.id/open-data",
        "status": "fallback-generated",
        "rows": len(rows) - 1,
    }


def acquire_dummy_events() -> dict:
    rows = [
        ["event_date", "event_name", "district", "expected_attendance", "waste_impact_percent", "source"],
        ["2026-06-01", "CFD and public holiday spillover", "Jakarta Pusat", 55000, 18, "dummy_case_calendar"],
        ["2026-06-02", "Concert at GBK", "Jakarta Pusat", 85000, 22, "dummy_case_calendar"],
        ["2026-06-03", "Lebaran return traffic", "Jakarta Barat", 120000, 28, "dummy_case_calendar"],
        ["2026-06-04", "Jakarta Fair crowd", "Jakarta Utara", 70000, 20, "dummy_case_calendar"],
        ["2026-06-05", "Local market festival", "Jakarta Timur", 18000, 9, "dummy_case_calendar"],
    ]
    path = RAW / "dummy_event_calendar_2026.csv"
    path.write_text("\n".join(",".join(map(str, row)) for row in rows), encoding="utf-8")
    return {"name": "dummy_event_calendar_2026", "status": "generated", "rows": len(rows) - 1}


def main() -> int:
    SOURCES.mkdir(parents=True, exist_ok=True)
    tasks = [
        verify_real_datasets,
        acquire_open_meteo_history,
        acquire_holidays,
        acquire_gadm_jakarta,
        acquire_kelurahan_heatmap,
        acquire_waste_dataset_metadata,
        acquire_waste_csv_fallback,
        acquire_dummy_events,
    ]
    results = []
    for task in tasks:
        try:
            result = task()
        except (URLError, TimeoutError, OSError, ValueError) as error:
            result = {"name": task.__name__, "status": "failed", "error": str(error)}
        results.append(result)
        print(f"{result['name']}: {result['status']}")

    write_json(SOURCES / "acquisition_manifest.json", {"generated_at": date.today().isoformat(), "results": results})
    return 0 if any(item["status"] == "downloaded" for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
