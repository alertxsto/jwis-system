# -*- coding: utf-8 -*-
"""Role-aware authentication and RBAC for JWIS.

Replaces the frontend-only admin/admin123 gate with a backend principal model.
Passwords are demo credentials sourced from environment when set; this is a
pilot-grade gate, not production IdP integration (documented as such).
"""
from __future__ import annotations

import hashlib
import hmac
import os

# Permission sets per role. Least privilege: drivers only act on their tasks.
ROLES: dict[str, set[str]] = {
    "executive": {"dashboard:read", "reports:read", "history:read"},
    "dispatcher": {"dashboard:read", "operations:plan", "dispatch:create", "history:read"},
    "supervisor": {"dashboard:read", "dispatch:create", "operations:approve", "history:read"},
    "driver": {"dispatch:confirm"},
    "auditor": {"history:read", "reports:read", "provenance:read"},
    "administrator": {"dashboard:read", "reports:read", "history:read", "operations:plan",
                      "operations:approve", "dispatch:create", "dispatch:confirm",
                      "provenance:read", "admin:manage"},
}

# Demo credentials: password is "<role>-demo-pass" unless overridden by env
# JWIS_PW_<ROLE>. Pilot-grade only.
def _expected_password(role: str) -> str:
    return os.getenv(f"JWIS_PW_{role.upper()}", f"{role}-demo-pass")


def authenticate(username: str, password: str) -> dict[str, str] | None:
    role = username.strip().lower()
    if role not in ROLES:
        return None
    expected = _expected_password(role)
    if hmac.compare_digest(password, expected):
        return {"username": role, "role": role}
    return None


def has_permission(role: str, permission: str) -> bool:
    return permission in ROLES.get(role, set())


def token_for(principal: dict[str, str]) -> str:
    """Opaque demo token binding username+role (not a signed JWT; pilot-grade)."""
    raw = f"{principal['username']}:{principal['role']}".encode()
    return hashlib.sha256(raw).hexdigest()
