import sys, io, json, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8001/api"

def get(p):
    with urllib.request.urlopen(B + p, timeout=60) as r:
            return json.load(r)

JKT = (-7.5, -5.5, 105.5, 108.0)  # lat_min, lat_max, lng_min, lng_max

def in_jkt(lat, lng):
    return JKT[0] <= lat <= JKT[1] and JKT[2] <= lng <= JKT[3]

print("=== MAP DATA ACCURACY AUDIT ===\n")

# 1. Kelurahan heatmap polygons
hm = get("/geo/kelurahan-heatmap")
feats = hm["features"]
out_of_bounds = 0
total_coords = 0
for f in feats:
    geom = f.get("geometry", {})
    coords = geom.get("coordinates", [])
    if geom.get("type") == "Polygon":
        for ring in coords:
            for pt in ring:
                total_coords += 1
                if not in_jkt(pt[1], pt[0]):
                    out_of_bounds += 1
    elif geom.get("type") == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                for pt in ring:
                    total_coords += 1
                    if not in_jkt(pt[1], pt[0]):
                        out_of_bounds += 1
print(f"1. Kelurahan heatmap: {len(feats)} polygons, {total_coords} coords, {out_of_bounds} out-of-bounds -> {'PASS' if out_of_bounds == 0 else 'FAIL'}")

# 2. TPS coordinates
tps = get("/geo/tps-coordinates")
tps_data = tps if isinstance(tps, list) else tps.get("coordinates", tps.get("features", []))
if isinstance(tps_data, list):
    tps_pts = tps_data
else:
    tps_pts = []
tps_oob = sum(1 for p in tps_pts if not in_jkt(p.get("lat", 0), p.get("lng", 0)))
print(f"2. TPS points: {len(tps_pts)} locations, {tps_oob} out-of-bounds -> {'PASS' if tps_oob == 0 else 'FAIL'}")

# 3. WR coordinates
wr = get("/geo/wr-coordinates")
wr_data = wr if isinstance(wr, list) else wr.get("coordinates", wr.get("features", []))
if isinstance(wr_data, list):
    wr_pts = wr_data
else:
    wr_pts = []
wr_oob = sum(1 for p in wr_pts if not in_jkt(p.get("lat", 0), p.get("lng", 0)))
print(f"3. WR points: {len(wr_pts)} locations, {wr_oob} out-of-bounds -> {'PASS' if wr_oob == 0 else 'FAIL'}")

# 4. Truck positions
fleet = get("/fleet")
fleet_oob = sum(1 for t in fleet if not in_jkt(t["latest_position"]["lat"], t["latest_position"]["lng"]))
print(f"4. Fleet positions: {len(fleet)} trucks, {fleet_oob} out-of-bounds -> {'PASS' if fleet_oob == 0 else 'FAIL'}")

# 5. Event permits
permits = get("/events/permits")
ev_oob = sum(1 for p in permits if not in_jkt(p.get("lat", 0), p.get("lng", 0)))
print(f"5. Event permits: {len(permits)} events, {ev_oob} out-of-bounds -> {'PASS' if ev_oob == 0 else 'FAIL'}")

# 6. Map truth (truck routes follow real roads?)
mt = get("/fleet/map-truth")
t47 = [t for t in mt["trucks"] if t["truck_code"] == "T-047"][0]
geom_len = len(t47.get("assigned_route", {}).get("geometry", []))
actual_len = len(t47.get("actual_route", {}).get("geometry", []))
print(f"6. Map truth T-047: assigned={geom_len} pts, actual={actual_len} pts, source={t47['provenance']['assigned_route']}")

# 7. TPA Bantargebang
q = get("/tpa/queue-status")
tpa_lat, tpa_lng = q["lat"], q["lng"]
print(f"7. TPA Bantargebang: ({tpa_lat}, {tpa_lng}) in_jkt={in_jkt(tpa_lat, tpa_lng)}")

# 8. Kecamatan centroids
pred = get("/predictions/kecamatan")
kec_oob = sum(1 for k in pred["kecamatan"] if k.get("lat") and k.get("lng") and not in_jkt(k["lat"], k["lng"]))
print(f"8. Kecamatan centroids: {pred['kecamatan_count']} districts, {kec_oob} out-of-bounds -> {'PASS' if kec_oob == 0 else 'FAIL'}")

print("\n=== SUMMARY ===")
all_pass = (out_of_bounds == 0 and tps_oob == 0 and wr_oob == 0 and fleet_oob == 0
            and ev_oob == 0 and kec_oob == 0 and geom_len > 20)
print("ALL MAP DATA:", "PASS" if all_pass else "NEEDS ATTENTION")
