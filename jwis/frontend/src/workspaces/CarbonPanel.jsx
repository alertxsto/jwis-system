import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Leaf,
} from "lucide-react";

export function CarbonPanel() {
  const { lang } = useLanguage();
  const [carbon, setCarbon] = useState(null);

  useEffect(() => {
    const load = () => fetch(`${API_URL}/ai/carbon-live`)
      .then((r) => r.json())
      .then(setCarbon)
      .catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  if (!carbon || carbon.status === "no_data") {
    return (
      <section className="panel carbon-panel" id="carbon-panel">
        <div className="panel-title">
          <div>
            <h2>{lang === "id" ? "Pelacak Jejak Karbon Armada" : "Carbon Footprint Tracker"}</h2>
            <p>{lang === "id" ? "Emisi CO2 armada dan penghematan bahan bakar dari telemetri rute." : "Fleet CO2 emissions and fuel savings from route telemetry."}</p>
          </div>
          <div className="panel-header-icon-wrap">
            <Leaf size={18} />
          </div>
        </div>
        <div className="ai-feed-empty">Menunggu engine AI…</div>
      </section>
    );
  }

  return (
    <section className="panel carbon-panel" id="carbon-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Pelacak Jejak Karbon Armada" : "Carbon Footprint Tracker"}</h2>
          <p>{lang === "id" ? "Emisi CO2 armada dan penghematan bahan bakar dari telemetri rute." : "Fleet CO2 emissions and fuel savings from route telemetry."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Leaf size={18} />
        </div>
      </div>
      <div className="carbon-grid">
        <div className="carbon-stat">
          <span>{lang === "id" ? "Total Jarak" : "Total Distance"}</span>
          <strong>{carbon.total_distance_km.toFixed(1)} km</strong>
        </div>
        <div className="carbon-stat">
          <span>{lang === "id" ? "Bahan Bakar" : "Fuel"}</span>
          <strong>{carbon.fuel_l.toFixed(1)} L</strong>
        </div>
        <div className="carbon-stat">
          <span>CO₂</span>
          <strong>{carbon.co2_kg.toFixed(1)} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>{lang === "id" ? "Hemat vs Baseline" : "Saved vs Baseline"}</span>
          <strong style={{ color: "#15803d" }}>{carbon.fuel_saved_l.toFixed(1)} L</strong>
        </div>
      </div>
      {carbon.classification === "reference" && (
        <div className="carbon-badge">
          Reference factors (B35 2.68 kg/L) — bukan telemetri terukur
        </div>
      )}
    </section>
  );
}
