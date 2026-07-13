# TASK: Retrain JWIS waste-prediction models on REAL data (reproducible pipeline)

You are working on the JWIS project (AI Open Innovation Challenge 2026, DLH DKI Jakarta).
Project root: `D:\ai open presu lomba\jwis system\jwis`
Backend app: `backend/app/` — FastAPI. Models are loaded from `backend/data/models/*.joblib`.

## CONTEXT (read this fully before coding)

The current Prophet + XGBoost models in `backend/data/models/` were trained on
SYNTHETIC data, and there is NO training script in the repo. This is a credibility
risk for the competition. Your job: create a REPRODUCIBLE training pipeline that
uses REAL government data, retrain the models, and produce an HONEST evaluation report.

### The honest data constraint (do NOT fabricate around this)
- Real waste data available is COARSE:
  - `data/real/bantargebang_hasil_penimbangan.csv`: MONTHLY tonnage per source-institution, period `202212`–`202604` (YYYYMM in `periode_data`).
  - `data/real/sipsn_timbulan_2018_2025_dki.csv`: YEARLY daily-average "timbulan" (tons/day) per Jakarta CITY, 2021–2025.
- Real DAILY, per-KELURAHAN waste data does NOT exist publicly.
- Therefore we use a TWO-LAYER approach:
  - **Layer A (100% real):** monthly city-level model from Bantargebang.
  - **Layer B (calibrated synthetic):** disaggregate to daily/per-kelurahan using
    weather + events + weekday patterns, CONSTRAINED so aggregates match real
    SIPSN city totals. Everything in Layer B must be LABELED as calibrated-synthetic.

### The 10 kelurahan the backend expects (keep these exact slugs)
`gambir, tebet, cengkareng, kebon_jeruk, tanjung_priok, koja, jagakarsa, pulogadung, kalideres, kramat_jati`

Map each kelurahan to its city (for SIPSN calibration):
- gambir → Jakarta Pusat
- tebet, jagakarsa → Jakarta Selatan
- cengkareng, kebon_jeruk, kalideres → Jakarta Barat
- tanjung_priok, koja → Jakarta Utara
- pulogadung, kramat_jati → Jakarta Timur

## INPUT FILES (all already present, paths relative to project root `jwis/`)

| File | What it is | Key columns / notes |
|---|---|---|
| `data/real/bantargebang_hasil_penimbangan.csv` | Monthly landfill intake | `periode_data` (YYYYMM), `instansi_asal_kendaraan`, `ritasi`, `tonase`. WARNING: `tonase` format is INCONSISTENT — older rows use spaces as thousand/decimal separators (e.g. `"7 497 14"` means 7497.14; `"22346 24"` means 22346.24), newer rows are clean floats (e.g. `7660.26`). You MUST write a robust parser. |
| `data/real/sipsn_timbulan_2018_2025_dki.csv` | Yearly per-city timbulan | `jml_timbulan_harian` (tons/day), `nama_kabkota`, `tahun`. City labels like "Kota Adm. Jakarta Barat". |
| `data/raw/open_meteo_jakarta_history_2y.json` | Real 2-yr daily weather (Open-Meteo) | `daily.time[]`, `daily.precipitation_sum[]`, `daily.temperature_2m_max[]`, `daily.wind_speed_10m_max[]` |
| `data/real/hari_libur_indonesia_2026.json` | Indonesian holidays 2026 | `data[].date` (YYYY-MM-DD) |
| `data/real/jakarta_events_2026_scraped_official_clean.csv` | Official scraped events | `tanggal`, `nama_event`, `lokasi`, `estimasi_pengunjung` (often BLANK — do not invent) |
| `data/real/penduduk_kelurahan_dki.csv` | Population per kelurahan | `nama_kelurahan`, `jumlah`. Sum across age/gender rows to get total per kelurahan. Use as weights to split city totals across kelurahan. |

## OUTPUT (what you must produce)

1. **`scripts/train_models.py`** — single reproducible script. Running it regenerates
   all models and reports from the input files above. Must be runnable as:
   `python scripts/train_models.py` from the `jwis/` directory.
   Use the same Python that runs the backend (Python 3.12).

