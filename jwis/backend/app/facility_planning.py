# -*- coding: utf-8 -*-
"""
facility_planning.py — Case 2 facility-readiness engine.

Answers the case-statement requirement "estimated need and LOCATION of waste
disposal and transportation facilities in each busy area": for every kecamatan
it compares the live model-predicted demand against the TPS capacity proxy and
recommends (a) how many TPS sites / transfer trucks are missing, and (b) WHERE
to site them — the highest-demand kelurahan with the thinnest TPS coverage,
using the same population+TPS weighted allocation as the heatmap.

Capacity values are a PROXY (see data provenance registry), so every output
carries the proxy label and never presents derived numbers as official DLH
operational capacity.
"""
from __future__ import annotations

from math import ceil
from typing import Any

from app.real_data import (
    _norm_admin_name,
    kelurahan_allocation_weights,
    load_kecamatan_map,
    load_kelurahan_heatmap,
    load_kelurahan_tps_counts,
)

_AVG_TPS_SITE_CAPACITY_TONS = 3.0  # data-driven: 2,956 t/day proxy over 1,081 real TPS sites ≈ 2.73
_TRUCK_CAPACITY_TONS = 18.0
# The capacity proxy covers only ~38% of modeled citywide demand (the rest is
# direct-hauled to TPST). Recommendations therefore split the gap into levers:
# trip intensification on existing sites first, new sites for a bounded share.
_NEW_SITE_GAP_SHARE = 0.30


def build_facility_gap_analysis(
    kec_predictions: dict[str, float] | None = None,
    top_kelurahan: int = 2,
) -> dict[str, Any]:
    """Compare predicted demand vs TPS capacity proxy for every kecamatan.

    kec_predictions: {kecamatan_name: predicted_tons_per_day}. When None, the
    real SILIKA 2023 baseline is used. Returns per-area gap rows sorted by
    severity, each with concrete siting recommendations.
    """
    kecs = load_kecamatan_map()
    if not kecs:
        return {"areas": [], "summary": {}, "classification": "proxy", "method": "unavailable"}

    heatmap = load_kelurahan_heatmap(kec_predictions)
    kel_tons: dict[str, list[tuple[str, float]]] = {}
    for feat in heatmap.get("features", []):
        props = feat.get("properties", {})
        tons = props.get("predicted_tons")
        if tons is None:
            continue
        kec_norm = _norm_admin_name(props.get("kecamatan"))
        kel_tons.setdefault(kec_norm, []).append((props.get("kelurahan", ""), float(tons)))

    tps_counts = load_kelurahan_tps_counts()
    areas: list[dict[str, Any]] = []
    for k in kecs:
        predicted = (kec_predictions or {}).get(k["kecamatan"])
        if predicted is None:
            predicted = k.get("baseline_tons_per_day")
        if predicted is None:
            continue
        capacity = k.get("tps_capacity_ton_per_day")
        kec_norm = _norm_admin_name(k["kecamatan"])
        gap = round(predicted - capacity, 1) if capacity is not None else None
        coverage = k.get("facility_coverage_ratio")

        # Lever 1 (transport): extra truck-trips intensify throughput at the
        # existing TPS network — the primary, cheapest response.
        extra_trips = max(0, ceil(gap / _TRUCK_CAPACITY_TONS)) if gap and gap > 0 else 0
        # Lever 2 (disposal): new TPS sites absorb only a bounded share of the
        # gap; the remainder is assumed direct-hauled (as today).
        sites_needed = max(0, ceil(gap * _NEW_SITE_GAP_SHARE / _AVG_TPS_SITE_CAPACITY_TONS)) if gap and gap > 0 else 0
        extra_trucks = extra_trips

        kec_kel_tps = tps_counts.get(kec_norm, {})
        candidates = []
        ranked = sorted(kel_tons.get(kec_norm, []), key=lambda kv: -kv[1])
        for kel_name, tons in ranked:
            tps_here = kec_kel_tps.get(_norm_admin_name(kel_name), 0)
            candidates.append({
                "kelurahan": kel_name,
                "predicted_tons": round(tons, 1),
                "existing_tps_sites": tps_here,
                "reason": (
                    f"highest predicted demand in {k['kecamatan']} "
                    f"({tons:.1f} t/day) with {tps_here} existing TPS site(s)"
                ),
            })
            if len(candidates) >= top_kelurahan:
                break

        severity = "ok"
        if gap is None:
            severity = "unknown"
        elif gap > 0 and (coverage or 0) < 0.35:
            severity = "critical"
        elif gap > 0:
            severity = "watch"

        areas.append({
            "kecamatan": k["kecamatan"],
            "city": k["city"],
            "slug": k["slug"],
            "predicted_tons_per_day": round(predicted, 1),
            "tps_capacity_proxy_ton_per_day": capacity,
            "gap_ton_per_day": gap,
            "coverage_ratio_proxy": coverage,
            "severity": severity,
            "recommended_extra_trips_per_day": extra_trips,
            "recommended_new_tps_sites": sites_needed,
            "recommended_extra_trucks": extra_trucks,
            "siting_candidates": candidates,
        })

    order = {"critical": 0, "watch": 1, "ok": 2, "unknown": 3}
    areas.sort(key=lambda a: (order.get(a["severity"], 4), -(a["gap_ton_per_day"] or 0)))
    critical = [a for a in areas if a["severity"] == "critical"]
    watch = [a for a in areas if a["severity"] == "watch"]
    total_capacity = sum(a["tps_capacity_proxy_ton_per_day"] for a in areas if a["tps_capacity_proxy_ton_per_day"])
    total_demand = sum(a["predicted_tons_per_day"] for a in areas)
    return {
        "areas": areas,
        "summary": {
            "kecamatan_total": len(areas),
            "critical_count": len(critical),
            "watch_count": len(watch),
            "total_gap_ton_per_day": round(sum(a["gap_ton_per_day"] for a in areas if (a["gap_ton_per_day"] or 0) > 0), 1),
            "total_new_tps_sites_needed": sum(a["recommended_new_tps_sites"] for a in areas),
            "total_extra_trucks_needed": sum(a["recommended_extra_trucks"] for a in areas),
            "citywide_proxy_coverage_ratio": round(total_capacity / total_demand, 3) if total_demand else None,
        },
        "assumptions": {
            "avg_tps_site_capacity_tons": _AVG_TPS_SITE_CAPACITY_TONS,
            "truck_capacity_tons": _TRUCK_CAPACITY_TONS,
            "new_site_gap_share": _NEW_SITE_GAP_SHARE,
            "allocation": "0.8*population_share + 0.2*tps_density_share (real census + SILIKA TPS)",
            "coverage_note": (
                "TPS capacity proxy covers only part of modeled demand; the remainder is "
                "direct-hauled to TPST. Recommendations are RELATIVE priorities for pilot "
                "scoping, to be recalibrated with official TPS operational capacity."
            ),
        },
        "classification": "proxy",
        "method": "predicted demand vs TPS capacity proxy; siting by weighted kelurahan demand",
    }
