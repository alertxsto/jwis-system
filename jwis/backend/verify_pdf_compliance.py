# -*- coding: utf-8 -*-
"""Live end-to-end compliance audit of JWIS against every line of Waste - DLH.pdf."""
import json
import sys
import io
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8001/api"


def get(p):
    with urllib.request.urlopen(B + p, timeout=180) as r:
        return json.load(r)


def post(p, body):
    req = urllib.request.Request(B + p, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r), r.status


print("=" * 70)
print("CASE 1 — AI-BASED WASTE TRANSPORTATION MONITORING & SUPERVISION")
print("=" * 70)

fleet = get("/fleet")
print(f"[1] 'Monitor position AND activity in real-time'")
print(f"    fleet tracked: {len(fleet)} units")
acts = {}
for t in fleet:
    s = t["activity"]["state"]
    acts[s] = acts.get(s, 0) + 1
print(f"    activity states live: {acts}")
print(f"    sample activity basis: {fleet[0]['activity']['basis']}")

damaged = [t for t in fleet if t["is_damaged"]]
print(f"[scope] 'fleet damage status': {len(damaged)} units flagged")
for d in damaged[:3]:
    print(f"        {d['truck_code']}: {d['damage_status']['state']} — {d['damage_status']['note']}")

t47 = [t for t in fleet if t["truck_code"] == "T-047"][0]
dv = t47["deviation"]
print(f"[2] 'Detect violations (route deviations / illegal activity)'")
print(f"    T-047 violated={dv['violated']} dist={dv['distance_meters']}m severity={dv['severity']} "
      f"conf={dv['confidence']} ml_score={dv['ml_score']} flags={dv['rule_flags']}")
unl = get("/fleet/unlicensed-collectors")
print(f"    unlicensed collectors: {unl['unauthorized_count']}/{unl['observed_count']} flagged -> "
      f"{[a.get('plate') for a in unl['alerts']]}")

alt = get("/fleet/route-alternatives?truck_code=T-047")
print(f"[scope] 'alternative routes considering regulations & permits'")
print(f"    computed alternatives: {alt['route_count']} routes")
for r in alt["routes"]:
    print(f"      rank{r['rank']}: {r['eta_minutes']}min {r['physical_distance_km']}km via {' -> '.join(r['sequence'][1:-1])[:80]}")
alt12 = get("/fleet/route-alternatives?truck_code=T-047&permit_hour=12")
seqs = [" -> ".join(r["sequence"]) for r in alt12["routes"]]
print(f"    permit window 12:00 active -> routes reroute: {['SEMANGGI -> CAWANG' in s for s in seqs]} (inner toll used?)")

q = get("/tpa/queue-status")
print(f"[scope] 'queue status at the landfill': wait={q['avg_wait_minutes']}min p95={q['p95_wait_minutes']} "
      f"maxQ={q['max_queue']} method={q['method']}")
sim = post("/api/simulator/stagger?active_trucks=47".replace("/api", ""), {}) if False else None
import urllib.parse
with urllib.request.urlopen(urllib.request.Request(B + "/simulator/stagger?active_trucks=47", method="POST"), timeout=180) as r:
    sim = json.load(r)
print(f"[sim] scheduling simulator: baseline {sim['baseline_wait_minutes']}min -> staggered {sim['optimized_wait_minutes']}min "
      f"(-{sim['queue_reduction_percent']}%) slots={len(sim['dispatch_slots'])} ci95={sim['wait_ci95']}")

mt = get("/fleet/map-truth")
t47mt = [t for t in mt["trucks"] if t["truck_code"] == "T-047"][0]
print(f"[model] real-time route tracking truth: T-047 deviation_m={t47mt['deviation_m']} "
      f"segments={t47mt['deviation_segments']} provenance={t47mt['provenance']}")

es = get("/reports/executive-summary")
print(f"[exec] executive summary keys: {sorted(es.keys())}")
print(f"       queue impact: {es['queue_impact']['baseline_wait_minutes']}->{es['queue_impact']['optimized_wait_minutes']}min")

hist = get("/fleet/history")
print(f"[dash] trip history: {len(hist)} records, engine-derived label: {hist[0].get('record_type')}")
print(f"       T-047 deviations replayed: {[h['deviations_detected'] for h in hist if h['truck_code']=='T-047']}")

print()
print("=" * 70)
print("CASE 2 — WASTE VOLUME PREDICTION (HISTORICAL DATA & EVENTS)")
print("=" * 70)

pred = get("/predictions/kecamatan?rainfall_mm=42&event_attendance=85000&is_weekend=true&event_lat=-6.2183&event_lng=106.8022")
print(f"[1] 'Predict volume AND location': {pred['kecamatan_count']} kecamatan, total {pred['total_predicted_tons']} t/day")
top = pred["top_hotspots"][0]
print(f"    top hotspot: {top['kecamatan']} {top['predicted_tons']}t trucks={top['trucks_required']} crews={top['crews_required']} man-hours={top['man_hours_required']}")
attr = top.get("factor_attribution") or {}
print(f"[2] 'Integrating historical, weather, event data' -> attribution: {attr}")

h30 = get("/predictions/kecamatan?horizon_days=30")
h30sample = h30["kecamatan"][0]
print(f"[scope] 'mapped TEMPORALLY': horizon {h30['horizon_days']}d series_len={len(h30sample['daily_series'])} "
      f"peak={h30sample['horizon_peak_date']} ({h30sample['horizon_peak_tons']}t)")
hm = get("/geo/kelurahan-heatmap")
feats = hm["features"]
vals = [f["properties"]["predicted_tons"] for f in feats if f["properties"].get("predicted_tons") is not None]
methods = {f["properties"]["classification"] for f in feats}
print(f"[scope] 'mapped SPATIALLY': {len(feats)} kelurahan polygons, {len(set(vals))} distinct values, methods={methods}")

gap = get("/facilities/gap-analysis?rainfall_mm=42&event_attendance=85000")
print(f"[scope] 'need & LOCATION of disposal/transport facilities':")
print(f"    {gap['summary']}")
g0 = gap["areas"][0]
print(f"    worst area: {g0['kecamatan']} gap={g0['gap_ton_per_day']}t -> +{g0['recommended_extra_trips_per_day']} trips, "
      f"site near {[c['kelurahan'] for c in g0['siting_candidates']]}")

permit, status = post("/events/permits", {
    "name": "Konser Verifikasi Final", "location_name": "GBK Senayan",
    "event_date": "2026-09-20", "expected_attendance": 80000,
    "lat": -6.2183, "lng": 106.8022,
})
print(f"[scope] 'based on crowd permit submitted': POST status={status} -> {permit['impact']['predicted_waste_tons']}t, "
      f"{permit['impact']['backup_trucks_required']} trucks, affected={[a['kecamatan'] for a in permit['affected_kecamatan']]}")
plist = get("/events/permits")
print(f"    permit now in layer: {[p['id'] for p in plist if p.get('data_class')=='USER_SUBMITTED']}")

suit = get("/ml/suitability")
print(f"[honesty] suitability contract: {json.dumps(suit)[:240]}")

prov = get("/data/provenance")
recs = prov if isinstance(prov, list) else prov.get("records", [])
print(f"[data] provenance records: {len(recs)} datasets, real-classified: "
      f"{sum(1 for r in recs if r.get('classification')=='real')}")

print()
print("=" * 70)
print("AUDIT DONE")
