import React from "react";
import { useLanguage } from "../i18n.jsx";
import { StatusPill } from "../ui/StatusPill.jsx";
import {
  Route,
} from "lucide-react";

export function RouteEvidencePanel({ route }) {
  const { lang } = useLanguage();
  if (!route) return null;
  return (
    <section className="panel route-evidence-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Bukti Rute OSRM" : "OSRM Route Evidence"}</h2>
          <p>{lang === "id" ? "Estimasi waktu dan geometri rute diambil dari routing publik OSRM." : "ETA and route geometry are fetched from OSRM public routing, with fallback for demo resilience."}</p>
        </div>
        <StatusPill tone={route.source === "osrm" ? "success" : "warning"}>{route.source}</StatusPill>
      </div>
      <div className="route-evidence-grid">
        <div>
          <span>{lang === "id" ? "Rekomendasi Rute" : "Recommended route"}</span>
          <strong>{route.name}</strong>
        </div>
        <div>
          <span>{lang === "id" ? "Estimasi Waktu" : "ETA"}</span>
          <strong>{route.eta_minutes} min</strong>
        </div>
        <div>
          <span>{lang === "id" ? "Jarak" : "Distance"}</span>
          <strong>{route.distance_km} km</strong>
        </div>
      </div>
      <p className="route-reason">{route.reason}</p>
    </section>
  );
}
