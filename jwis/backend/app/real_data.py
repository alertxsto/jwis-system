# -*- coding: utf-8 -*-
"""
real_data.py — Loads real, government-sourced datasets for JWIS.

Sources (see data/real/manifest.json for full provenance):
- SIPSN (Sistem Informasi Kinerja Pengelolaan Sampah Nasional, KLHK):
  per-city daily waste generation ("timbulan") for DKI Jakarta, 2021-2025.
  https://sampahnasional.kemenlh.go.id
- data.go.id: TPST Bantargebang weighing records (monthly tonnage/ritasi).
- Official Jakarta event schedules (Jakarta Fair / JIExpo / GBK).

All loaders degrade gracefully to empty results if a file is missing, so the
API never crashes during a demo. Callers should treat an empty return as
"real data unavailable, use heuristic fallback".
"""
from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from typing import Any

REAL_DIR = Path(__file__).resolve().parents[2] / "data" / "real"

# Maps the SIPSN "nama_kabkota" label to the district name used across JWIS.
_CITY_LABEL_TO_DISTRICT = {
    "Kota Adm. Jakarta Pusat": "Jakarta Pusat",
    "Kota Adm. Jakarta Utara": "Jakarta Utara",
    "Kota Adm. Jakarta Barat": "Jakarta Barat",
    "Kota Adm. Jakarta Selatan": "Jakarta Selatan",
    "Kota Adm. Jakarta Timur": "Jakarta Timur",
    "Kab. Adm. Kep. Seribu": "Kepulauan Seribu",
}


def _to_float(value: str) -> float | None:
    try:
        return float(str(value).strip().replace(" ", "").replace(",", "."))
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def load_city_timbulan() -> dict[str, dict[str, Any]]:
    """
    Returns real daily waste generation per Jakarta city from SIPSN.

    Prefers the latest available year in the multi-year file; falls back to the
    2025-only file. Shape:
        {"Jakarta Barat": {"daily_tons": 2213.6, "year": 2025, "source": "SIPSN KLHK"}, ...}
    Returns {} if no real file is present.
    """
    candidates = [
        REAL_DIR / "sipsn_timbulan_2018_2025_dki.csv",
        REAL_DIR / "sipsn_timbulan_2025_dki.csv",
    ]
    rows: list[dict[str, str]] = []
    used_file: str | None = None
    for path in candidates:
        if path.exists():
            with path.open(encoding="utf-8-sig") as handle:
                rows = list(csv.DictReader(handle))
            used_file = path.name
            break
    if not rows:
        return {}

    latest_year = max(
        (int(r["tahun"]) for r in rows if str(r.get("tahun", "")).strip().isdigit()),
        default=None,
    )

    result: dict[str, dict[str, Any]] = {}
    for row in rows:
        year_raw = str(row.get("tahun", "")).strip()
        if latest_year is not None and (not year_raw.isdigit() or int(year_raw) != latest_year):
            continue
        district = _CITY_LABEL_TO_DISTRICT.get(str(row.get("nama_kabkota", "")).strip())
        daily = _to_float(row.get("jml_timbulan_harian", ""))
        if district and daily is not None:
            result[district] = {
                "daily_tons": round(daily, 1),
                "year": latest_year,
                "source": "SIPSN KLHK",
                "source_file": used_file,
            }
    return result


def baseline_tons_for(district: str, default: float) -> float:
    """Real per-city daily timbulan if available, else the provided default."""
    info = load_city_timbulan().get(district)
    if info:
        return info["daily_tons"]
    return default


@lru_cache(maxsize=1)
def load_official_events() -> list[dict[str, Any]]:
    """
    Returns real, officially-scraped Jakarta event entries.

    Note: `estimasi_pengunjung` is intentionally blank in the source because
    permit crowd estimates are not published. Callers must not fabricate a
    number; treat missing attendance as unknown.
    """
    path = REAL_DIR / "jakarta_events_2026_scraped_official_clean.csv"
    if not path.exists():
        return []
    events: list[dict[str, Any]] = []
    with path.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            events.append(
                {
                    "date_raw": (row.get("tanggal") or "").strip(),
                    "name": (row.get("nama_event") or "").strip(),
                    "location": (row.get("lokasi") or "").strip(),
                    "time": (row.get("waktu") or "").strip(),
                    "expected_attendance": _to_float(row.get("estimasi_pengunjung", "")),
                    "source": (row.get("sumber") or "").strip(),
                    "source_url": (row.get("source_url") or "").strip(),
                }
            )
    return events


