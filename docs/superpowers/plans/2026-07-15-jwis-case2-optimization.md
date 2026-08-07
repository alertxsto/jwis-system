# JWIS Case 2 Complete Optimization Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Case 2 operations optimizer CP-SAT backend with a dedicated dashboard approval panel, role-based authorization headers, and spatially grounded event-based predictions.

**Architecture:** Extend the React Vite frontend dashboard with an Operations Optimizer panel to call `/api/operations/plan` and approve it via `/api/operations/{plan_id}/approve`. This pushes assignments into the dispatch database and Field App. Adjust prediction logic to localize crowd impacts rather than applying them uniformly.

**Tech Stack:** React 19, FastAPI, scikit-learn, joblib, unittest.

## Global Constraints
- Preserve honest data provenance labels: `PUBLIC DATA`, `SIMULATED`, `MODEL OUTPUT`.
- No suppression of type errors.
- Do not use Streamlit.
- Keep the test suite passing at every checkpoint.

---

### Task 1: Spatially Grounded Event Forecast Adjustments

**Files:**
- Modify: `jwis/backend/app/main.py`
- Test: `jwis/backend/tests/test_main_api.py`

**Interfaces:**
- Consumes: `/api/predictions/kecamatan` parameters.
- Produces: Adjusted forecast predictions where crowd attendance is restricted to the specific hosting kecamatan.

- [ ] **Step 1: Write a failing test in test_main_api.py**
Open `jwis/backend/tests/test_main_api.py` and add a test verifying that an event in Kemayoran (Jakarta Pusat) only impacts Kemayoran/Jakarta Pusat and not Cengkareng (Jakarta Barat).

- [ ] **Step 2: Run test to verify it fails**
Run: `python -m unittest tests.test_main_api -v`
Expected: FAIL

- [ ] **Step 3: Modify app/main.py prediction routing**
Check location of active events in `predictions_kecamatan` endpoint. If `event_attendance > 0`, only apply it to the specific kecamatan slug hosting the event (e.g. `kemayoran` or matching city), else set `event_attendance = 0` for non-hosting areas.

- [ ] **Step 4: Run test to verify it passes**
Run: `python -m unittest tests.test_main_api -v`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add jwis/backend/app/main.py
git commit -m "feat(ml): localize event attendance to hosting districts"
```

---

### Task 2: UI Panel for Operations Optimizer (Case 2 -> Case 1 Bridge)

**Files:**
- Modify: `jwis/frontend/src/main.jsx`
- Modify: `jwis/frontend/src/styles.css`

**Interfaces:**
- Consumes: `/api/operations/plan` (POST) and `/api/operations/{plan_id}/approve` (POST).
- Produces: Interactive "Operations Optimizer" component showing assignments and an "Approve & Dispatch" action.

- [ ] **Step 1: Implement `OperationsOptimizerPanel` in main.jsx**
Add the UI component fetching the proposed plan on scenario run/load, displaying assignments, and carrying out the approval workflow with the auth token.

- [ ] **Step 2: Wire the panel into `CommandCenter` main grid**
Place `<OperationsOptimizerPanel />` below `<ScenarioPanel />` in the layout.

- [ ] **Step 3: Build the frontend to verify there are no compilation errors**
Run: `npm run build` in `jwis/frontend`
Expected: SUCCESS

- [ ] **Step 4: Commit**
```bash
git add jwis/frontend/src/main.jsx jwis/frontend/src/styles.css
git commit -m "feat(ui): add Operations Optimizer panel to dashboard"
```
