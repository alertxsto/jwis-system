import sys
from pathlib import Path

path = Path(r"D:\ai open presu lomba\jwis system\jwis\backend\app\main.py")
if not path.exists():
    print("Error: File not found")
    sys.exit(1)

content = path.read_text(encoding="utf-8")

# Ganti endpoint /api/fleet untuk panggil get_dynamic_trucks
old_fleet_endpoint = """@app.get("/api/fleet")
def fleet() -> list[dict]:
    return TRUCKS"""

new_fleet_endpoint = """@app.get("/api/fleet")
def fleet() -> list[dict]:
    from app.data import get_dynamic_trucks
    return get_dynamic_trucks()"""

if old_fleet_endpoint in content:
    content = content.replace(old_fleet_endpoint, new_fleet_endpoint)
    print("Fleet endpoint updated in main.py")
else:
    print("Fleet endpoint pattern not found")

path.write_text(content, encoding="utf-8")
print("Success patching main.py for fleet serialization")