def load_fleet_composition() -> dict[str, Any]:
    """Real DKI waste-truck fleet census from data_truk_sampah_dki.csv.

    Returns totals, per-wilayah counts, and per-vehicle-type counts. Grounds the
    Fleet Monitoring (Case 1) dashboard in the real 2023 DKI truck census instead
    of invented numbers. Returns {} if the file is absent.
    """
    path = REAL_DIR / "data_truk_sampah_dki.csv"
    if not path.exists():
        return {}
    total = 0
    by_wilayah: dict[str, int] = {}
    by_type: dict[str, int] = {}
    with path.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            n = _to_float(row.get("jumlah_kendaraan", "")) or 0
            n = int(n)
            total += n
            wil = (row.get("wilayah") or "").strip().title()
            vt = (row.get("jenis_kendaraan") or "").strip().title()
            if wil:
                by_wilayah[wil] = by_wilayah.get(wil, 0) + n
            if vt:
                by_type[vt] = by_type.get(vt, 0) + n
    return {
        "total_units": total,
        "by_wilayah": dict(sorted(by_wilayah.items(), key=lambda kv: -kv[1])),
        "by_vehicle_type": dict(sorted(by_type.items(), key=lambda kv: -kv[1])),
        "source": "DKI truck census 2023 (data.go.id)",
    }


def load_kecamatan_map() -> list[dict[str, Any]]:
    """Real 42-kecamatan spatial baseline (SILIKA DLH 2023) + TPS capacity proxy.

    Returns one entry per kecamatan with real waste generation, coordinates, and
    a TPS facility-readiness signal (capacity proxy vs demand). Powers the Case 2
    temporal-spatial map and facility-readiness recommendation. Returns [] if the
    file is missing.
    """
    base_path = REAL_DIR / "timbulan_kecamatan_2023.csv"
    if not base_path.exists():
        return []
    cap: dict[str, dict[str, Any]] = {}
    cap_path = REAL_DIR / "tps_capacity_vs_timbulan_kecamatan.csv"
    if cap_path.exists():
        with cap_path.open(encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                key = (row.get("kecamatan") or "").strip().upper()
                cap[key] = {
                    "tps_capacity_ton_per_day": _to_float(row.get("tps_capacity_proxy_ton_per_day", "")),
                    "gap_ton_per_day": _to_float(row.get("proxy_gap_ton_per_day", "")),
                    "coverage_ratio": _to_float(row.get("coverage_ratio_proxy", "")),
                }
    out: list[dict[str, Any]] = []
    with base_path.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            kec = (row.get("kecamatan") or "").strip()
            city = (row.get("kota_wilayah") or "").replace("KOTA ADM. ", "").replace("KAB. ADM. ", "").strip().title()
            c = cap.get(kec.upper(), {})
            coverage = c.get("coverage_ratio")
            if coverage is None:
                readiness = "unknown"
            elif coverage >= 1.0:
                readiness = "sufficient"
            elif coverage >= 0.6:
                readiness = "tight"
            else:
                readiness = "under_capacity"
            raw_lat = _to_float(row.get("lat", ""))
            raw_lng = _to_float(row.get("lng", ""))
            # SILIKA CSV has lat/lng column labels swapped; Jakarta latitude is
            # ~-6.x and longitude ~106.x. Assign by value range, not by label.
            if raw_lat is not None and raw_lng is not None and abs(raw_lat) > abs(raw_lng):
                raw_lat, raw_lng = raw_lng, raw_lat
            out.append({
                "kecamatan": kec,
                "slug": kec.lower().replace(" ", "_"),
                "city": city,
                "baseline_tons_per_day": _to_float(row.get("timbulan_ton_per_hari", "")),
                "lat": raw_lat,
                "lng": raw_lng,
                "tps_capacity_ton_per_day": c.get("tps_capacity_ton_per_day"),
                "facility_gap_ton_per_day": c.get("gap_ton_per_day"),
                "facility_coverage_ratio": coverage,
                "facility_readiness": readiness,
                "source": "SILIKA DLH 2023 (timbulan) + TPS capacity proxy",
            })
    return out


def data_provenance() -> dict[str, Any]:
    """Summary of which real datasets are loaded, for transparency in the UI/API."""
    timbulan = load_city_timbulan()
    events = load_official_events()
    fleet = load_fleet_composition()
    return {
        "timbulan_cities_loaded": len(timbulan),
        "timbulan_year": next(iter(timbulan.values()), {}).get("year") if timbulan else None,
        "timbulan_source": "SIPSN KLHK (sampahnasional.kemenlh.go.id)",
        "official_events_loaded": len(events),
        "fleet_units_real": fleet.get("total_units"),
        "using_real_baselines": bool(timbulan),
    }
