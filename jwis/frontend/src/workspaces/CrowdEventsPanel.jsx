import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Calendar,
  Zap,
} from "lucide-react";

export function CrowdEventsPanel({ onSimulateEvent }) {
  const { lang } = useLanguage();
  const [events, setEvents] = useState([]);

  async function fetchEvents() {
    try {
      const res = await fetch(`${API_URL}/events/permits`);
      if (res.ok) setEvents(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <section className="panel events-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Izin Keramaian & Prediksi Sampah Event" : "Crowd Permit & Waste-Volume Forecast"}</h2>
          <p>{lang === "id" ? "Menghubungkan data perizinan acara publik dengan alokasi armada DLH." : "Connects public-event permit data with DLH logistics resource planning."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Calendar size={18} />
        </div>
      </div>

      <div className="events-list">
        {events.map((ev) => (
          <div className="event-item-card" key={ev.id}>
            <div className="event-header">
              <h3>{ev.name}</h3>
              <span className="permit">{ev.permit_number}</span>
            </div>
            <p className="location">{ev.location_name}</p>
            <div className="event-body">
              <div className="event-metric">
                <span>{lang === "id" ? "Prediksi Sampah" : "Waste Forecast"}</span>
                <strong>{ev.predicted_waste_tons} {lang === "id" ? "ton" : "tons"}</strong>
              </div>
              <div className="event-metric">
                <span>{lang === "id" ? "Kru Lapangan" : "Field Crews"}</span>
                <strong>{ev.crews_required} {lang === "id" ? "orang" : "people"} ({ev.man_hours_required} jam-kru)</strong>
              </div>
              <div className="event-metric">
                <span>{lang === "id" ? "Armada Cadangan" : "Backup Fleet"}</span>
                <strong>{ev.backup_trucks_required} {lang === "id" ? "truk" : "trucks"}</strong>
              </div>
              <div className="event-metric">
                <span>{lang === "id" ? "Tong Sampah Besar" : "Large Bins"}</span>
                <strong>{ev.large_bins_required} {lang === "id" ? "unit" : "units"}</strong>
              </div>
            </div>
            {onSimulateEvent && (
              <button className="primary-button event-simulate-button" onClick={() => onSimulateEvent(ev)}>
                <Zap size={14} /> {lang === "id" ? "Simulasikan Event di Optimizer" : "Simulate event in Optimizer"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
