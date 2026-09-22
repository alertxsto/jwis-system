#!/usr/bin/env bash
# JWIS dev launcher (Linux/macOS). Mirrors run-dev.ps1.
# Usage: bash jwis/run-dev.sh   (from the repo root or anywhere)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PY="${PYTHON:-python3}"
command -v "$PY" >/dev/null || { echo "python3 not found"; exit 1; }
command -v node >/dev/null || { echo "node (18+) not found"; exit 1; }

echo "== Backend deps =="
if [ ! -d "$ROOT/backend/.venv" ]; then "$PY" -m venv "$ROOT/backend/.venv"; fi
"$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt" python-dotenv

echo "== Frontend deps =="
(cd "$ROOT/frontend" && npm install --no-fund --no-audit)

echo "== WhatsApp gateway deps =="
(cd "$ROOT/backend/wa-gateway" && npm install --no-fund --no-audit)

echo "== Starting services (Ctrl-C stops all) =="
trap 'kill 0' EXIT
(
  cd "$ROOT/backend"
  JWIS_AI_ENGINE=on PYTHONPATH="$ROOT/backend" \
    "$ROOT/backend/.venv/bin/python" -m uvicorn app.main:app --port 8001
) &
(cd "$ROOT/backend/wa-gateway" && node server.js) &
(
  cd "$ROOT/frontend"
  npm run build
  npm run preview -- --port 5175
) &
wait
