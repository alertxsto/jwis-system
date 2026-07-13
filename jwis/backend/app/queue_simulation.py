# -*- coding: utf-8 -*-
"""Discrete-event simulation of the Bantargebang weighbridge queue.

Replaces the previous fixed 116->48 minute demo numbers with a seeded
multi-server queue (M/M/c style) whose outputs respond to arrival demand,
number of active weighbridges, and service rate. Every result is reproducible
from a seed and reports mean/P95 wait, max queue, throughput, utilization, and
a 95% confidence interval across replications.
"""
from __future__ import annotations

import heapq
import random
import statistics
from typing import Any

OPERATING_HOURS = 1.0  # peak arrival window (hours) where queueing forms


def _run_single(arrival_count: int, weighbridges: int, service_rate_per_hour: float,
                rng: random.Random) -> tuple[float, float, int]:
    """One replication. Returns (mean_wait_min, p95_wait_min, max_queue)."""
    mean_interarrival_h = OPERATING_HOURS / arrival_count
    mean_service_h = 1.0 / service_rate_per_hour

    # Generate Poisson arrivals via exponential interarrival times.
    arrivals: list[float] = []
    t = 0.0
    for _ in range(arrival_count):
        t += rng.expovariate(1.0 / mean_interarrival_h)
        arrivals.append(t)

    server_free_at = [0.0] * weighbridges
    waits: list[float] = []
    # Event-driven: each truck takes the earliest-free weighbridge.
    heapq.heapify(server_free_at)
    max_queue = 0
    completion_times: list[float] = []
    for arr in arrivals:
        free_at = heapq.heappop(server_free_at)
        start = max(arr, free_at)
        service = rng.expovariate(1.0 / mean_service_h)
        end = start + service
        waits.append((start - arr) * 60.0)  # minutes
        heapq.heappush(server_free_at, end)
        completion_times.append(end)
        # Queue length = arrivals so far not yet started service.
        waiting_now = sum(1 for c in completion_times if c > arr) - weighbridges
        max_queue = max(max_queue, max(0, waiting_now))

    mean_wait = statistics.fmean(waits) if waits else 0.0
    p95 = sorted(waits)[int(0.95 * (len(waits) - 1))] if waits else 0.0
    return mean_wait, p95, max_queue


def simulate_queue(arrival_count: int, weighbridges: int,
                   service_rate_per_hour: float, seed: int | None = None,
                   replications: int = 100) -> dict[str, Any]:
    """Seeded discrete-event queue simulation with replication intervals.

    Args:
        arrival_count: trucks arriving over the operating window.
        weighbridges: active parallel weighbridges (servers).
        service_rate_per_hour: trucks one weighbridge clears per hour.
        seed: base RNG seed for reproducibility.
        replications: number of seeded runs for confidence intervals.
    """
    if arrival_count < 0:
        raise ValueError("arrival_count must be non-negative")
    if weighbridges <= 0:
        raise ValueError("weighbridges must be positive")
    if service_rate_per_hour <= 0:
        raise ValueError("service_rate_per_hour must be positive")

    if arrival_count == 0:
        return {
            "mean_wait_minutes": 0.0, "p95_wait_minutes": 0.0, "max_queue": 0,
            "throughput_per_hour": weighbridges * service_rate_per_hour,
            "utilization": 0.0, "wait_ci95": [0.0, 0.0], "recommended_slots": 0,
            "replications": replications,
        }

    means, p95s, maxqs = [], [], []
    for i in range(replications):
        rng = random.Random((seed if seed is not None else 0) * 100000 + i)
        m, p, q = _run_single(arrival_count, weighbridges, service_rate_per_hour, rng)
        means.append(m); p95s.append(p); maxqs.append(q)

    mean_wait = statistics.fmean(means)
    stdev = statistics.pstdev(means)
    half = 1.96 * stdev / (len(means) ** 0.5)
    offered_load = (arrival_count / OPERATING_HOURS) / (weighbridges * service_rate_per_hour)

    return {
        "mean_wait_minutes": round(mean_wait, 1),
        "p95_wait_minutes": round(statistics.fmean(p95s), 1),
        "max_queue": round(statistics.fmean(maxqs)),
        "throughput_per_hour": round(weighbridges * service_rate_per_hour, 1),
        "utilization": round(offered_load, 3),
        "wait_ci95": [round(mean_wait - half, 1), round(mean_wait + half, 1)],
        "recommended_slots": max(0, round(arrival_count / max(1, weighbridges)) - weighbridges),
        "replications": replications,
    }
