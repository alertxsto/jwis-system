import React from "react";
import { Route } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

export function RouteEvidencePanel({ route }) {
  if (!route) return null;
  return (
    <section className="panel route-evidence-panel">
      <div className="panel-title">
        <div>
          <h2>OSRM Route Evidence</h2>
          <p>ETA and route geometry are fetched from OSRM public routing, with fallback for demo resilience.</p>
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
