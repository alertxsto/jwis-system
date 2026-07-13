# -*- coding: utf-8 -*-
"""Unlicensed waste-collector detection (Case 1 illegal-activity requirement).

The DLH fleet plates form an authorized whitelist. Any vehicle observed doing
collection whose plate is not on the whitelist is flagged as an unlicensed
collector — the "illegal activity" the case statement asks to detect alongside
route deviation. The whitelist derives from the real DKI fleet plates.
"""
from __future__ import annotations

from typing import Any

from app.data import TRUCKS


def _normalize_plate(plate: str) -> str:
    return "".join(ch for ch in str(plate).upper() if ch.isalnum())


def _authorized_plates() -> set[str]:
    return {_normalize_plate(t["plate_number"]) for t in TRUCKS}


def check_vehicle(plate: str) -> dict[str, Any]:
    """Return authorization status for one observed plate."""
    authorized = _normalize_plate(plate) in _authorized_plates()
    return {
        "plate": plate,
        "authorized": authorized,
        "severity": "normal" if authorized else "critical",
        "reason": (
            "Registered DLH fleet vehicle."
            if authorized else
            "Plate not in DLH registry — possible unlicensed collector."
        ),
    }


def scan_observed_vehicles(observed: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag observed vehicles whose plate is not on the authorized whitelist.

    `observed` items carry plate + location. Returns one alert per unauthorized
    vehicle (authorized vehicles produce no alert).
    """
    alerts: list[dict[str, Any]] = []
    plates = _authorized_plates()
    for v in observed:
        if _normalize_plate(v.get("plate", "")) not in plates:
            alerts.append({
                "type": "unlicensed_collector",
                "plate": v.get("plate"),
                "lat": v.get("lat"),
                "lng": v.get("lng"),
                "severity": "critical",
                "message": f"Unlicensed collector {v.get('plate')} observed operating outside the DLH registry.",
                "data_class": "SIMULATED",
            })
    return alerts