2. **Retrained models** into `backend/data/models/` (overwrite existing, but FIRST
   back up existing ones to `backend/data/models/_synthetic_backup/`):
   - `prophet_<slug>.joblib` (10 files)
   - `xgboost_<slug>.joblib` (10 files)
   - Do NOT touch `isolation_forest_fleet.joblib` (that's Case 1, out of scope).

3. **`data/processed/hybrid_forecaster_evaluation.md`** — HONEST report:
   - Describe the two-layer method plainly.
   - Report REAL metrics (MAE, R²) computed on a TIME-BASED holdout (last 20% of the
     time series per kelurahan — NOT random split, this is time series).
   - Explicitly state which layer is real vs calibrated-synthetic.
   - Include a "Data provenance & limitations" section (judges reward honesty).

4. **`data/processed/training_dataset_kelurahan.csv`** — the assembled training set
   you built, so the pipeline is auditable (columns: `date, kelurahan, city,
   precipitation_mm, temp_max_c, wind_max_kmh, is_weekend, is_holiday,
   event_attendance, waste_tons, waste_tons_source`).

## STEP-BY-STEP METHOD

### Step 1 — Parse & clean Bantargebang monthly totals
- Read `bantargebang_hasil_penimbangan.csv`.
- Write `parse_tonase(value)`: strip; if it already parses as float, use it; else
  treat spaces as separators — the LAST group after the final space is the decimal
  part, everything before (spaces removed) is the integer part. Example:
  `"7 497 14"` → integer `"7497"`, decimal `"14"` → `7497.14`. `"1108 7"` → `1108.7`.
  Validate: parsed monthly city totals should land in a sane range (hundreds–tens of thousands of tons/month).
- Group by `periode_data` (month) and sum `tonase` across all institutions to get
  TOTAL monthly intake at Bantargebang. Also keep per-institution if useful.
- Produce a monthly series `month (YYYY-MM) -> total_tons_month`.

### Step 2 — Build the real monthly baseline (Layer A)
- Convert monthly totals to an average tons/day for that month (divide by days in month).
- This is your REAL, defensible signal. Save it; you'll report a monthly-level model
  metric from it as the "100% real" anchor.

### Step 3 — Assemble a daily per-kelurahan training set (Layer B, calibrated)
- Build a daily date range covering the weather history (2 years).
- For each day, attach real features: precipitation, temp_max, wind_max (from Open-Meteo),
  is_weekend (Sat/Sun), is_holiday (from holidays json; note holidays file is 2026 —
  apply by month-day match so it works across years, and document this assumption).
- Attach event_attendance ONLY where the real events CSV has a non-blank estimate;
  otherwise 0. Do NOT invent attendance.
- Compute each CITY's real daily baseline (tons/day) from SIPSN latest year.
- Split each city's daily baseline across its kelurahan using POPULATION WEIGHTS
  from `penduduk_kelurahan_dki.csv` (kelurahan_pop / sum_of_that_city's_modeled_kelurahan_pop).
- Apply a transparent, documented multiplier for daily variation:
  `waste_day = kelurahan_baseline * (1 + f(rain, event, weekend))`
  Use the SAME driver logic already in the backend (`engine.forecast_waste_risk`):
  rain>=30:+0.16, rain>=10:+0.08; attendance>=50k:+0.18, >=10k:+0.09; weekend:+0.07.
  This keeps the model consistent with the app's explainability story.
- CALIBRATION CONSTRAINT: after applying multipliers, rescale each city-day so the sum
  across its kelurahan equals the real SIPSN city daily baseline (preserve real totals).
- Label every row `waste_tons_source = "calibrated_synthetic_anchored_to_SIPSN_real"`.
- Save the assembled set to `data/processed/training_dataset_kelurahan.csv`.

### Step 4 — Train per-kelurahan hybrid models (match backend contract EXACTLY)
The backend (`backend/app/engine.py::predict_waste_hybrid`) loads and calls the models
like this — your saved models MUST be compatible:
- Prophet: `joblib.load(...)`, then `model.predict(DataFrame({"ds":[timestamp]}))["yhat"]`.
  So fit Prophet on columns `ds` (date) and `y` (waste_tons) per kelurahan.
- XGBoost: `joblib.load(...)`, then `model.predict(DataFrame([{...features...}]))` where
  features are EXACTLY, in this order:
  `precipitation_mm, temp_max_c, wind_max_kmh, is_weekend(int), is_holiday(int), event_attendance`.
  Train XGBRegressor on the RESIDUAL: `y - prophet_yhat` using those features.
- Final prediction = prophet_yhat + xgb_residual (this is what the backend computes).
- Use a TIME-BASED split: train on the first 80% of dates, test on the last 20%.

### Step 5 — Evaluate honestly & write the report
- Compute MAE and R² on the held-out test slice per kelurahan, and averages.
- Compare against a naive baseline (predict the training mean) so improvement is meaningful.
- Write `data/processed/hybrid_forecaster_evaluation.md` with: method, per-kelurahan
  table, averages, naive-baseline comparison, and a blunt "Limitations" section
  stating the daily/per-kelurahan target is calibrated-synthetic anchored to real
  SIPSN city totals and real Bantargebang monthly totals.

## VERIFICATION (must pass before you say you're done)
1. `python scripts/train_models.py` runs end-to-end with no error from the `jwis/` dir.
2. Exactly 10 `prophet_*.joblib` and 10 `xgboost_*.joblib` written to `backend/data/models/`.
3. Old models backed up in `backend/data/models/_synthetic_backup/`.
4. Backend still loads them: from `jwis/backend/` run
   `python -c "from app.engine import predict_waste_hybrid; print(predict_waste_hybrid('kebon_jeruk', rainfall_mm=42, event_attendance=85000, is_weekend=True))"`
   → must return `model_available: True` and a numeric `predicted_tons`.
5. Backend tests still pass: from `jwis/backend/` run `python -m unittest discover -s tests`.
6. Both new files exist: `data/processed/hybrid_forecaster_evaluation.md` and
   `data/processed/training_dataset_kelurahan.csv`.

## RULES
- Do NOT change the backend model-loading contract or the feature order.
- Do NOT invent data. Where real data is missing, disaggregate transparently and LABEL it.
- Keep the tonase parser robust and add a couple of asserts/sanity prints.
- Pin nothing new; dependencies already in `backend/requirements.txt`
  (prophet==1.3.0, xgboost==3.2.0, scikit-learn==1.8.0, pandas==3.0.2, joblib==1.5.3).
- Print a clear summary at the end (rows used, date range, avg MAE, avg R²).
