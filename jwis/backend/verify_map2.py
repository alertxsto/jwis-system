import sys, io, json, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8001/api"

def get(p):
    with urllib.request.urlopen(B + p, timeout=60) as r:
            return json.load(r)

# DKI Jakarta including Kepulauan Seribu: lat -7.5 to -5.0, lng 105.5 to 108.0
def in_dki(lat, lng):
    return -7.5 <= lat <= -5.0 and 105.5 <= lng <= 108.0

def extract_coords(item):
    """Extract (lat, lng) from GeoJSON Feature or flat dict."""
    if isinstance(item, dict):
        geom = item.get("geometry", {})
        if geom and geom.get("type") == "Point":
            coords = geom["coordinates"]
            return coords[1], coords[0]  # GeoJSON is [lng, lat]
        if "lat" in item and "lng" in item:
            return item["lat"], item["lng"]
    return None, None

print("=== MAP DATA ACCURACY AUDIT (corrected) ===\n")

# 1. Kelurahan heatmap
hm = get("/geo/kelurahan-heatmap")
feats = hm["features"]
oob = 0
total = 0
for f in feats:
    geom = f.get("geometry", {})
    coords = geom.get("coordinates", [])
    rings = []
    if geom.get("type") == "Polygon":
        rings = coords
    elif geom.get("type") == "MultiPolygon":
        rings = [r for poly in coords for r in poly]
    for ring in rings:
        for pt in ring:
            total += 1
            if not in_dki(pt[1], pt[0]):
                oob += 1
print(f"1. Kelurahan heatmap: {len(feats)} polygons, {total} coords, {oob} out-of-bounds")

# Check which kelurahan are out of bounds
if oob > 0:
    oob_kels = set()
    for f in feats:
        geom = f.get("geometry", {})
        coords = geom.get("coordinates", [])
        rings = coords if geom.get("type") == "Polygon" else [r for poly in coords for r in poly]
        for ring in rings:
            for pt in ring:
                if not in_dki(pt[1], pt[0]):
                    oob_kels.add(f["properties"].get("kelurahan", "?"))
    print(f"   Out-of-bounds kelurahan: {sorted(oob_kels)}")

# 2. TPS
tps = get("/geo/tps-coordinates")
tps_feats = tps.get("features", []) if isinstance(tps, dict) else tps
tps_oob = 0
for f in tps_feats:
    lat, lng = extract_coords(f)
    if lat is not None and not in_dki(lat, lng):
        tps_oob += 1
print(f"2. TPS points: {len(tps_feats)} locations, {tps_oob} out-of-bounds")

# 3. WR
wr = get("/geo/wr-coordinates")
wr_feats = wr.get("features", []) if isinstance(wr, dict) else wr
wr_oob = 0
for f in wr_feats:
    lat, lng = extract_coords(f)
    if lat is not None and not in_dki(lat, lng):
        wr_oob += 1
print(f"3. WR points: {len(wr_feats)} locations, {wr_oob} out-of-bounds")

# 4. Fleet
fleet = get("/fleet")
fleet_oob = sum(1 for t in fleet if not in_dki(t["latest_position"]["lat"], t["latest_position"]["lng"]))
print(f"4. Fleet positions: {len(fleet)} trucks, {fleet_oob} out-of-bounds")

# 5. Event permits
permits = get("/events/permits")
ev_oob = sum(1 for p in permits if not in_dki(p.get("lat", 0), p.get("lng", 0)))
print(f"5. Event permits: {len(permits)} events, {ev_oob} out-of-bounds")

# 6. Map truth geometry
mt = get("/fleet/map-truth")
t47 = [t for t in mt["trucks"] if t["truck_code"] == "T-047"][0]
print(f"6. T-047 route: assigned={len(t47.get('assigned_route',{}).get('geometry',[]))} pts, actual={len(t47.get('actual_route',{}).get('geometry',[]))} pts, source={t47['provenance']['assigned_route']}")

# 7. TPA
q = get("/tpa/queue-status")
print(f"7. TPA Bantargebang: ({q['lat']}, {q['lng']}) in_dki={in_dki(q['lat'], q['lng'])}")

# 8. Kecamatan centroids
pred = get("/predictions/kecamatan")
kec_oob = sum(1 for k in pred["kecamatan"] if k.get("lat") and k.get("lng") and not in_dki(k["lat"], k["lng"]))
print(f"8. Kecamatan centroids: {pred['kecamatan_count']} districts, {kec_oob} out-of-bounds")
