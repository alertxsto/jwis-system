import sys
from pathlib import Path

path = Path(r"D:\ai open presu lomba\jwis system\jwis\backend\app\real_data.py")
if not path.exists():
    print("Error: File not found")
    sys.exit(1)

content = path.read_text(encoding="utf-8")

# 1. Update registry
registry_old = """    {
        "name": "kelurahan_dki_full_267.geojson",
        "source_url": "https://github.com/pararawendy/border-indonesia-geojson",
        "as_of": "2020",
        "granularity": "kelurahan-polygon",
        "classification": "real",
        "limitations": "267 DKI village polygons; administrative boundaries only.",
    },
]"""

registry_new = """    {
        "name": "kelurahan_dki_full_267.geojson",
        "source_url": "https://github.com/pararawendy/border-indonesia-geojson",
        "as_of": "2020",
        "granularity": "kelurahan-polygon",
        "classification": "real",
        "limitations": "267 DKI village polygons; administrative boundaries only.",
    },
    {
        "name": "REAL_SILIKA_TPS_locations_with_coordinates.csv",
        "source_url": "https://silika.jakarta.go.id/tps",
        "as_of": "2023",
        "granularity": "tps-location",
        "classification": "real",
        "limitations": "Official SILIKA TPS location coordinate layer.",
    },
    {
        "name": "REAL_SILIKA_wajib_retribusi_locations.csv",
        "source_url": "https://silika.jakarta.go.id/wr",
        "as_of": "2023",
        "granularity": "wr-location",
        "classification": "real",
        "limitations": "Official SILIKA Wajib Retribusi commercial waste generator coordinate layer.",
    },
]"""

if registry_old in content:
    content = content.replace(registry_old, registry_new)
    print("Registry updated")

# 2. Add loaders
loaders = """

@lru_cache(maxsize=1)
def load_real_tps_coordinates() -> list[dict[str, Any]]:
    \"\"\"Loads real 1,081 TPS locations from SILIKA with precise coordinates.\"\"\"
    path = REAL_DIR / "REAL_SILIKA_TPS_locations_with_coordinates.csv"
    if not path.exists():
        return []
    out = []
    with path.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            lat = _to_float(row.get("latitude"))
            lng = _to_float(row.get("longitude"))
            if lat is not None and lng is not None:
                out.append({
                    "name": (row.get("nama_tps") or "").strip(),
                    "kecamatan": (row.get("kecamatan") or "").strip(),
                    "kelurahan": (row.get("kelurahan") or "").strip(),
                    "lat": lat,
                    "lng": lng,
                })
    return out


@lru_cache(maxsize=1)
def load_real_wr_coordinates() -> list[dict[str, Any]]:
    \"\"\"Loads real 7,884 Wajib Retribusi locations from SILIKA with precise coordinates.\"\"\"
    path = REAL_DIR / "REAL_SILIKA_wajib_retribusi_locations.csv"
    if not path.exists():
        return []
    out = []
    with path.open(encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            lat = _to_float(row.get("lat"))
            lng = _to_float(row.get("lng"))
            if lat is not None and lng is not None:
                out.append({
                    "name": (row.get("nama") or "").strip(),
                    "jns": (row.get("jns") or "").strip(),
                    "almt": (row.get("almt") or "").strip(),
                    "kec": (row.get("kec") or "").strip(),
                    "kel": (row.get("kel") or "").strip(),
                    "lat": lat,
                    "lng": lng,
                })
    return out
"""

if "load_real_tps_coordinates" not in content:
    content += loaders
    print("Loaders added")

path.write_text(content, encoding="utf-8")
print("Success patching real_data.py")
