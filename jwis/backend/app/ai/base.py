"""Data source adapters for JWIS AI modules.

Detectors/forecasters never import app.gps_feed or app.data directly for
positions — they receive a GpsDataSource via constructor. Migrating to live
DLH GPS is an env var change, not a code change.
"""

from __future__ import annotations

import os
from typing import Protocol

from app import data as fleet_data
from app.gps_feed import GpsBreadcrumb, latest_breadcrumbs


class GpsDataSource(Protocol):
    def current_positions(self) -> list[dict]: ...
    def breadcrumbs(self, truck_code: str, points: int) -> list[GpsBreadcrumb]: ...


class SimulatedGpsSource:
    """Current state — wraps fleet simulation (data.py + gps_feed.py)."""

    def current_positions(self) -> list[dict]:
        return fleet_data.get_dynamic_trucks()

    def breadcrumbs(self, truck_code: str, points: int) -> list[GpsBreadcrumb]:
        return latest_breadcrumbs(truck_code, points=points)


class LiveGpsSource:
    """Future — live DLH GPS feed. Explicitly not implemented yet."""

    def current_positions(self) -> list[dict]:
        raise NotImplementedError(
            "LiveGpsSource requires the DLH live GPS feed integration; "
            "set JWIS_GPS_SOURCE=simulated until it is available."
        )

    def breadcrumbs(self, truck_code: str, points: int) -> list[GpsBreadcrumb]:
        raise NotImplementedError(
            "LiveGpsSource requires the DLH live GPS feed integration; "
            "set JWIS_GPS_SOURCE=simulated until it is available."
        )


def get_gps_source() -> GpsDataSource:
    if os.getenv("JWIS_GPS_SOURCE", "simulated").lower() == "live":
        return LiveGpsSource()
    return SimulatedGpsSource()
