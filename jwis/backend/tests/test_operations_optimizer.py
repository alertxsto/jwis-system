# -*- coding: utf-8 -*-
"""Tests for the integrated operations optimizer (Task 4)."""
import unittest

from app.operations_optimizer import Demand, Vehicle, build_operational_plan


def _vehicles(n=4):
    return [
        Vehicle(truck_code=f"T-{i:03d}", capacity_tons=18, available=True, permit_compliant=True)
        for i in range(1, n + 1)
    ]


def _demands():
    return [
        Demand(area="cengkareng", tons=50.0, lat=-6.15, lng=106.73, priority=3),
        Demand(area="tebet", tons=20.0, lat=-6.22, lng=106.85, priority=2),
        Demand(area="menteng", tons=8.0, lat=-6.19, lng=106.83, priority=1),
    ]


class OptimizerBasicTests(unittest.TestCase):
    def test_produces_assignments_for_demand(self):
        plan = build_operational_plan(_demands(), _vehicles(4))
        self.assertTrue(plan.assignments, "optimizer produced no assignments")
        for a in plan.assignments:
            self.assertIsNotNone(a.truck_code)
            self.assertIsNotNone(a.area)

    def test_respects_vehicle_capacity(self):
        # 50 tons at 18 t/truck needs >= 3 trucks for that area.
        plan = build_operational_plan(
            [Demand(area="cengkareng", tons=50.0, lat=-6.15, lng=106.73, priority=3)],
            _vehicles(4),
        )
        trucks_for_area = [a for a in plan.assignments if a.area == "cengkareng"]
        total_cap = sum(a.assigned_tons for a in trucks_for_area)
        self.assertGreaterEqual(total_cap, 50.0)

    def test_unavailable_vehicles_not_assigned(self):
        vehicles = _vehicles(4)
        vehicles[0].available = False
        plan = build_operational_plan(_demands(), vehicles)
        assigned_codes = {a.truck_code for a in plan.assignments}
        self.assertNotIn(vehicles[0].truck_code, assigned_codes)

    def test_non_permit_compliant_excluded(self):
        vehicles = _vehicles(4)
        for v in vehicles:
            v.permit_compliant = False
        plan = build_operational_plan(_demands(), vehicles, require_permit=True)
        self.assertEqual(plan.assignments, [])
        self.assertIn("no_permit_compliant_vehicle", plan.unmet_reasons)


class OptimizerHotspotTests(unittest.TestCase):
    def test_forecast_hotspot_triggers_dispatch(self):
        # A high-priority hotspot must receive at least one truck when capacity exists.
        plan = build_operational_plan(_demands(), _vehicles(6))
        hotspot = [a for a in plan.assignments if a.area == "cengkareng"]
        self.assertTrue(hotspot, "forecast hotspot did not trigger a dispatch")

    def test_plan_exposes_evidence(self):
        plan = build_operational_plan(_demands(), _vehicles(4))
        self.assertIsNotNone(plan.plan_id)
        for a in plan.assignments:
            self.assertIn("capacity_tons", a.evidence)
            self.assertIn("permit_compliant", a.evidence)


if __name__ == "__main__":
    unittest.main()
