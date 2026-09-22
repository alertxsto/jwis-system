import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import {
  Route,
  Truck,
} from "lucide-react";

export const fallbackSnapshot = {
  kpis: {
    active_trucks: 5,
    trucks_with_issues: 2,
    tpa_queue_trucks: 47,
    tpa_wait_minutes: 116,
    predicted_spike_percent: 41,
    pending_dispatches: 0,
  },
  tpa_queue: {
    status: "red",
    trucks_waiting: 47,
    estimated_wait_minutes: 116,
    throughput_trucks_per_hour: 31,
    recommendation: "Delay non-critical departures by 45 minutes and prioritize West Jakarta event waste.",
  },
  trucks: [
    {
      truck_code: "T-001",
      plate_number: "B 1234 CD",
      driver_name: "Budi Santoso",
      assigned_zone: "Jakarta Utara",
      status: "active",
      is_damaged: false,
      latest_position: { lat: -6.151, lng: 106.841, speed_kmh: 34, updated_seconds_ago: 24 },
      assigned_path: [{ lat: -6.132, lng: 106.826 }, { lat: -6.145, lng: 106.835 }, { lat: -6.158, lng: 106.848 }],
      deviation: { violated: false, distance_meters: 220, severity: "normal" },
    },
    {
      truck_code: "T-047",
      plate_number: "B 5678 EF",
      driver_name: "Agus Pratama",
      assigned_zone: "Jakarta Barat",
      status: "deviation",
      is_damaged: false,
      latest_position: { lat: -6.221, lng: 106.785, speed_kmh: 18, updated_seconds_ago: 24 },
      assigned_path: [{ lat: -6.172, lng: 106.764 }, { lat: -6.181, lng: 106.781 }, { lat: -6.195, lng: 106.802 }],
      deviation: { violated: true, distance_meters: 2924, severity: "critical" },
    },
    {
      truck_code: "T-112",
      plate_number: "B 4410 KL",
      driver_name: "Rizky Maulana",
      assigned_zone: "Jakarta Timur",
      status: "active",
      is_damaged: true,
      latest_position: { lat: -6.211, lng: 106.874, speed_kmh: 23, updated_seconds_ago: 24 },
      assigned_path: [{ lat: -6.229, lng: 106.9 }, { lat: -6.218, lng: 106.883 }, { lat: -6.205, lng: 106.865 }],
      deviation: { violated: false, distance_meters: 331, severity: "normal" },
    },
  ],
  alerts: [
    {
      id: "ALT-T-047",
      type: "route_deviation",
      severity: "critical",
      truck_code: "T-047",
      title: "T-047 deviated from assigned corridor",
      description: "Truck is 2924 meters from the assigned corridor.",
      recommended_routes: [
        {
          name: "Route B - Daan Mogot Recovery",
          eta_minutes: 48,
          score: 39.0,
          reason: "recommended because it is permit-compliant, has the lowest combined ETA/traffic/flood risk score",
        },
      ],
      status: "active",
    },
  ],
  critical_predictions: [
    {
      district: "Jakarta Barat",
      date: "2026-06-01",
      predicted_tons: 3136.7,
      spike_percent: 41,
      risk_level: "critical",
      recommended_extra_trucks: 29,
      recommended_extra_crews: 14,
      factors: [
        "Heavy rainfall adds flood-related waste and slows collection (+16%).",
        "Large permitted event increases waste around crowded areas (+18%).",
        "Weekend activity raises commercial and public-space waste (+7%).",
      ],
    },
  ],
  predictions: [
    { district: "CENGKARENG", date: "2026-06-01", predicted_tons: 489.4, spike_percent: 41, risk_level: "critical", recommended_extra_trucks: 27, recommended_extra_crews: 28 },
    { district: "CILINCING", date: "2026-06-01", predicted_tons: 443.1, spike_percent: 36, risk_level: "high", recommended_extra_trucks: 25, recommended_extra_crews: 25 },
    { district: "CAKUNG", date: "2026-06-01", predicted_tons: 426.6, spike_percent: 33, risk_level: "high", recommended_extra_trucks: 24, recommended_extra_crews: 24 },
    { district: "TANJUNG PRIOK", date: "2026-06-01", predicted_tons: 399.5, spike_percent: 31, risk_level: "high", recommended_extra_trucks: 22, recommended_extra_crews: 23 },
    { district: "KALI DERES", date: "2026-06-01", predicted_tons: 380.2, spike_percent: 29, risk_level: "high", recommended_extra_trucks: 21, recommended_extra_crews: 22 },
    { district: "DUREN SAWIT", date: "2026-06-01", predicted_tons: 354.2, spike_percent: 27, risk_level: "high", recommended_extra_trucks: 20, recommended_extra_crews: 20 },
  ],
  osrm_route: {
    name: "Route B - Daan Mogot Recovery",
    source: "fallback",
    eta_minutes: 48,
    distance_km: 18.2,
    reason: "fallback route used when OSRM public service is unavailable",
  },
  weather: {
    source: "fallback-demo",
    location: "Jakarta, Indonesia",
    forecast: [
      {
        date: "2026-06-01",
        temperature_max_c: 31.2,
        temperature_min_c: 24.8,
        rainfall_mm: 42,
        precipitation_probability: 91,
        wind_speed_kmh: 17.1,
        risk_level: "critical",
        waste_impact_percent: 22,
        operational_advice: "Delay low-priority departures, protect flood-prone TPS routes, and prepare backup crews.",
      },
      {
        date: "2026-06-02",
        temperature_max_c: 30.4,
        temperature_min_c: 24.1,
        rainfall_mm: 18.5,
        precipitation_probability: 68,
        wind_speed_kmh: 14.2,
        risk_level: "watch",
        waste_impact_percent: 11,
        operational_advice: "Monitor rain bands and keep dispatch timing flexible.",
      },
    ],
  },
  dispatches: [],
  executive_summary: {
    headline: "West Jakarta requires immediate capacity reinforcement within 48 hours.",
    points: [
      "Largest forecasted spike is driven by heavy rainfall, a large permitted event, and weekend activity.",
      "T-047 is outside the assigned corridor and should be redirected through Route B.",
      "TPA Bantargebang queue is above the operational threshold; dispatch timing should be staggered.",
      "Recommended action: add 28 trucks and 14 crews across high-risk districts for the next two days.",
    ],
  },
};

