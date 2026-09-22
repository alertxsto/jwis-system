import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  MapPinned,
  Search,
} from "lucide-react";

export function KecamatanMapPanel({ horizon = "7d" }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [rain, setRain] = useState(0);
  const [attendance, setAttendance] = useState(0);
  const [weekend, setWeekend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const horizonDays = Math.max(2, Math.min(30, parseInt(horizon, 10) || 7));

  async function load() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rain),
        event_attendance: String(attendance),
        is_weekend: String(weekend),
        horizon_days: String(horizonDays),
      });
      const res = await fetch(`${API_URL}/predictions/kecamatan?${params.toString()}`, { signal: controller.signal });
      setData(await res.json());
    } catch (e) {
      setData(null);
    } finally {
      clearTimeout(timer);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [horizonDays]);

  const rows = data?.kecamatan || [];
  const maxTons = rows.length ? rows[0].predicted_tons : 1;
  const readinessColor = {
    sufficient: "#16a34a",
    tight: "#d97706",
    under_capacity: "#dc2626",
    unknown: "#64748b",
  };

  const filteredRows = rows.filter((k) => {
    const matchesSearch = k.kecamatan.toLowerCase().includes(search.toLowerCase());
    const matchesCity = cityFilter ? k.city === cityFilter : true;
    return matchesSearch && matchesCity;
  });

  const displayedRows = showAll ? filteredRows : filteredRows.slice(0, 8);
  const selectedKec = rows.find((r) => r.slug === selectedSlug);

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Prakiraan Timbulan Sampah 42 Kecamatan" : "District Waste Forecast"}</h2>
          <p>
            {lang === "id"
              ? `Model hybrid Prophet+XGBoost untuk ${data?.kecamatan_count || 42} kecamatan DKI, terkalibrasi data riil SILIKA DLH 2023. Total estimasi:`
              : `Hybrid Prophet+XGBoost forecast for ${data?.kecamatan_count || 42} DKI districts, anchored to official SILIKA DLH 2023 baseline. Total forecast:`}{" "}
            <b>{data?.total_predicted_tons?.toLocaleString(lang === "id" ? "id-ID" : "en-US") || "..."} {lang === "id" ? "ton/hari" : "tons/day"}</b>.
          </p>
        </div>
        <div className="panel-header-icon-wrap">
          <MapPinned size={18} />
        </div>
      </div>

      <div className="scenario-controls">
        <label>Rainfall (mm): <b>{rain}</b>
          <input type="range" min="0" max="60" value={rain} onChange={(e) => setRain(+e.target.value)} />
        </label>
        <label>Event attendance: <b>{attendance.toLocaleString("en-US")}</b>
          <input type="range" min="0" max="200000" step="5000" value={attendance} onChange={(e) => setAttendance(+e.target.value)} />
        </label>
        <label className="scenario-check">
          <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} /> Weekend
        </label>
        <button className="primary-button" onClick={load} disabled={loading}>
          {loading ? "Calculating..." : "Recalculate forecast"}
        </button>
      </div>

      <div className="forecast-filter-bar">
        <input 
          type="text" 
          placeholder="Search district..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="search-input" 
          aria-label="Search district"
        />
        <select 
          value={cityFilter} 
          onChange={(e) => setCityFilter(e.target.value)} 
          className="city-select" 
          aria-label="Filter city"
        >
          <option value="">All cities</option>
          <option value="Jakarta Pusat">Jakarta Pusat</option>
          <option value="Jakarta Barat">Jakarta Barat</option>
          <option value="Jakarta Selatan">Jakarta Selatan</option>
          <option value="Jakarta Timur">Jakarta Timur</option>
          <option value="Jakarta Utara">Jakarta Utara</option>
        </select>
      </div>

      {selectedKec && (
        <div className="kec-details-panel">
          <div className="kec-details-panel-title">
            <div>
              <h3>Analysis details: {selectedKec.kecamatan} ({selectedKec.city})</h3>
              <p>Model: Prophet + XGBoost Hybrid ({selectedKec.model_available ? "Active" : "Unavailable"})</p>
            </div>
            <button className="text-button" onClick={() => setSelectedSlug(null)}>Close</button>
          </div>
          
          <div className="kec-details-grid">
            <div className="kec-details-section">
              <h4>Forecast components</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Seasonal baseline (Prophet):</span>
                  <b>{selectedKec.prophet_baseline_tons ? `${selectedKec.prophet_baseline_tons.toLocaleString("en-US")} tons` : "..."}</b>
                </li>
                <li className="kec-details-item">
                  <span>Dynamic correction (XGBoost):</span>
                  <b style={{ color: selectedKec.xgboost_residual > 0 ? "#ea580c" : "#64748b" }}>
                    {selectedKec.xgboost_residual > 0 ? `+${selectedKec.xgboost_residual.toLocaleString("en-US")}` : (selectedKec.xgboost_residual || 0)} tons
                  </b>
                </li>
                <li className="kec-details-item-total">
                  <span>Total daily forecast:</span>
                  <span>{selectedKec.predicted_tons ? `${selectedKec.predicted_tons.toLocaleString("en-US")} tons` : "..."}</span>
                </li>
              </ul>
            </div>
            
            <div className="kec-details-section">
              <h4>Uncertainty & carbon impact</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Confidence range (P10-P90):</span>
                  <b>{selectedKec.prediction_interval_p10_p90 ? `${selectedKec.prediction_interval_p10_p90[0].toLocaleString("en-US")} - ${selectedKec.prediction_interval_p10_p90[1].toLocaleString("en-US")} tons` : "..."}</b>
                </li>
                <li className="kec-details-item">
                  <span>Fleet diesel use:</span>
                  <b>{selectedKec.fuel_consumption_liters ? `${selectedKec.fuel_consumption_liters.toLocaleString("en-US")} liters` : "..."}</b>
                </li>
                <li className="kec-details-item">
                  <span>Carbon footprint (CO2):</span>
                  <b>{selectedKec.co2_emissions_kg ? `${selectedKec.co2_emissions_kg.toLocaleString("en-US")} kg` : "..."}</b>
                </li>
              </ul>
            </div>

            <div className="kec-details-section">
              <h4>Operational and facility needs</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Collection trucks:</span>
                  <b>{selectedKec.trucks_required} units</b>
                </li>
                <li className="kec-details-item">
                  <span>Required field crews:</span>
                  <b>{selectedKec.crews_required} people</b>
                </li>
                <li className="kec-details-item">
                  <span>Total work hours:</span>
                  <b>{selectedKec.man_hours_required} hours</b>
                </li>
                <li className="kec-details-item">
                  <span>Large waste bins:</span>
                  <b>{selectedKec.disposal_bins_required || 0} units</b>
                </li>
                <li className="kec-details-item-total">
                  <span>TPS status:</span>
                  <span className={selectedKec.facility_over_capacity ? "status-overcapacity" : "status-normal"}>
                    {selectedKec.facility_over_capacity ? "Warning: OVER-CAPACITY" : "NORMAL (OK)"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
          
          {Array.isArray(selectedKec.daily_series) && selectedKec.daily_series.length > 1 && (
            <div className="kec-series" data-testid="kec-daily-series">
              <h4>Daily series — next {selectedKec.daily_series.length} days (live model)</h4>
              <div className="kec-series-chart" role="img" aria-label={`Daily forecast series for ${selectedKec.kecamatan}`}>
                {selectedKec.daily_series.map((d) => {
                  const max = Math.max(...selectedKec.daily_series.map((x) => x.predicted_tons), 1);
                  const pct = Math.max(4, Math.round((d.predicted_tons / max) * 100));
                  return (
                    <div key={d.date} className={`kec-series-bar${d.is_weekend ? " weekend" : ""}${d.is_holiday ? " holiday" : ""}`}
                      title={`${d.date}: ${d.predicted_tons} t${d.is_weekend ? " (weekend)" : ""}${d.is_holiday ? " (holiday)" : ""}`}>
                      <span style={{ height: `${pct}%` }} />
                      <small>{d.date.slice(5)}</small>
                    </div>
                  );
                })}
              </div>
              <p className="kec-series-note">
                Peak {selectedKec.horizon_peak_date}: {Math.round(selectedKec.horizon_peak_tons)} t ·
                Horizon total {Math.round(selectedKec.horizon_total_tons).toLocaleString("en-US")} t.
                Weekend/holiday bars are highlighted; weather scenario held constant.
              </p>
            </div>
          )}

          {selectedKec.factor_attribution && (
            <div className="kec-attribution" data-testid="kec-attribution">
              <h4>Driver attribution (tons, leave-one-out on residual model)</h4>
              <div className="kec-attribution-grid">
                {[
                  ["Prophet baseline", selectedKec.factor_attribution.prophet_baseline_tons],
                  ["Rainfall", selectedKec.factor_attribution.rainfall_tons],
                  ["Event crowd", selectedKec.factor_attribution.event_tons],
                  ["Weekend", selectedKec.factor_attribution.weekend_tons],
                  ["Holiday", selectedKec.factor_attribution.holiday_tons],
                ].map(([label, val]) => (
                  <div key={label} className="kec-attribution-item">
                    <span>{label}</span>
                    <b style={{ color: val > 0 ? "#ea580c" : "var(--ui-muted)" }}>
                      {val > 0 ? `+${Number(val).toLocaleString("en-US")}` : Number(val || 0).toLocaleString("en-US")} t
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedKec.factors && selectedKec.factors.length > 0 && (
            <div className="kec-details-drivers">
              <h4>Spike drivers</h4>
              {selectedKec.factors.map((f, i) => (
                <div key={i} className="kec-driver-item">
                  <span className="kec-driver-bullet">-</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="kec-list">
        {displayedRows.map((k) => (
          <article 
            className={`kec-row${selectedSlug === k.slug ? " active" : ""}`} 
            key={k.slug}
            onClick={() => setSelectedSlug(selectedSlug === k.slug ? null : k.slug)}
          >
            <div className="kec-head">
              <strong>{k.kecamatan}</strong>
              <span>{k.city}</span>
            </div>
            <div className="bar" aria-label={`${k.predicted_tons} tons`}>
              <span style={{ width: `${Math.min(100, (k.predicted_tons / maxTons) * 100)}%` }} />
            </div>
            <div className="kec-meta">
              <b>{k.predicted_tons.toLocaleString("en-US")} t</b>
              <span>{k.trucks_required} trucks / {k.crews_required} crews / {k.man_hours_required} m-hr</span>
              {k.horizon_total_tons != null && (
                <span className="kec-horizon">
                  {horizonDays}d total {Math.round(k.horizon_total_tons).toLocaleString("en-US")} t · peak {k.horizon_peak_date} ({Math.round(k.horizon_peak_tons)} t)
                </span>
              )}
              <span className="kec-facility" style={{ color: readinessColor[k.facility_readiness] }}>
                {k.facility_over_capacity ? "Warning: TPS over-capacity" : "TPS " + k.facility_readiness}
              </span>
            </div>
          </article>
        ))}
      </div>

      {filteredRows.length > 8 && (
        <button 
          className="text-button show-more-btn" 
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Show fewer (Top 8)" : `Show all (${filteredRows.length} districts)`}
        </button>
      )}
      <p className="kec-note">
        Showing the top 8 hotspots from {rows.length} districts. Baseline and location data use SILIKA DLH 2023;
        daily resolution is calibrated-synthetic and anchored to real public data.
      </p>
    </section>
  );
}
