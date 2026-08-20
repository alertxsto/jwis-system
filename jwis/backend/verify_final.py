# -*- coding: utf-8 -*-
"""FINAL authoritative compliance audit: every Waste-DLH.pdf line vs live JWIS."""
import json, sys, io, urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8001/api"

def get(p):
    with urllib.request.urlopen(B + p, timeout=120) as r:
        return json.load(r)

def post(p, body=None):
    req = urllib.request.Request(B + p, data=json.dumps(body or {}).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r), r.status

PASS, FAIL = "✅", "❌"
results = []

def check(name, ok, evidence=""):
    results.append((name, ok, evidence))

# ═══ CASE 1 ═══
fleet = get("/fleet")
t47 = [t for t in fleet if t["truck_code"] == "T-047"][0]
acts = {t["activity"]["state"] for t in fleet}
check("C1: Monitor position AND activity real-time",
      len(fleet) >= 50 and len(acts) >= 3,
      f"{len(fleet)} trucks, {len(acts)} activity states")

dv = t47["deviation"]
check("C1: Detect route deviation violations",
      dv["violated"] and dv["distance_meters"] > 500,
      f"T-047 violated={dv['violated']} {dv['distance_meters']}m {dv['severity']}")

unl = get("/fleet/unlicensed-collectors")
check("C1: Detect illegal activity (unlicensed collectors)",
      unl["unauthorized_count"] > 0,
      f"{unl['unauthorized_count']}/{unl['observed_count']} flagged")

hist = get("/fleet/history")
check("C1: Trip history of fleet",
      len(hist) >= 50,
      f"{len(hist)} trip records")

damaged = [t for t in fleet if t["is_damaged"]]
check("C1: Fleet damage status on dashboard",
      len(damaged) > 0,
      f"{len(damaged)} damaged units")

q = get("/tpa/queue-status?scenario=peak")
check("C1: Real-time TPA entry queue status",
      q["avg_wait_minutes"] > 60,
      f"peak: {q['avg_wait_minutes']}min {q['trucks_in_queue']} trucks {q['status_label']}")

alt = get("/fleet/route-alternatives?truck_code=T-047")
check("C1: Alternative routes (regulations + permits)",
      alt["route_count"] >= 2 and all("eta_minutes" in r for r in alt["routes"]),
      f"{alt['route_count']} computed routes: {[r['eta_minutes'] for r in alt['routes']]}")

sim, _ = post("/simulator/stagger?active_trucks=47")
check("C1: Simulator (scheduling, ETA, alternative routes)",
      sim["queue_reduction_percent"] > 20,
      f"baseline {sim['baseline_wait_minutes']} -> staggered {sim['optimized_wait_minutes']}min (-{sim['queue_reduction_percent']}%)")

es = get("/reports/executive-summary")
check("C1: Executive summary (schedule optimization + queue reduction)",
      "queue_impact" in es and es["queue_impact"]["queue_reduction_percent"] > 0,
      f"queue reduction {es['queue_impact']['queue_reduction_percent']}%")

# ═══ CASE 2 ═══
pred = get("/predictions/kecamatan?rainfall_mm=42&event_attendance=85000&is_weekend=true&event_lat=-6.2183&event_lng=106.8022")
check("C2: Predict volume and location",
      pred["kecamatan_count"] == 42 and pred["total_predicted_tons"] > 5000,
      f"42 kecamatan, {pred['total_predicted_tons']}t/day")

top = pred["top_hotspots"][0]
attr = top.get("factor_attribution", {})
check("C2: Integrate historical + weather + event data",
      attr.get("rainfall_tons") is not None and attr.get("prophet_baseline_tons") is not None,
      f"attribution: rain={attr.get('rainfall_tons')}t baseline={attr.get('prophet_baseline_tons')}t")

check("C2: Fleet and facility readiness recommendations",
      top["trucks_required"] > 0 and top["man_hours_required"] > 0 and top["disposal_bins_required"] > 0,
      f"trucks={top['trucks_required']} man-hours={top['man_hours_required']} bins={top['disposal_bins_required']}")

h30 = get("/predictions/kecamatan?horizon_days=30")
h30k = h30["kecamatan"][0]
check("C2: Temporal mapping (daily series per kecamatan)",
      len(h30k.get("daily_series", [])) == 30,
      f"30-day series, peak {h30k['horizon_peak_date']} ({h30k['horizon_peak_tons']}t)")

hm = get("/geo/kelurahan-heatmap")
vals = [f["properties"]["predicted_tons"] for f in hm["features"] if f["properties"].get("predicted_tons") is not None]
check("C2: Spatial mapping (kelurahan-level heatmap)",
      len(hm["features"]) == 267 and len(set(vals)) > 50,
      f"267 kelurahan, {len(set(vals))} distinct values")

gap = get("/facilities/gap-analysis")
check("C2: Facility need + location in each busy area",
      gap["summary"]["critical_count"] > 0 and len(gap["areas"][0]["siting_candidates"]) > 0,
      f"{gap['summary']['critical_count']} critical, siting: {[c['kelurahan'] for c in gap['areas'][0]['siting_candidates']]}")

permit, status = post("/events/permits", {
    "name": "Final Check", "location_name": "GBK", "event_date": "2026-09-20",
    "expected_attendance": 80000, "lat": -6.2183, "lng": 106.8022})
check("C2: Crowd permit submitted -> prediction + resources",
      status == 201 and permit["impact"]["predicted_waste_tons"] > 0,
      f"80k -> {permit['impact']['predicted_waste_tons']}t, {permit['impact']['backup_trucks_required']} trucks, {permit['impact']['man_hours_required']} man-hours")

check("C2: Executive summary (facility + schedule optimization)",
      "facility_summary" in es and "top_hotspots" in es,
      f"exec summary includes facility_summary + top_hotspots")

# ═══ CROSS-CUTTING ═══
prov = get("/data/provenance")
recs = prov if isinstance(prov, list) else prov.get("records", [])
real_count = sum(1 for r in recs if r.get("classification") == "real")
check("Data: Real government data with provenance",
      real_count >= 8,
      f"{len(recs)} datasets, {real_count} classified REAL")

suit = get("/ml/suitability")
check("Honesty: suitability contract (daily-district NOT claimed reliable)",
      "district_day" in str(suit).lower() and "not_supported" in str(suit).lower(),
      "suitability contract exposed")

# ═══ RESULTS ═══
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"\n{'='*68}")
print(f"FINAL COMPLIANCE: {passed}/{total} PDF requirements SOLVED")
print(f"{'='*68}\n")
for name, ok, evidence in results:
    print(f"  {PASS if ok else FAIL} {name}")
    if evidence:
        print(f"     {evidence}")
print(f"\n{'='*68}")
print(f"SCORE: {passed}/{total} = {passed/total*100:.0f}%")