export function normalizeCommandSnapshot(rawSnapshot) {
  const merged = {
    ...fallbackSnapshot,
    ...(rawSnapshot || {}),
    kpis: { ...fallbackSnapshot.kpis, ...(rawSnapshot?.kpis || {}) },
    tpa_queue: { ...fallbackSnapshot.tpa_queue, ...(rawSnapshot?.tpa_queue || {}) },
    weather: {
      ...fallbackSnapshot.weather,
      ...(rawSnapshot?.weather || {}),
      forecast: rawSnapshot?.weather?.forecast?.length
        ? rawSnapshot.weather.forecast
        : fallbackSnapshot.weather.forecast,
    },
    osrm_route: rawSnapshot?.osrm_route || fallbackSnapshot.osrm_route,
  };

  const predictions = Array.isArray(merged.predictions) && merged.predictions.length
    ? merged.predictions
    : fallbackSnapshot.critical_predictions;
  const criticalPredictions = Array.isArray(merged.critical_predictions) && merged.critical_predictions.length
    ? merged.critical_predictions
    : predictions
      .filter((item) => ["critical", "high"].includes(item.risk_level))
      .sort((a, b) => (b.spike_percent || 0) - (a.spike_percent || 0))
      .slice(0, 8);

  merged.predictions = predictions;
  merged.critical_predictions = criticalPredictions.length ? criticalPredictions : fallbackSnapshot.critical_predictions;
  return merged;
}

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState(() => normalizeCommandSnapshot(fallbackSnapshot));
  const [online, setOnline] = useState(false);

  async function load() {
    // Necessary: 15s cap covers the server's cold-start command-center build
    // (~10s: weather fetch + per-truck snap/reroute) while still preventing an
    // unbounded fetch from hanging the UI (and the e2e fetch-settle checks).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_URL}/command-center`, { signal: controller.signal });
      if (!response.ok) throw new Error("API unavailable");
      setSnapshot(normalizeCommandSnapshot(await response.json()));
      setOnline(true);
    } catch {
      setSnapshot(normalizeCommandSnapshot(fallbackSnapshot));
      setOnline(false);
    } finally {
      clearTimeout(timer);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  return { snapshot, online, refresh: load };
}
