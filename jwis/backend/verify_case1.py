import sys, io, json, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8001/api"

def get(p):
    with urllib.request.urlopen(B + p, timeout=60) as r:
        return json.load(r)

fleet = get("/fleet")
print("1. Fleet:", len(fleet), "trucks")
acts = {}
for t in fleet:
    s = t["activity"]["state"]
    acts[s] = acts.get(s, 0) + 1
print("   Activity:", acts)
damaged = [t for t in fleet if t["is_damaged"]]
print("   Damaged:", len(damaged), [t["truck_code"] for t in damaged[:5]])

t47 = [t for t in fleet if t["truck_code"] == "T-047"][0]
dv = t47["deviation"]
print("2. T-047 violation:", dv["violated"], dv["distance_meters"], "m", dv["severity"], "flags:", dv["rule_flags"])

unl = get("/fleet/unlicensed-collectors")
print("3. Unlicensed:", unl["unauthorized_count"], "/", unl["observed_count"])

alt = get("/fleet/route-alternatives?truck_code=T-047")
print("4. Route alternatives:", alt["route_count"], [f"{r['eta_minutes']}min" for r in alt["routes"]])

q = get("/tpa/queue-status?scenario=peak")
print("5. TPA queue (peak):", q["avg_wait_minutes"], "min,", q["trucks_in_queue"], "trucks,", q["status_label"])

hist = get("/fleet/history")
print("6. Trip history:", len(hist), "records, trucks:", [h["truck_code"] for h in hist])

so = get("/fleet/status-overview")
print("7. Fleet status:", so["total_trucks"], "total,", so["damaged_count"], "damaged")
print("   By activity:", so["by_activity"])
