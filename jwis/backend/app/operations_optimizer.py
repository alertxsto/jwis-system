# -*- coding: utf-8 -*-
"""Integrated operations optimizer: connect Case 2 forecast demand to Case 1 fleet.

Given predicted per-area waste demand and the available fleet (capacity, vehicle
availability, permit compliance), produce a feasible dispatch plan. Uses OR-Tools
CP-SAT to assign trucks to demand areas so each area's collected tonnage meets
demand, respecting per-vehicle capacity and permit rules. Every assignment
carries evidence (capacity, permit) for auditability.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from ortools.sat.python import cp_model


@dataclass
class Vehicle:
    truck_code: str
    capacity_tons: float
    available: bool = True
    permit_compliant: bool = True


@dataclass
class Demand:
    area: str
    tons: float
    lat: float
    lng: float
    priority: int = 1


@dataclass
class Assignment:
    truck_code: str
    area: str
    assigned_tons: float
    evidence: dict[str, Any]


@dataclass
class OperationalPlan:
    plan_id: str
    assignments: list[Assignment] = field(default_factory=list)
    unmet_reasons: list[str] = field(default_factory=list)
    total_demand_tons: float = 0.0
    total_assigned_tons: float = 0.0


def build_operational_plan(demands: list[Demand], vehicles: list[Vehicle],
                           require_permit: bool = True) -> OperationalPlan:
    """Assign trucks to demand areas with CP-SAT, honoring capacity and permits.

    Each truck serves at most one area; an area may need several trucks. The
    solver maximizes weighted covered demand (by area priority). Returns an
    OperationalPlan with per-assignment evidence and reasons for any unmet demand.
    """
    plan_id = f"PLAN-{uuid4().hex[:8]}"
    usable = [v for v in vehicles if v.available and (v.permit_compliant or not require_permit)]

    plan = OperationalPlan(
        plan_id=plan_id,
        total_demand_tons=round(sum(d.tons for d in demands), 2),
    )
    if not usable:
        plan.unmet_reasons.append("no_permit_compliant_vehicle" if require_permit else "no_available_vehicle")
        return plan
    if not demands:
        return plan

    model = cp_model.CpModel()
    # x[v][d] = 1 if vehicle v assigned to demand area d.
    x: dict[tuple[int, int], Any] = {}
    for vi, _v in enumerate(usable):
        for di, _d in enumerate(demands):
            x[(vi, di)] = model.NewBoolVar(f"x_{vi}_{di}")

    # Each vehicle serves at most one area.
    for vi in range(len(usable)):
        model.Add(sum(x[(vi, di)] for di in range(len(demands))) <= 1)

    # Covered tons per area cannot exceed capacity assigned; track coverage.
    covered = []
    for di, d in enumerate(demands):
        cap_sum = sum(int(usable[vi].capacity_tons) * x[(vi, di)] for vi in range(len(usable)))
        c = model.NewIntVar(0, int(d.tons) + 1000, f"cov_{di}")
        model.Add(c <= cap_sum)
        model.Add(c <= int(round(d.tons)))
        covered.append(c)

    # Maximize weighted covered demand (priority-weighted).
    model.Maximize(sum(demands[di].priority * covered[di] for di in range(len(demands))))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        plan.unmet_reasons.append("no_feasible_assignment")
        return plan

    for vi, v in enumerate(usable):
        for di, d in enumerate(demands):
            if solver.Value(x[(vi, di)]) == 1:
                plan.assignments.append(Assignment(
                    truck_code=v.truck_code,
                    area=d.area,
                    assigned_tons=float(v.capacity_tons),
                    evidence={
                        "capacity_tons": v.capacity_tons,
                        "permit_compliant": v.permit_compliant,
                        "area_demand_tons": d.tons,
                        "area_priority": d.priority,
                    },
                ))

    plan.total_assigned_tons = round(sum(a.assigned_tons for a in plan.assignments), 2)
    for d in demands:
        got = sum(a.assigned_tons for a in plan.assignments if a.area == d.area)
        if got < d.tons:
            plan.unmet_reasons.append(f"insufficient_capacity:{d.area}")
    return plan
