"""RBAC matrix for every mutating endpoint (issue #5).

Unauthenticated callers get 401, a role without the permission gets 403, and
an authorized role reaches the handler (2xx/4xx — a 404/409 on a fixture id
still proves auth passed).
"""
import pytest

CREATE_ENDPOINTS = [
    ("post", "/api/alert/follow-up", {"alert_id": "a1", "status": "OPEN", "operator": "op"}),
    ("post", "/api/whatsapp/contacts", {"drivers": {"X": "6281234567890@c.us"}}),
    ("post", "/api/whatsapp/logout", None),
    ("post", "/api/whatsapp/alert", {"truck_code": "T-001", "issue": "i", "route_name": "r", "recommendation": "r"}),
    ("post", "/api/whatsapp/alert/simulate", {"truck_code": "T-001", "issue": "i", "route_name": "r", "recommendation": "r"}),
    ("post", "/api/dispatch", {"truck_code": "T-001", "instruction": "x"}),
    ("post", "/api/dispatch/nonexistent/confirm", {"status": "READY"}),
    ("post", "/api/operations/plan", None),
    ("post", "/api/events/permits", {"name": "Uji Acara", "location_name": "Monas", "date": "2026-09-23",
                                     "start_hour": 10, "end_hour": 12, "expected_attendance": 1000,
                                     "lat": -6.17, "lng": 106.82}),
    ("post", "/api/simulator/stagger?active_trucks=2", None),
    ("post", "/api/fleet/astar-simulate-jam?active=false", None),
    ("post", "/api/spj", {"driver_name": "D", "truck_code": "T-001", "destination": "TPA"}),
    ("post", "/api/spj/none/stops", {"name": "S", "kecamatan": "GAMBIR", "address": "a", "lat": -6.1, "lng": 106.8}),
    ("post", "/api/spj/none/activate", None),
    ("post", "/api/spj/none/complete", None),
    ("post", "/api/spj/none/cancel", None),
    ("post", "/api/spj/none/stops/0/complete", None),
    ("post", "/api/spj/none/receipt", {"photo_name": "p.jpg", "photo_b64": ""}),
    ("post", "/api/pretrip", {"truck_code": "T-001", "driver_name": "D", "items": {"Rem": True}}),
    ("post", "/api/damage-reports", {"truck_code": "T-001", "driver_name": "D", "description": "x"}),
    ("post", "/api/damage-reports/none/resolve", None),
    ("post", "/api/service-records", {"truck_code": "T-001", "service_date": "2026-09-22", "component": "Oli"}),
    ("post", "/api/ocr/timbangan", {"photo_b64": ""}),
    ("post", "/api/assistant/query", {"question": "status?"}),
]


@pytest.mark.parametrize("method,path,body", CREATE_ENDPOINTS)
def test_unauthenticated_gets_401(api_client, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    res = getattr(api_client, method)(path, **kwargs)
    assert res.status_code == 401, f"{path} expected 401, got {res.status_code}: {res.text[:200]}"


@pytest.mark.parametrize("method,path,body", CREATE_ENDPOINTS)
def test_authorized_role_passes_auth(api_client, auth_headers, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    kwargs["headers"] = auth_headers("administrator")
    res = getattr(api_client, method)(path, **kwargs)
    assert res.status_code not in (401, 403), f"{path} should pass auth, got {res.status_code}: {res.text[:200]}"


def test_auditor_role_denied_dispatch(api_client):
    # auditor has neither dispatch:create nor dispatch:confirm
    res = api_client.post("/api/auth/login", json={"username": "auditor", "password": "auditor-demo-pass"})
    token = res.json()["token"]
    res = api_client.post("/api/dispatch", json={"truck_code": "T-001", "instruction": "x"},
                          headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


def test_driver_cannot_create_dispatch_but_can_confirm(api_client, auth_headers):
    res = api_client.post("/api/dispatch", json={"truck_code": "T-001", "instruction": "x"},
                          headers=auth_headers("driver"))
    assert res.status_code == 403
    # confirm on a missing id → 404, which means auth passed
    res = api_client.post("/api/dispatch/nonexistent/confirm", json={"status": "READY"},
                          headers=auth_headers("driver"))
    assert res.status_code == 404


def test_contacts_refuses_to_shrink(api_client, auth_headers):
    res = api_client.post("/api/whatsapp/contacts", json={"drivers": {}}, headers=auth_headers("administrator"))
    assert res.status_code == 409
