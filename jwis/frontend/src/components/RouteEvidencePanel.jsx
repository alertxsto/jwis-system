import React from "react";
import { Route } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

export function RouteEvidencePanel({ route }) {
  if (!route) {
    return (
      <section className="panel route-evidence-panel">
        <div className="panel-title">
          <div>
            <h2>Route evidence</h2>
            <p>ETA and geometry are fetched from OSRM public routing, with a labelled fallback for demo resilience.</p>
          </div>
        </div>
        <p className="panel-state" role="status">
          No route evidence yet. Select a truck on the map, or wait for the routing
          service to return a recommendation.
        </p>
      </section>
    );
  }

  return (
    <section className="panel route-evidence-panel">
      <div className="panel-title">
        <div>
          <h2>Route evidence</h2>
          <p>ETA and route geometry are fetched from OSRM public routing, with a labelled fallback for demo resilience.</p>
        </div>
        <StatusPill tone={route.source === "osrm" ? "success" : "warning"}>{route.source}</StatusPill>
      </div>
      <div className="route-evidence-grid">
        <div>
          <span>Recommended route</span>
          <strong>{route.name}</strong>
        </div>
        <div>
          <span>ETA</span>
          <strong>{route.eta_minutes} min</strong>
        </div>
        <div>
          <span>Distance</span>
          <strong>{route.distance_km} km</strong>
        </div>
      </div>
      <p className="route-reason">{route.reason}</p>
    </section>
  );
}
