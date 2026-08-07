# SPEC: JWIS Case 2 Complete Optimization Design

## 1. Goal
Connect Case 2 waste-volume predictions with Case 1 logistics dispatch workflows. Build an auditable decision loop where forecasted hotspots drive CP-SAT optimization, managers approve recommendations, and field dispatches update in real-time.

## 2. Target Architecture & Flow
```
[Scenario Simulator (Rain, Attendance, Date)]
                  │
                  ▼ (GET /api/predictions/kecamatan)
[Kecamatan hotspots with readiness alerts]
                  │
                  ▼ (POST /api/operations/plan)
[CP-SAT Optimizer (operational_optimizer.py)]
                  │
                  ▼ (POST /api/operations/{plan_id}/approve)
[Approval Panel (main dashboard)]
                  │
                  ▼ (spawns Case 1 dispatches)
[Acknowledge / Confirm (Field App PWA)]
```

## 3. Key Components & Implementation

### 3.1 Scenario Simulator & Spatial Grounding
- **Spatially Grounded Events**: Event attendance is no longer applied uniformly. Instead, if an event (e.g. Konser GBK) is active, its attendance only increases the waste volume in its specific kecamatan (e.g., `tanah_abang` / `setiabudi`).
- **Endpoint**: `/api/predictions/kecamatan` uses spatial location of active events from `load_official_events` or the simulated parameters.

### 3.2 Integrated Optimizer UI Panel
- **Files**: `jwis/frontend/src/main.jsx`
- **Location**: Inserted right below `ScenarioPanel`.
- **Functionality**:
  - Automatically posts rain, attendance, weekend, and hotspot count to `/api/operations/plan`.
  - Renders the proposed `plan_id`, list of assignments (Truck to Area, assigned tonnage, permit/capacity status), and unmet reasons.
  - Renders an **"Approve & Dispatch Plan"** button.
  - On click, posts to `/api/operations/{plan_id}/approve` using the authorization headers, which spawns the dispatches in the database, refreshing the active alert list and logs.

### 3.3 Auth Protection & Permissions
- `/api/operations/{plan_id}/approve` checks role permissions.
- Frontend includes the auth token in headers for this request.

## 4. Test-Driven Verification
- Unit tests: verify optimizer is triggered under simulated events and constraints.
- E2E tests: verify plan creation, list display, and approval updates the dispatch log.
