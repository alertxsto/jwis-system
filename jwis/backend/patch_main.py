import sys
from pathlib import Path

path = Path(r"D:\ai open presu lomba\jwis system\jwis\backend\app\main.py")
if not path.exists():
    print("Error: File not found")
    sys.exit(1)

content = path.read_text(encoding="utf-8")

# 1. Update imports
old_import = "load_fleet_composition, load_kecamatan_map, build_provenance_records, load_kelurahan_heatmap"
new_import = "load_fleet_composition, load_kecamatan_map, build_provenance_records, load_kelurahan_heatmap, load_real_tps_coordinates, load_real_wr_coordinates"

if old_import in content:
    content = content.replace(old_import, new_import)
    print("Imports updated")

# 2. Add endpoints before @app.get("/api/weather") or at the end
endpoints = """

@app.get("/api/geo/tps-coordinates")
def get_tps_coordinates() -> dict[str, Any]:
    \"\"\"Returns all 1,081 official TPS locations as a GeoJSON FeatureCollection.\"\"\"
    tps_list = load_real_tps_coordinates()
    features = []
    for t in tps_list:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [t["lng"], t["lat"]]
            },
            "properties": {
                "name": t["name"],
                "kecamatan": t["kecamatan"],
                "kelurahan": t["kelurahan"]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "source": "Official SILIKA 2023 coordinates",
        "total": len(features)
    }


@app.get("/api/geo/wr-coordinates")
def get_wr_coordinates() -> dict[str, Any]:
    \"\"\"Returns all 7,884 official Wajib Retribusi locations as a GeoJSON FeatureCollection.\"\"\"
    wr_list = load_real_wr_coordinates()
    features = []
    for w in wr_list:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [w["lng"], w["lat"]]
            },
            "properties": {
                "name": w["name"],
                "type": w["jns"],
                "address": w["almt"],
                "kecamatan": w["kec"],
                "kelurahan": w["kel"]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features,
        "source": "Official SILIKA Wajib Retribusi 2023 coordinates",
        "total": len(features)
    }
"""

if "get_tps_coordinates" not in content:
    # insert before get_fleet_executive_report or at the end
    content += endpoints
    print("Endpoints added to main.py")

path.write_text(content, encoding="utf-8")
print("Success patching main.py")
