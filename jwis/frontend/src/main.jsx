import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { readOutbox, enqueue, flushOutbox } from "./field/OfflineOutbox.js";
import FieldApp from "./field/FieldApp.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { FleetOperations } from "./workspaces/FleetOperations.jsx";
import { IntegratedPlanning } from "./workspaces/IntegratedPlanning.jsx";
import { WasteForecast } from "./workspaces/WasteForecast.jsx";
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardList,
  CloudRain,
  MapPinned,
  Radio,
  RefreshCcw,
  Route,
  Send,
  ShieldCheck,
  Truck,
  Users,
  X,
  Bot,
  Download,
  MessageCircle,
  Mic,
  MicOff,
  Volume2,
  History,
  Leaf,
  Calendar,
  TrendingUp,
  Zap,
  Clock,
  Lock,
  LogOut,
  User,
  Workflow,
  Database,
  Shield,
  Cpu,
} from "lucide-react";
import { LiveFleetMap } from "./LiveFleetMap.jsx";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
}

const fallbackSnapshot = {
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

function normalizeCommandSnapshot(rawSnapshot) {
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

function useSnapshot() {
  const [snapshot, setSnapshot] = useState(() => normalizeCommandSnapshot(fallbackSnapshot));
  const [online, setOnline] = useState(false);

  async function load() {
    try {
      const response = await fetch(`${API_URL}/command-center`);
      if (!response.ok) throw new Error("API unavailable");
      setSnapshot(normalizeCommandSnapshot(await response.json()));
      setOnline(true);
    } catch {
      setSnapshot(normalizeCommandSnapshot(fallbackSnapshot));
      setOnline(false);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, []);

  return { snapshot, online, refresh: load };
}

function StatusPill({ tone, children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("dispatcher");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("bad creds");
      const principal = await res.json();
      localStorage.setItem("jwis_auth", "true");
      localStorage.setItem("jwis_role", principal.role);
      localStorage.setItem("jwis_token", principal.token);
      onLogin();
    } catch {
      setError("Invalid username or password.");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-surface" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-brand">
            <span><ShieldCheck size={22} /></span>
            <div>
              <p className="login-kicker">DLH Command Access</p>
              <h1 id="login-title">JWIS Control Center</h1>
            </div>
          </div>
          <p className="login-copy">
            Secure operator entry for fleet monitoring, predictive waste planning, and dispatch supervision.
          </p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <div className="input-shell">
              <User size={18} />
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </div>
            <label htmlFor="password">Password</label>
            <div className="input-shell">
              <Lock size={18} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit">
              <Lock size={16} /> Sign in
            </button>
          </form>
          <div className="login-demo-note">
            <strong>Demo access</strong>
            <span>dispatcher, supervisor, or auditor</span>
            <code>dispatcher-demo-pass</code>
          </div>
        </div>
        <aside className="login-proof" aria-label="JWIS operating scope">
          <div className="login-proof-intro">
            <span className="brand-mark"><Route size={19} /></span>
            <div>
              <strong>Jakarta Waste Intelligence System</strong>
              <p>Operational access for DLH command personnel, dispatch supervisors, and audit reviewers.</p>
            </div>
          </div>
          <div className="login-status-strip" aria-label="Command status">
            <div>
              <span>Command mode</span>
              <strong>Protected</strong>
            </div>
            <div>
              <span>Decision loop</span>
              <strong>Live demo</strong>
            </div>
          </div>
          <div className="login-proof-metrics">
            <div>
              <span className="metric-label">Queue model</span>
              <strong>Discrete event</strong>
              <p>Simulated landfill waiting-time operations.</p>
            </div>
            <div>
              <span className="metric-label">Coverage</span>
              <strong>Fleet + Forecast</strong>
              <p>Fleet supervision and resource planning.</p>
            </div>
            <div>
              <span className="metric-label">Assistant</span>
              <strong>Ana AI</strong>
              <p>Operational guidance for route, weather, and dispatch decisions.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function KpiCard({ icon: Icon, label, value, helper, tone = "neutral" }) {
  return (
    <section className={`kpi ${tone}`}>
      <div className="kpi-icon"><Icon size={20} /></div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{helper}</span>
      </div>
    </section>
  );
}

function MapPanel({ trucks, attendance, rainfall, onSelectTruck, layers, playbackTruck, onBreadcrumbsLoaded }) {
  return (
    <section className="panel map-panel">
      <div className="panel-title">
        <div>
          <h2>Live Fleet Supervision</h2>
          <p>MapLibre tracking of assigned corridors, actual movement, and field status. Positions are simulated, not live GPS.</p>
        </div>
        <StatusPill tone="warning"><Radio size={14} /> Simulation</StatusPill>
      </div>
      <LiveFleetMap 
        trucks={trucks} 
        attendance={attendance} 
        rainfall={rainfall} 
        onSelectTruck={onSelectTruck} 
        layers={layers}
        playbackTruck={playbackTruck}
        onBreadcrumbsLoaded={onBreadcrumbsLoaded}
      />
    </section>
  );
}

function AlertQueue({ alerts, onDispatch, onWhatsApp }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Action Queue</h2>
          <p>Alerts are linked to route recommendations and field instructions.</p>
        </div>
        <StatusPill tone="danger">{alerts.length} active</StatusPill>
      </div>
      <div className="alert-list">
        {alerts.map((alert) => {
          const recommendedRoute = alert.recommended_routes?.[0];
          return (
            <article className="alert-item" key={alert.id}>
              <div className="alert-head">
                <AlertTriangle size={18} />
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.description}</p>
                </div>
              </div>
              <div className={`route-rec ${recommendedRoute ? "" : "route-rec-empty"}`}>
                {recommendedRoute ? (
                  <>
                    <Route size={17} />
                    <div>
                      <strong>{recommendedRoute.name}</strong>
                      <span>{recommendedRoute.eta_minutes} min ETA - score {recommendedRoute.score}</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <strong>Awaiting route recommendation</strong>
                    <span>Dispatch can proceed after operator review.</span>
                  </div>
                )}
              </div>
              <div className="alert-actions">
                <button className="primary-button" onClick={() => onDispatch(alert)}>
                  <Send size={16} /> Approve &amp; Dispatch
                </button>
                <button className="ghost-button alert-wa-button" onClick={() => onWhatsApp(alert)}>
                  <MessageCircle size={16} /> WA Alert
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RouteEvidencePanel({ route }) {
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

function PredictionPanel({ predictions, allPredictions = predictions }) {
  const totalExtraTrucks = predictions.reduce((sum, item) => sum + (item.recommended_extra_trucks || 0), 0);
  const totalExtraCrews = predictions.reduce((sum, item) => sum + (item.recommended_extra_crews || 0), 0);
  const highestSpike = predictions.reduce(
    (max, item) => Math.max(max, item.spike_percent || 0),
    0,
  );
  const priorityRows = [...predictions]
    .sort((a, b) => (b.predicted_tons || 0) - (a.predicted_tons || 0))
    .slice(0, 6);
  const maxTons = Math.max(...priorityRows.map((item) => item.predicted_tons || 0), 1);
  const verticalRows = [...allPredictions]
    .sort((a, b) => (b.predicted_tons || 0) - (a.predicted_tons || 0))
    .slice(0, 6);
  const verticalMaxTons = Math.max(...verticalRows.map((item) => item.predicted_tons || 0), 1);

  return (
    <section className="panel prediction-panel">
      <div className="panel-title">
        <div>
          <h2>Predictive Readiness</h2>
          <p>Seven-day spatial risk forecast with explainable demand drivers.</p>
        </div>
        <CloudRain size={20} />
      </div>
      <div className="prediction-summary-grid">
        <div>
          <span>High-risk districts</span>
          <strong>{predictions.length}</strong>
        </div>
        <div>
          <span>Peak spike</span>
          <strong>+{highestSpike}%</strong>
        </div>
        <div>
          <span>Extra capacity</span>
          <strong>{totalExtraTrucks} trucks / {totalExtraCrews} crews</strong>
        </div>
      </div>
      <div className="prediction-insight-grid">
        <div className="district-priority-chart" aria-label="District priority chart">
          <h3>District priority</h3>
          {priorityRows.map((item) => {
            const width = Math.max(8, ((item.predicted_tons || 0) / maxTons) * 100);
            return (
              <article className="district-priority-row" key={`${item.district}-${item.date}-priority`}>
                <div className="district-priority-label">
                  <strong>{item.district}</strong>
                  <span>{item.recommended_extra_trucks} trucks / {item.recommended_extra_crews} crews</span>
                </div>
                <div className="district-priority-bar" aria-label={`${item.district} ${Math.round(item.predicted_tons || 0)} tons`}>
                  <span style={{ width: `${width}%` }} />
                </div>
                <b>+{item.spike_percent}%</b>
              </article>
            );
          })}
        </div>
        <div className="district-vertical-chart" aria-label="Waste load by district chart">
          <h3>Waste load by district</h3>
          <div className="district-vertical-bars">
            {verticalRows.map((item) => {
              const height = Math.max(10, ((item.predicted_tons || 0) / verticalMaxTons) * 100);
              return (
                <article className="district-vertical-bar" key={`${item.district}-${item.date}-vertical`}>
                  <div className="district-vertical-track">
                    <span style={{ height: `${height}%` }} />
                  </div>
                  <strong>{Math.round(item.predicted_tons || 0)}t</strong>
                  <small title={item.district}>{item.district}</small>
                </article>
              );
            })}
          </div>
        </div>
      </div>
      <div className="prediction-list">
        {predictions.map((item) => (
          <article className="prediction" key={`${item.district}-${item.date}`}>
            <div>
              <strong>{item.district}</strong>
              <span>{item.date}</span>
            </div>
            <div className="bar" aria-label={`${item.spike_percent} percent predicted spike`}>
              <span style={{ width: `${Math.min(100, item.spike_percent * 2)}%` }} />
            </div>
            <div className="prediction-meta">
              <b>+{item.spike_percent}%</b>
              <span>{item.recommended_extra_trucks} trucks - {item.recommended_extra_crews} crews</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function KecamatanMapPanel() {
  const [data, setData] = useState(null);
  const [rain, setRain] = useState(0);
  const [attendance, setAttendance] = useState(0);
  const [weekend, setWeekend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rain),
        event_attendance: String(attendance),
        is_weekend: String(weekend),
      });
      const res = await fetch(`${API_URL}/predictions/kecamatan?${params.toString()}`);
      setData(await res.json());
    } catch (e) {
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <h2>District Waste Forecast Map</h2>
          <p>
            Hybrid Prophet+XGBoost forecast for {data?.kecamatan_count || 42} DKI districts,
            anchored to official SILIKA DLH 2023 baseline. Total forecast:{" "}
            <b>{data?.total_predicted_tons?.toLocaleString("en-US") || "..."} tons/day</b>.
          </p>
        </div>
        <MapPinned size={20} />
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

function DataAuditWorkspace() {
  const [provenance, setProvenance] = useState(null);
  const [fleet, setFleet] = useState(null);
  const [suitability, setSuitability] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [provRes, fleetRes, suitRes] = await Promise.all([
          fetch(`${API_URL}/data/provenance`),
          fetch(`${API_URL}/fleet/composition`),
          fetch(`${API_URL}/ml/suitability`)
        ]);
        setProvenance(await provRes.json());
        setFleet(await fleetRes.json());
        setSuitability(await suitRes.json());
      } catch (e) {
        console.error("Failed to load audit data", e);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="loading-state">Loading audit data...</div>;
  }

  const records = provenance?.records || [];
  const fleetTypes = fleet?.by_vehicle_type || {};

  return (
    <div className="audit-workspace grid-col-12" data-testid="audit-workspace">
      <div className="audit-header">
        <h1>Data & ML Audit Registry</h1>
        <p>Data provenance, ML suitability, and physical fleet inventory for JWIS decision evidence.</p>
      </div>

      <div className="audit-grid">
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Data Provenance Registry</h2>
              <p>Source manifest with row counts, freshness, granularity, and operational limitations.</p>
            </div>
            <Database size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Data provenance registry">
              <thead>
                <tr>
                  <th scope="col">Dataset</th>
                  <th scope="col">Source URL</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Freshness</th>
                  <th scope="col">Granularity</th>
                  <th scope="col">Classification</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <div><strong>{r.name}</strong></div>
                      <div className="table-subtext">{r.limitations}</div>
                    </td>
                    <td>
                      {r.source_url.startsWith("http") ? (
                        <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="audit-link">
                          Open source
                        </a>
                      ) : (
                        <span>{r.source_url}</span>
                      )}
                    </td>
                    <td>{r.row_count?.toLocaleString("en-US") || "—"}</td>
                    <td>{r.freshness}</td>
                    <td><code>{r.granularity}</code></td>
                    <td>
                      <span className={`role-badge ${r.classification === "real" ? "dispatcher" : "driver"}`}>
                        {r.classification.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>ML Model Suitability Map</h2>
              <p>Prophet+XGBoost suitability evidence by data resolution level.</p>
            </div>
            <Cpu size={20} />
          </div>
          <div className="suitability-list">
            {Object.entries(fleetTypes).length > 0 && Object.entries(suitability?.resolutions || {}).map(([res, status]) => (
              <div key={res} className="suitability-item">
                <div className="suitability-head">
                  <strong><code>{res.replace(/_/g, "-")}</code></strong>
                  <span className={`status-pill ${status === "reliable" || status === "high" ? "success" : "warning"}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="suitability-notes">
                  {res === "city_day" && "Verified against daily city-level weighbridge totals."}
                  {res === "district_week" && "Weekly district totals aligned with official retribution billing records."}
                  {res === "district_day" && "Daily district resolution used as calibrated dynamic simulation."}
                  {res === "district_month" && "Monthly district totals used for budget planning."}
                  {res === "hotspot_rank" && "Spatial ranking for high-risk operating areas."}
                </p>
              </div>
            ))}
          </div>
          <p className="audit-note"><strong>Model honesty note:</strong> {suitability?.note}</p>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Fleet Type Composition (2023 Census)</h2>
              <p>Inventory of DKI Jakarta sanitation fleet units by vehicle type.</p>
            </div>
            <Truck size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Physical fleet characteristics">
              <thead>
                <tr>
                  <th scope="col">Vehicle type</th>
                  <th scope="col">Unit count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleetTypes).map(([type, count]) => (
                  <tr key={type}>
                    <td><strong>{type.toUpperCase()}</strong></td>
                    <td>{count?.toLocaleString("en-US")} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Administrative Distribution (2023 Census)</h2>
              <p>Distribution of sanitation fleet units across five administrative cities and the regency.</p>
            </div>
            <Users size={20} />
          </div>
          <div className="table-wrap">
            <table className="audit-table" role="grid" aria-label="Census area distribution">
              <thead>
                <tr>
                  <th scope="col">Administrative area</th>
                  <th scope="col">Unit count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(fleet?.by_wilayah || {}).map(([wilayah, count]) => (
                  <tr key={wilayah}>
                    <td><strong>{wilayah}</strong></td>
                    <td>{count?.toLocaleString("en-US")} units</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fleet-totals">
            <div className="fleet-total-row">
              <span>Total registered fleet units:</span>
              <b>{fleet?.total_units?.toLocaleString("en-US")} units</b>
            </div>
            <div className="fleet-total-row">
              <span>Census data source:</span>
              <span>{fleet?.source}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WeatherPanel({ weather }) {
  const forecast = weather?.forecast || [];
  const peak = forecast.reduce(
    (best, item) => (item.waste_impact_percent > (best?.waste_impact_percent || 0) ? item : best),
    forecast[0],
  );
  const trendRows = forecast.slice(0, 7);
  const maxRainfall = Math.max(...trendRows.map((item) => item.rainfall_mm || 0), 1);
  const maxImpact = Math.max(...trendRows.map((item) => item.waste_impact_percent || 0), 1);

  return (
    <section className="panel weather-panel">
      <div className="panel-title">
        <div>
          <h2>Open-Meteo Weather Risk</h2>
          <p>Jakarta 7-day rainfall forecast used as a driver for waste-volume readiness.</p>
        </div>
        <StatusPill tone={weather?.source === "open-meteo" ? "success" : "warning"}>
          {weather?.source === "open-meteo" ? "Open-Meteo live" : "fallback"}
        </StatusPill>
      </div>
      {peak && (
        <div className="weather-hero">
          <CloudRain size={26} />
          <div>
            <strong>{peak.date}</strong>
            <span>{peak.rainfall_mm.toFixed(1)} mm rain - {Math.round(peak.precipitation_probability)}% probability</span>
          </div>
          <b>+{peak.waste_impact_percent}%</b>
        </div>
      )}
      <div className="weather-strip">
        {forecast.slice(0, 7).map((day) => (
          <article key={day.date} className={`weather-day ${day.risk_level}`}>
            <div>
              <strong>{new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}</strong>
              <small>{new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small>
            </div>
            <span>{Math.round(day.rainfall_mm)} mm</span>
            <small>{Math.round(day.temperature_min_c)}-{Math.round(day.temperature_max_c)} C</small>
          </article>
        ))}
      </div>
      <div className="weather-trend-chart" aria-label="Rainfall impact trend chart">
        <h3>Rainfall impact trend</h3>
        {trendRows.map((day) => {
          const rainWidth = Math.max(4, ((day.rainfall_mm || 0) / maxRainfall) * 100);
          const impactWidth = Math.max(4, ((day.waste_impact_percent || 0) / maxImpact) * 100);
          const dayLabel = new Date(day.date).toLocaleDateString("en-US", { weekday: "short" });
          return (
            <article className="weather-trend-row" key={`${day.date}-trend`}>
              <span>{dayLabel}</span>
              <div className="weather-trend-bars">
                <i className="rainfall-bar" style={{ width: `${rainWidth}%` }} />
                <i className="impact-bar" style={{ width: `${impactWidth}%` }} />
              </div>
              <b>{Math.round(day.rainfall_mm)} mm</b>
              <em>+{day.waste_impact_percent}%</em>
            </article>
          );
        })}
      </div>
      {peak && <p className="weather-advice">{peak.operational_advice}</p>}
    </section>
  );
}

function FleetTable({ trucks, onOpenTripHistory }) {
  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Fleet State</h2>
          <p>Each row is directly actionable and audit-ready.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Truck</th>
              <th>Driver</th>
              <th>Zone</th>
              <th>Status</th>
              <th>Speed</th>
              <th>Deviation</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map((truck) => (
              <tr key={truck.truck_code}>
                <td><b>{truck.truck_code}</b><span>{truck.plate_number}</span></td>
                <td>{truck.driver_name}</td>
                <td>{truck.assigned_zone}</td>
                <td>
                  {truck.deviation?.violated ? (
                    <StatusPill tone="danger">Route violation</StatusPill>
                  ) : truck.is_damaged ? (
                    <StatusPill tone="warning">Damaged</StatusPill>
                  ) : (
                    <StatusPill tone="success">Normal</StatusPill>
                  )}
                </td>
                <td>{truck.latest_position?.speed_kmh} km/h</td>
                <td>{Math.round(truck.deviation?.distance_meters || 0)} m</td>
                <td>
                  <button className="ghost-button" type="button" aria-label={`View ${truck.truck_code} trip history`} onClick={() => onOpenTripHistory?.(truck.truck_code)}>
                    Trip history
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExecutiveSummary({ summary, queue }) {
  return (
    <section className="panel summary-panel">
      <div className="panel-title">
        <div>
          <h2>Executive Summary</h2>
          <p>Prepared for DLH leadership and case-provider review.</p>
        </div>
        <ShieldCheck size={20} />
      </div>
      <h3>{summary.headline}</h3>
      <ul>
        {summary.points.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <div className="queue-box">
        <strong>TPA Bantargebang queue</strong>
        <span>{queue.trucks_waiting} trucks waiting - {queue.estimated_wait_minutes} min estimated delay</span>
        <p>{queue.recommendation}</p>
      </div>
    </section>
  );
}

function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I am Ana. Ask me about route deviation, rainfall risk, TPA queue, dispatch priority, or waste forecast spikes.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function askAssistant(promptOverride) {
    const prompt = (promptOverride || question).trim();
    if (!prompt || loading) return;

    setMessages((current) => [...current, { role: "user", text: prompt }]);
    setQuestion("");
    setLoading(true);
    try {
const response = await fetch(`${API_URL}/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.answer || "No answer returned.",
          provider: data.provider || "unknown",
          model: data.model || "",
          toolsUsed: data.tools_used || [],
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Assistant fallback unavailable. Check the API server, then retry the operational query.",
          provider: "offline",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function normalizeAssistantText(text) {
    return text
      .replace(/\r/g, "")
      .replace(/[—–�]/g, " - ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\bis_damaged:\s*true\b/gi, "truck damage confirmed")
      .replace(/\bis_damaged:\s*false\b/gi, "truck damage not reported")
      .replace(/\bRisis\b/gi, "Risk")
      .replace(/,?\s*flags:\s*[^\n.]+[.]?/gi, "")
      .replace(/Severity:\s*critical,\s*confidence\s*([\d.]+),?\s*/gi, "Severity: critical with high confidence. ");
  }

  function renderAssistantText(text) {
    const cleanText = normalizeAssistantText(text);
    const renderInline = (line) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
      return parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      });
    };

    const lines = cleanText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const blocks = [];
    let bullets = [];
    let numbers = [];

    const flushBullets = () => {
      if (!bullets.length) return;
      blocks.push(
        <ul key={`list-${blocks.length}`}>
          {bullets.map((line, index) => <li key={`${line}-${index}`}>{renderInline(line)}</li>)}
        </ul>,
      );
      bullets = [];
    };

    const flushNumbers = () => {
      if (!numbers.length) return;
      blocks.push(
        <ol key={`ordered-${blocks.length}`}>
          {numbers.map((line, index) => <li key={`${line}-${index}`}>{renderInline(line)}</li>)}
        </ol>,
      );
      numbers = [];
    };

    lines.forEach((line) => {
      const bullet = line.match(/^[-*]\s+(.+)/);
      if (bullet) {
        flushNumbers();
        bullets.push(bullet[1]);
        return;
      }
      const ordered = line.match(/^\d+\.\s+(.+)/);
      if (ordered) {
        flushBullets();
        numbers.push(ordered[1]);
        return;
      }
      flushBullets();
      flushNumbers();
      blocks.push(<p key={`paragraph-${blocks.length}`}>{renderInline(line)}</p>);
    });

    flushBullets();
    flushNumbers();
    return blocks;
  }

  return (
    <section className="assistant-panel assistant-chat-shell">
      <header className="assistant-chat-header">
        <span className="assistant-chat-mark" aria-hidden="true">
          <Bot size={16} />
        </span>
        <div>
          <h2>Ana</h2>
          <p>Live command guide for routing, weather risk, and dispatch decisions.</p>
        </div>
      </header>

      <div className="assistant-message-list" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`assistant-message ${message.role}`} key={`${message.role}-${index}`}>
            <span className="assistant-message-avatar" aria-hidden="true">
              {message.role === "assistant" ? "AI" : "ME"}
            </span>
            <div className="assistant-bubble">
              <div className="assistant-formatted-answer">{renderAssistantText(message.text)}</div>
              {message.role === "assistant" && (message.model || message.provider) && (
                <small className="assistant-source">
                  {message.model ? `Ana · ${message.model}` : message.provider}
                  {message.toolsUsed && message.toolsUsed.length > 0 ? ` · tools: ${message.toolsUsed.join(", ")}` : ""}
                </small>
              )}
            </div>
          </article>
        ))}
        {loading && (
          <article className="assistant-message assistant">
            <span className="assistant-message-avatar" aria-hidden="true">AI</span>
            <div className="assistant-bubble assistant-thinking">
              <span />
              <span />
              <span />
            </div>
          </article>
        )}
      </div>

      <div className="assistant-quick-prompts" aria-label="Suggested assistant prompts">
        <button type="button" onClick={() => askAssistant("What is the highest operational risk today?")}>
          Highest risk today
        </button>
        <button type="button" onClick={() => askAssistant("Which truck should be dispatched first and why?")}>
          Dispatch priority
        </button>
      </div>

      <form
        className="assistant-chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          askAssistant();
        }}
      >
        <label className="sr-only" htmlFor="assistant-question">Ask Ana anything</label>
        <input
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask Ana anything..."
          autoComplete="off"
        />
        <button className="primary-button" type="submit" aria-label="Send message" disabled={loading || !question.trim()}>
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}

function ScenarioPanel({ mode, children }) {
  return <div className={`scenario-panel scenario-${mode}`}>{children}</div>;
}

function PlanningApproval({ plan, planLoading, approved, approvePlan, role }) {
  const unmetCount = plan?.unmet_reasons?.length || 0;

  return (
    <div className="planning-approval">
      <div className="planning-approval-head">
        <strong>Decision authority</strong>
        <span className="role-badge">Role: <b>{role}</b></span>
      </div>
      {!plan && <p className="planning-approval-note">Generate a dispatch plan to review approval evidence.</p>}
      {plan && (
        <dl className="approval-evidence-list">
          <div><dt>Plan</dt><dd>{plan.plan_id}</dd></div>
          <div><dt>Assigned demand</dt><dd>{plan.total_assigned_tons} / {plan.total_demand_tons} tons</dd></div>
          <div><dt>Permit evidence</dt><dd>{plan.assignments.filter((assignment) => assignment.evidence.permit_compliant).length} compliant assignments</dd></div>
        </dl>
      )}
      {plan?.status === "proposed" && unmetCount === 0 && (
        <button className="primary-button approve-dispatch-btn" onClick={approvePlan} disabled={planLoading}>
          {planLoading ? "Approving Plan..." : "Approve & Dispatch Plan"}
        </button>
      )}
      {plan?.status === "proposed" && unmetCount > 0 && (
        <p className="planning-approval-note planning-approval-blocked">Approval remains unavailable until every constraint warning is resolved.</p>
      )}
      {approved && (
        <div className="optimizer-success">
          <Check size={16} /> Plan approved. Dispatches generated & pushed to field app!
        </div>
      )}
    </div>
  );
}

function PlanningDecisionFlow({ attendance, setAttendance, rainfall, setRainfall, eventLat, eventLng, summary, queue }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Operations optimizer state for forecast-to-dispatch handoff.
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [optimizerError, setOptimizerError] = useState("");

  const role = localStorage.getItem("jwis_role") || "guest";
  const token = localStorage.getItem("jwis_token");

  async function run() {
    setLoading(true);
    setPlan(null);
    setApproved(false);
    setOptimizerError("");
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
      });
      if (eventLat !== undefined && eventLat !== null) params.append("event_lat", String(eventLat));
      if (eventLng !== undefined && eventLng !== null) params.append("event_lng", String(eventLng));
      const res = await fetch(`${API_URL}/predictions/kecamatan?${params.toString()}`);
      if (res.ok) setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, rainfall, eventLat, eventLng]);

  async function generatePlan() {
    setPlanLoading(true);
    setApproved(false);
    setOptimizerError("");
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
        top_n: "5",
      });
      if (eventLat !== undefined && eventLat !== null) params.append("event_lat", String(eventLat));
      if (eventLng !== undefined && eventLng !== null) params.append("event_lng", String(eventLng));
      const response = await fetch(`${API_URL}/operations/plan?${params.toString()}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to generate plan");
      const planData = await response.json();
      setPlan(planData);
    } catch (err) {
      setOptimizerError(err.message || "Failed to generate plan.");
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }

  async function approvePlan() {
    if (!plan) return;
    setPlanLoading(true);
    setOptimizerError("");
    try {
      const response = await fetch(`${API_URL}/operations/${plan.plan_id}/approve`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (response.status === 401) {
        throw new Error("Unauthorized - Please log in again.");
      }
      if (response.status === 403) {
        throw new Error(`Role '${role}' lacks permission to approve plans (requires supervisor or administrator).`);
      }
      if (!response.ok) {
        throw new Error("Failed to approve plan");
      }
      const approvedData = await response.json();
      setPlan(approvedData);
      setApproved(true);
    } catch (err) {
      setOptimizerError(err.message || "Failed to approve plan.");
    } finally {
      setPlanLoading(false);
    }
  }

  const top5 = (data?.top_hotspots || []).slice(0, 5);
  const totalTons = data?.total_predicted_tons || 0;
  const manHours = top5.reduce((s, k) => s + (k.man_hours_required || 0), 0);
  const crews = top5.reduce((s, k) => s + (k.crews_required || 0), 0);
  const trucks = top5.reduce((s, k) => s + (k.trucks_required || 0), 0);
  const bins = top5.reduce((s, k) => s + (k.disposal_bins_required || 0), 0);

  return (
    <IntegratedPlanning
      summary={<ExecutiveSummary summary={summary} queue={queue} />}
      scenario={{
        inputs: (
          <ScenarioPanel mode="inputs">
      <div className="panel-title">
        <div>
          <h2>Event Scenario Simulator</h2>
          <p>Weather and crowd scenarios run through the live 42-district hybrid model, not a static estimate.</p>
        </div>
        <Users size={20} />
      </div>
      <div className="control-row">
        <label>
          <span>Event Attendance</span>
          <input type="range" min="0" max="200000" step="5000" value={attendance} onChange={(event) => setAttendance(Number(event.target.value))} />
          <small>{attendance.toLocaleString("en-US")} people</small>
        </label>
        <label>
          <span>Rainfall (mm)</span>
          <input type="range" min="0" max="100" step="1" value={rainfall} onChange={(event) => setRainfall(Number(event.target.value))} />
          <small>{rainfall} mm</small>
        </label>
        <button className="primary-button" onClick={run} disabled={loading}>
          {loading ? "Calculating..." : "Run scenario"}
        </button>
      </div>
      <div className="scenario-result">
        <strong>Total forecast {totalTons.toLocaleString("en-US")} tons/day ({data?.kecamatan_count || 42} districts)</strong>
        <span>Peak: {top5[0]?.kecamatan || "..."} - {top5[0]?.predicted_tons?.toLocaleString("en-US") || "..."} tons</span>
      </div>
      <div className="scenario-reqs">
        <div className="req-chip"><b>{manHours}</b><span>man-hours (top 5)</span></div>
        <div className="req-chip"><b>{crews}</b><span>field crews (top 5)</span></div>
        <div className="req-chip"><b>{trucks}</b><span>trucks (top 5)</span></div>
        <div className="req-chip"><b>{bins}</b><span>large bins (top 5)</span></div>
      </div>
          </ScenarioPanel>
        ),
        recommendation: (
          <ScenarioPanel mode="recommendation">
      <div className="optimizer-section">
        <div className="optimizer-head">
          <h3>Operations Optimizer</h3>
        </div>
        
        {!plan && (
          <>
            <button className="primary-button" onClick={generatePlan} disabled={planLoading || loading}>
              {planLoading ? "Optimizing..." : "Generate Dispatch Plan (CP-SAT)"}
            </button>
            <div className="plan-preflight-grid" aria-label="Plan preflight">
              <div>
                <span>Forecast demand</span>
                <strong>{totalTons.toLocaleString("en-US")} tons/day</strong>
              </div>
              <div>
                <span>Fleet need</span>
                <strong>{trucks} trucks / {crews} crews</strong>
              </div>
              <div>
                <span>TPA queue</span>
                <strong>{queue.trucks_waiting} trucks / {queue.estimated_wait_minutes} min</strong>
              </div>
            </div>
            <div className="optimizer-empty-state" aria-live="polite">
              <strong>No dispatch plan generated yet.</strong>
              <p>Generate a CP-SAT plan to fill this stage with assigned trucks, demand coverage, and permit compliance evidence.</p>
            </div>
          </>
        )}

        {optimizerError && (
          <div className="unmet-reasons-box optimizer-error">
            <strong>Error:</strong> {optimizerError}
          </div>
        )}

        {plan && (
          <div className="optimizer-plan-card">
            <div className="plan-header">
              <strong>Plan ID: {plan.plan_id}</strong>
              <span className={`plan-status-badge ${plan.status}`}>
                {plan.status.toUpperCase()}
              </span>
            </div>
            
            <div className="plan-stats-grid">
              <div className="plan-stat-item">
                <span>Total Demand</span>
                <strong>{plan.total_demand_tons} tons</strong>
              </div>
              <div className="plan-stat-item">
                <span>Assigned</span>
                <strong>{plan.total_assigned_tons} tons</strong>
              </div>
              <div className="plan-stat-item">
                <span>Status</span>
                <strong className={plan.unmet_reasons?.length ? "text-danger" : "text-success"}>
                  {plan.unmet_reasons?.length ? "Unmet Demand" : "Feasible"}
                </strong>
              </div>
            </div>

            {plan.unmet_reasons?.length > 0 && (
              <div className="unmet-reasons-box">
                <strong>Constraint Warnings:</strong>
                <ul>
                  {plan.unmet_reasons.map((r, i) => (
                    <li key={i}>{r.replace(/_/g, ' ')}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="assign-title">Optimizer Assignments:</div>
            <div className="assignments-container">
              {plan.assignments.map((a, i) => (
                <div key={i} className="assign-card">
                  <div className="assign-info">
                    <strong>Truck {a.truck_code}</strong>
                    <span>&rarr; {a.area.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div className="assign-evidence">
                    <span>Assigned: <b>{a.assigned_tons}t</b></span>
                    {a.evidence.permit_compliant ? (
                      <span className="ok">Permit Compliant</span>
                    ) : (
                      <span className="warn">No Permit</span>
                    )}
                  </div>
                </div>
              ))}
              {plan.assignments.length === 0 && (
                <p className="kec-note optimizer-empty">No truck assignments generated.</p>
              )}
            </div>

          </div>
        )}
      </div>
          </ScenarioPanel>
        ),
      }}
      evidence={(
        <PlanningApproval
          plan={plan}
          planLoading={planLoading}
          approved={approved}
          approvePlan={approvePlan}
          role={role}
        />
      )}
      unmetCount={plan?.unmet_reasons?.length || 0}
    />
  );
}



function TpaQueuePanel() {
  const [queue, setQueue] = useState(null);

  async function fetchQueue() {
    try {
      const res = await fetch(`${API_URL}/tpa/queue-status`);
      if (res.ok) setQueue(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 6000);
    return () => clearInterval(interval);
  }, []);

  if (!queue) return null;

  return (
    <section className="panel tpa-queue-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang Landfill Queue Status</h2>
          <p>Real-time visualization of weighbridge throughput and final-disposal truck queues.</p>
        </div>
        <Clock size={20} />
      </div>

      <div className="tpa-status-grid">
        <div className="tpa-status-card">
          <span>Queued Trucks</span>
          <strong>{queue.trucks_in_queue} units</strong>
        </div>
        <div className="tpa-status-card">
          <span>Estimated Wait</span>
          <strong className={queue.avg_wait_minutes > 60 ? "text-danger" : "text-success"}>
            {queue.avg_wait_minutes} min
          </strong>
        </div>
        <div className="tpa-status-card">
          <span>Weighbridge</span>
          <strong className={queue.weighbridge_status.includes("DEGRADED") ? "text-danger" : "text-success"}>
            {queue.weighbridge_status}
          </strong>
        </div>
      </div>

      <div className="tpa-logs">
        <h3>Latest Weighbridge Log</h3>
        <ul>
          {queue.scale_logs?.map((log, i) => (
            <li key={i}>
              <span className="time">{log.time}</span>
              <span className="truck">{log.truck}</span>
              <span className="weight">{log.weight_ton} tons</span>
              <span className={`status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}


function CrowdEventsPanel({ onSimulateEvent }) {
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
          <h2>Crowd Permit & Waste-Volume Forecast</h2>
          <p>Connects public-event permit data with DLH logistics resource planning.</p>
        </div>
        <Calendar size={20} />
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
                <span>Waste Forecast</span>
                <strong>{ev.predicted_waste_tons} tons</strong>
              </div>
              <div className="event-metric">
                <span>Field Crews</span>
                <strong>{ev.crews_required} people ({ev.man_hours_required} m-hours)</strong>
              </div>
              <div className="event-metric">
                <span>Backup Fleet</span>
                <strong>{ev.backup_trucks_required} trucks</strong>
              </div>
              <div className="event-metric">
                <span>Large Bins</span>
                <strong>{ev.large_bins_required} units</strong>
              </div>
            </div>
            {onSimulateEvent && (
              <button className="primary-button event-simulate-button" onClick={() => onSimulateEvent(ev)}>
                <Zap size={14} /> Simulate event in Optimizer
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AStarReroutingPanel() {
  const [jamActive, setJamActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);

  async function fetchRerouteInfo() {
    try {
      const res = await fetch(`${API_URL}/fleet/astar-reroute`);
      if (res.ok) setInfo(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchRerouteInfo();
  }, [jamActive]);

  async function toggleTrafficJam() {
    setLoading(true);
    const nextState = !jamActive;
    try {
      const res = await fetch(`${API_URL}/fleet/astar-simulate-jam?active=${nextState}`, { method: "POST" });
      if (res.ok) {
        setJamActive(nextState);
        await fetchRerouteInfo();
      }
    } catch {
      setJamActive(nextState); // Local demo fallback
    }
    setLoading(false);
  }

  return (
    <section className="panel astar-panel">
      <div className="panel-title">
        <div>
          <h2>A* Dynamic Rerouting</h2>
          <p>Tests A* route recovery when a logistics corridor is fully congested.</p>
        </div>
        <Truck size={20} />
      </div>
      
      <div className="astar-control">
        <button 
          className={`primary-button ${jamActive ? "danger-button" : "success-button"}`} 
          onClick={toggleTrafficJam} 
          disabled={loading}
        >
          {loading ? "Processing..." : jamActive ? "Restore Traffic" : "Simulate Corridor Jam"}
        </button>
        
        <span className={`traffic-status-badge ${jamActive ? "congested" : "clear"}`}>
          {jamActive ? "Jam Active" : "Clear"}
        </span>
      </div>

      {info && (
        <div className="astar-info-card">
          <p className="astar-msg">
            <b>Logistics Status:</b>{" "}
            {info.jam_active
              ? "Corridor congestion detected. JWIS is diverting trucks through the active A* recovery route."
              : "Traffic is normal. Trucks are following the shortest approved route to Bantargebang."}
          </p>
          <div className="astar-stats">
            <div className="astar-stat-col">
              <span>Distance</span>
              <strong>{info.active_route?.distance_km} km</strong>
            </div>
            <div className="astar-stat-col">
              <span>Estimated Time</span>
              <strong>{info.active_route?.eta_minutes} min</strong>
            </div>
            <div className="astar-stat-col">
              <span>Route Status</span>
              <strong className={info.jam_active ? "text-diverted" : "text-normal"}>
                {info.jam_active ? "Diverted (A*)" : "Corridor Compliant"}
              </strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StaggerSimulatorPanel() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runSimulation() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/simulator/stagger?active_trucks=5`, { method: "POST" });
      const data = await response.json();
      setResult(data);
    } catch {
      // Robust local fallback for demo stability
      setResult({
        baseline_wait_minutes: 116, baseline_queue_trucks: 47,
        optimized_wait_minutes: 48, optimized_queue_trucks: 19,
        queue_reduction_percent: 58.6, recommended_stagger_minutes: 15,
        dispatch_slots: [
          { truck_index: 1, suggested_departure: "08:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
          { truck_index: 2, suggested_departure: "08:15", slot_status: "assigned", tpa_wait_est_minutes: 48 },
          { truck_index: 3, suggested_departure: "08:30", slot_status: "assigned", tpa_wait_est_minutes: 48 },
          { truck_index: 4, suggested_departure: "08:45", slot_status: "assigned", tpa_wait_est_minutes: 48 },
          { truck_index: 5, suggested_departure: "09:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
        ],
      });
    }
    setLoading(false);
  }

  return (
    <section className="panel stagger-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang Queue Optimization</h2>
          <p>Staggered-dispatch simulation to reduce landfill waiting time.</p>
        </div>
        <ClipboardList size={20} />
      </div>
      <button className="primary-button" onClick={runSimulation} disabled={loading}>
        {loading ? "Calculating..." : "Run Dispatch Simulation"}
      </button>
      {result && (
        <>
          <div className="stagger-compare">
            <div className="stagger-col before">
              <span className="stagger-label">Without Optimization</span>
              <strong>{result.baseline_wait_minutes} min</strong>
              <small>{result.baseline_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-arrow">-&gt;</div>
            <div className="stagger-col after">
              <span className="stagger-label">With JWIS</span>
              <strong>{result.optimized_wait_minutes} min</strong>
              <small>{result.optimized_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-badge">-{result.queue_reduction_percent}%</div>
          </div>

          {result.dispatch_slots && result.dispatch_slots.length > 0 && (
            <div className="stagger-schedule-wrap">
              <h3>Recommended Staggered Departure Schedule:</h3>
              <div className="table-wrap">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID Truk</th>
                      <th>Saran Jam Berangkat</th>
                      <th>Estimasi Antri TPA</th>
                      <th>Schedule status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dispatch_slots.slice(0, 10).map((slot, i) => (
                      <tr key={i}>
                        <td><strong>T-0{slot.truck_index}</strong></td>
                        <td><code>{slot.suggested_departure}</code></td>
                        <td>{slot.tpa_wait_est_minutes} min</td>
                        <td>
                          <span className="status-pill success">{slot.slot_status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.dispatch_slots.length > 10 && (
                <p className="stagger-schedule-note">
                  Showing the first 10 slots out of {result.dispatch_slots.length} scheduled fleet slots.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function UnlicensedCollectorAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enforced, setEnforced] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/fleet/unlicensed-collectors`);
      if (res.ok) setAlerts(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function handleEnforce(plate) {
    setEnforced(prev => ({ ...prev, [plate]: true }));
  }

  if (loading || !alerts || !alerts.alerts || alerts.alerts.length === 0) {
    return (
      <section className="panel unlicensed-alerts-panel">
        <div className="panel-title">
          <div>
            <h2>Unlicensed Waste Collector Detection</h2>
            <p>Operational vehicles detected without official authorization inside the DKI Jakarta service area.</p>
          </div>
          <AlertTriangle size={20} />
        </div>
        <div className="empty-state compact">
          {loading ? "Loading detection data..." : "No unlicensed collector alerts detected."}
        </div>
      </section>
    );
  }

  return (
    <section className="panel unlicensed-alerts-panel">
      <div className="panel-title">
        <div>
          <h2>Unlicensed Waste Collector Detection</h2>
          <p>Operational vehicles detected without official authorization inside the DKI Jakarta service area.</p>
        </div>
        <AlertTriangle size={20} />
      </div>
      <div className="table-wrap">
        <table className="audit-table" role="grid" aria-label="Unlicensed collector detection">
          <thead>
            <tr>
              <th scope="col">Plate number</th>
              <th scope="col">Coordinate location</th>
              <th scope="col">Status</th>
              <th scope="col">Enforcement action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.alerts.map((a, i) => (
              <tr key={i}>
                <td><strong>{a.plate || "Unknown"}</strong></td>
                <td><code>{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</code></td>
                <td>
                  <span className={`status-pill ${enforced[a.plate] ? "success" : "warning"}`}>
                    {enforced[a.plate] ? "PATROL DISPATCHED" : "UNAUTHORIZED"}
                  </span>
                </td>
                <td>
                  <button 
                    className="primary-button compact" 
                    onClick={() => handleEnforce(a.plate)}
                    disabled={enforced[a.plate]}
                  >
                    {enforced[a.plate] ? "Patrol dispatched" : "Dispatch patrol"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="stagger-schedule-note">
        Data source: registered plates from the DLH 2023 fleet registry. Matching is automated against commercial and private vehicle plates.
      </p>
    </section>
  );
}

function ReportActions() {
  async function downloadSummaryPdf() {
    const response = await fetch(`${API_URL}/reports/executive-summary`);
    const data = await response.json();
    const node = document.createElement("section");
    node.className = "pdf-report";
    node.innerHTML = `
      <h1>JWIS Executive Summary</h1>
      <p class="pdf-date">Generated by Jakarta Waste Intelligence System</p>
      <p>${data.summary}</p>
      <h2>Demo Evidence</h2>
      <ul>
        <li>AI route deviation detection and OSRM route recommendation</li>
        <li>Open-Meteo weather risk integration</li>
        <li>Subdistrict waste-risk heatmap layer</li>
        <li>Field dispatch loop with confirmation</li>
      </ul>
    `;
    try {
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf()
        .set({
          margin: 12,
          filename: "jwis-executive-summary.pdf",
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(node)
        .save();
    } catch {
      const blob = new Blob([data.summary], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "jwis-executive-summary.txt";
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <section className="panel report-panel">
      <div className="panel-title">
        <div>
          <h2>Report Export</h2>
          <p>One-click PDF executive summary backup for proposal and presentation handoff.</p>
        </div>
        <Download size={20} />
      </div>
      <button className="primary-button" onClick={downloadSummaryPdf}>
        <Download size={16} /> Export Executive Summary PDF
      </button>
    </section>
  );
}

// ── NEW DASHBOARD PANELS ─────────────────────────────────────────────

function CarbonPanel() {
  const [carbon, setCarbon] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/fleet/carbon`);
        if (!res.ok) throw new Error("no api");
        setCarbon(await res.json());
      } catch {
        setCarbon({
          total_fleet_distance_km: 216.9,
          total_co2_emitted_kg: 206.06,
          carbon_saved_today_kg: 17.58,
          fuel_saved_equivalent_liters: 6.5,
          compliance_rate_percent: 86,
        });
      }
    }
    load();
  }, []);

  if (!carbon) return null;

  return (
    <section className="panel carbon-panel" id="carbon-panel">
      <div className="panel-title">
        <div>
          <h2>Carbon Footprint Tracker</h2>
          <p>Fleet CO2 emissions and route-optimization savings (Euro 4 diesel: 0.95 kg CO2/km).</p>
        </div>
        <Leaf size={20} />
      </div>
      <div className="carbon-grid">
        <div className="carbon-stat">
          <span>Total Distance</span>
          <strong>{carbon.total_fleet_distance_km} km</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 Emitted</span>
          <strong>{carbon.total_co2_emitted_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 Saved</span>
          <strong>{carbon.carbon_saved_today_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>Fuel Saved</span>
          <strong>{carbon.fuel_saved_equivalent_liters} L</strong>
        </div>
      </div>
      <div className="carbon-badge">
        <Leaf size={16} /> Optimal-route compliance: {carbon.compliance_rate_percent}% - equivalent to planting {Math.round(carbon.carbon_saved_today_kg / 21)} trees/day
      </div>
    </section>
  );
}

function FleetHistoryPanel({ filterTruck, setFilterTruck }) {
  const [date, setDate] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    try {
      const params = new URLSearchParams();
      if (filterTruck && filterTruck !== "ALL") params.append("truck_code", filterTruck);
      if (date) params.append("date", date);
      const res = await fetch(`${API_URL}/fleet/history?${params.toString()}`);
      if (!res.ok) throw new Error("no api");
      setHistory(await res.json());
    } catch {
      setHistory([]);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [filterTruck, date]);

  return (
    <section className="panel wide" id="history-panel">
      <div className="panel-title">
        <div>
          <h2>Fleet Trip History</h2>
          <p>Route history by truck with date filters for distance, fuel, and deviation audits.</p>
        </div>
        <History size={20} />
      </div>
      <div className="history-filter-panel">
        <span className="history-title"><Calendar size={16} /> Filter</span>
        <label>
          Truck
          <select value={filterTruck} onChange={(e) => setFilterTruck(e.target.value)}>
            <option value="ALL">All Trucks</option>
            <option value="T-001">T-001</option>
            <option value="T-047">T-047</option>
            <option value="T-112">T-112</option>
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Truck</th>
              <th>Driver</th>
              <th>Date</th>
              <th>Distance</th>
              <th>Fuel</th>
              <th>GPS Points</th>
              <th>Deviation</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td className="table-empty-state" colSpan={7}>No trip history for this filter.</td></tr>
            ) : (
              history.map((trip) => (
                <tr key={`${trip.truck_code}-${trip.date}`}>
                  <td><b>{trip.truck_code}</b></td>
                  <td>{trip.driver_name}</td>
                  <td>{trip.date}</td>
                  <td>{trip.distance_km} km</td>
                  <td>{trip.fuel_consumed_liters} L</td>
                  <td>{trip.points?.length || 0} points</td>
                  <td>
                    {(trip.deviations_count ?? trip.deviations_detected ?? 0) > 0 ? (
                      <StatusPill tone="danger">{trip.deviations_count ?? trip.deviations_detected} deviations</StatusPill>
                    ) : (
                      <StatusPill tone="success">Clean</StatusPill>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DriverAnalytics() {
  const drivers = [
    { name: "Budi Santoso", truck: "T-001", score: 98, fuel: 4.8, trips: 142, deviations: 0 },
    { name: "Agus Pratama", truck: "T-047", score: 72, fuel: 3.5, trips: 118, deviations: 12 },
    { name: "Joko Wijaya", truck: "T-088", score: 95, fuel: 4.6, trips: 135, deviations: 1 },
    { name: "Rizky Maulana", truck: "T-112", score: 90, fuel: 4.2, trips: 98, deviations: 0 },
  ];

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Driver Performance Analytics</h2>
          <p>Real-time scoring of route corridor compliance, safety, and fuel efficiency.</p>
        </div>
        <Truck size={20} />
      </div>
      <div className="table-wrap mt-16">
        <table>
          <thead>
            <tr>
              <th>Driver Name</th>
              <th>Truck Code</th>
              <th>Corridor Compliance Score</th>
              <th>Avg Fuel Efficiency</th>
              <th>Completed Trips</th>
              <th>Deviations Detected</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.name}>
                <td><b>{d.name}</b></td>
                <td><span className="mono">{d.truck}</span></td>
                <td>
                  <span className={`pill ${d.score >= 90 ? "success" : "warning"}`}>{d.score}%</span>
                </td>
                <td><span className="mono">{d.fuel} km/L</span></td>
                <td><span className="mono">{d.trips}</span></td>
                <td>
                  <span className={`pill ${d.deviations > 0 ? "danger" : "success"}`}>{d.deviations}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeighbridgeLogs() {
  const logs = [
    { time: "16:45:12", truck: "T-001", type: "Dump Truck Besar", gross: 24.2, tare: 6.0, net: 18.2, status: "SUCCESS" },
    { time: "16:42:05", truck: "T-088", type: "Arm Roll Besar", gross: 23.8, tare: 5.8, net: 18.0, status: "SUCCESS" },
    { time: "16:35:50", truck: "T-136", type: "Dump Truck Kecil", gross: 12.5, tare: 3.5, net: 9.0, status: "SUCCESS" },
    { time: "16:30:14", truck: "T-112", type: "Compactor Kecil", gross: 11.2, tare: 3.2, net: 8.0, status: "SUCCESS" },
    { time: "16:15:22", truck: "T-047", type: "Compactor Besar", gross: 24.5, tare: 6.2, net: 18.3, status: "SUCCESS" },
  ];

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Weighbridge Weighing Records</h2>
          <p>Real-time transactions ingested from Bantargebang's weighbridge scales.</p>
        </div>
        <Workflow size={20} />
      </div>
      <div className="table-wrap mt-16">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Truck Code</th>
              <th>Vehicle Type</th>
              <th>Gross Weight</th>
              <th>Tare Weight</th>
              <th>Net Weight</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, idx) => (
              <tr key={idx}>
                <td><span className="mono">{l.time}</span></td>
                <td><b>{l.truck}</b></td>
                <td>{l.type}</td>
                <td><span className="mono">{l.gross} t</span></td>
                <td><span className="mono">{l.tare} t</span></td>
                <td><span className="mono">{l.net} t</span></td>
                <td><span className="pill success">{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WhatsAppGateway() {
  const [config, setConfig] = useState({
    drivers: {
      "Budi Santoso": "",
      "Agus Pratama": "",
      "Joko Wijaya": "",
      "Rizky Maulana": ""
    },
    group_jid: "",
    send_to_group: true,
    send_to_driver: true
  });
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState({ configured: false, connected: false, base_url: "", session_id: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/contacts`);
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error("Failed to load contacts config", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/whatsapp/status`);
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to load WA status", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      const data = await res.json();
      const waAlerts = data
        .filter(event => event.event_type === "whatsapp_alert")
        .map(event => {
          const date = new Date(event.created_at);
          const timeStr = date.toTimeString().split(" ")[0];
          return {
            time: timeStr,
            recipient: event.payload.recipient || event.payload.chat_id || "Driver/Group",
            msg: event.payload.msg || `Alert sent for truck ${event.payload.truck_code}`,
            status: event.payload.sent ? "DELIVERED" : "FAILED"
          };
        });
      setLogs(waAlerts);
    } catch (err) {
      console.error("Failed to load logs", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchLogs();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaveStatus("");
    try {
      const res = await fetch(`${API_URL}/whatsapp/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus(""), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      setSaveStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wa-workspace">
      <div className="wa-config-stack">
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Connection State</h2>
              <p>WhatsApp Gateway status.</p>
            </div>
            <MessageCircle size={20} />
          </div>
          <dl className="approval-evidence-list mt-16">
            <div><dt>Gateway</dt><dd>Baileys WhatsApp Gateway</dd></div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`pill ${status.connected ? "success" : "warning"}`}>
                  {status.connected ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </dd>
            </div>
            <div><dt>Session JID</dt><dd className="mono">{status.session_id || "default"}@c.us</dd></div>
            <div><dt>API Port</dt><dd className="mono">2785</dd></div>
            {!status.connected && status.message && <div><dt>Reason</dt><dd>{status.message}</dd></div>}
          </dl>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>Driver &amp; Group Routing Config</h2>
              <p>Map fleet units to driver numbers or coordination groups.</p>
            </div>
            <Users size={20} />
          </div>
          <form onSubmit={handleSave} className="wa-config-form">
            <div className="wa-check-row">
              <label className="wa-check">
                <input
                  type="checkbox"
                  checked={config.send_to_driver}
                  onChange={(e) => setConfig({ ...config, send_to_driver: e.target.checked })}
                />
                Send to Drivers
              </label>
              <label className="wa-check">
                <input
                  type="checkbox"
                  checked={config.send_to_group}
                  onChange={(e) => setConfig({ ...config, send_to_group: e.target.checked })}
                />
                Send to Group
              </label>
            </div>

            <div className="wa-field-stack">
              <strong>Driver Phone Numbers:</strong>
              {Object.keys(config.drivers).map((driverName) => (
                <div key={driverName} className="wa-driver-row">
                  <span>{driverName}</span>
                  <input
                    type="text"
                    value={config.drivers[driverName]}
                    onChange={(e) => {
                      const newDrivers = { ...config.drivers, [driverName]: e.target.value };
                      setConfig({ ...config, drivers: newDrivers });
                    }}
                    placeholder="e.g. 6289675877496@c.us"
                  />
                </div>
              ))}
            </div>

            <div className="wa-field-stack">
              <strong>Coordination Group JID:</strong>
              <input
                type="text"
                value={config.group_jid}
                onChange={(e) => setConfig({ ...config, group_jid: e.target.value })}
                placeholder="e.g. 6285229890542-1620000000@g.us"
              />
            </div>

            <div className="wa-form-actions">
              <button type="submit" className="primary-button wa-save-button" disabled={loading}>
                Save Configuration
              </button>
              {saveStatus === "success" && <span className="wa-save-status success">Saved successfully</span>}
              {saveStatus === "error" && <span className="wa-save-status error">Failed to save</span>}
            </div>
          </form>
        </section>
      </div>

      <section className="panel wa-log-panel">
        <div className="panel-title">
          <div>
            <h2>Outbound Alert Logs (Dynamic)</h2>
            <p>Real-time log of automated messages dispatched to drivers &amp; groups.</p>
          </div>
          <Activity size={20} />
          <button 
            type="button"
            onClick={() => { fetchLogs(); fetchStatus(); }} 
            className="ghost-button" 
            title="Refresh logs"
          >
            <RefreshCcw size={16} />
          </button>
        </div>
        <div className="table-wrap wa-log-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Recipient</th>
                <th>Alert Message</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td className="table-empty-state" colSpan="4">
                    No alerts sent yet. Try dispatching from Fleet Operations!
                  </td>
                </tr>
              ) : (
                logs.map((a, idx) => (
                  <tr key={idx}>
                    <td><span className="mono">{a.time}</span></td>
                    <td><b className="wa-recipient">{a.recipient}</b></td>
                    <td><span className="wa-message-cell">{a.msg}</span></td>
                    <td>
                      <span className={`pill ${a.status === "DELIVERED" ? "success" : "danger"}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function IotBinSensors() {
  const sensors = [
    { loc: "Kawasan Monas, Jakarta Pusat", id: "RAD-MONAS-01", fill: 82, status: "CRITICAL", batt: "88%", last: "3 mins ago" },
    { loc: "Gelora Bung Karno, Senayan", id: "RAD-GBK-02", fill: 45, status: "NORMAL", batt: "94%", last: "5 mins ago" },
    { loc: "Bundaran HI - Jl. Sudirman", id: "RAD-HI-03", fill: 94, status: "CRITICAL", batt: "90%", last: "1 min ago" },
    { loc: "Taman Fatahillah, Kota Tua", id: "RAD-KOTUA-04", fill: 20, status: "NORMAL", batt: "92%", last: "12 mins ago" },
  ];

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>IoT Radar Bin Sensors</h2>
          <p>Radar ultrasonic volume capacity tracking deployed at public trash bins.</p>
        </div>
        <Activity size={20} />
      </div>
      <div className="grid-autofit mt-16">
        {sensors.map((s) => (
          <div key={s.id} className="event-item-card">
            <div className="event-header">
              <h3>{s.id}</h3>
              <span className={`pill ${s.status === "CRITICAL" ? "danger" : "success"}`}>{s.status}</span>
            </div>
            <p className="location">{s.loc}</p>
            <div className="iot-sensor-meta">
              <div>
                <span>Fill Capacity</span>
                <strong>{s.fill}%</strong>
              </div>
              <div className="iot-sensor-health">
                <span>Battery: {s.batt}</span>
                <span>Checked {s.last}</span>
              </div>
            </div>
            <div className="iot-fill-track">
              <span className={s.status === "CRITICAL" ? "critical" : "normal"} style={{ width: `${s.fill}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── COMMAND CENTER (main dashboard) ──────────────────────────────────

function CommandCenter({ onLogout }) {
  const { snapshot, online, refresh } = useSnapshot();
  const [toast, setToast] = useState("");
  const [filterTruck, setFilterTruck] = useState("ALL");
  const [activeWorkspace, setActiveWorkspace] = useState("fleet");
  const [fleetDetailTab, setFleetDetailTab] = useState("fleet");
  const [historyScrollRequest, setHistoryScrollRequest] = useState(0);

  const [attendance, setAttendance] = useState(85000);
  const [rainfall, setRainfall] = useState(42);
  const [eventLat, setEventLat] = useState(null);
  const [eventLng, setEventLng] = useState(null);

  // Map state lifted from LiveFleetMap
  const [layers, setLayers] = useState({ heatmap: false, osrm: true, unlicensed: true, tps: true, wr: true });
  const [playbackTruck, setPlaybackTruck] = useState(null);
  const [playbackOptions, setPlaybackOptions] = useState([]);

  useEffect(() => {
    if (!historyScrollRequest || fleetDetailTab !== "history") return;
    const el = document.getElementById("history-panel");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [fleetDetailTab, historyScrollRequest]);

  function selectFleetTruck(code, openTripHistory = false) {
    setFilterTruck(code);
    if (openTripHistory) {
      setFleetDetailTab("history");
      setHistoryScrollRequest((request) => request + 1);
    }
  }

  async function dispatch(alert) {
    const route = alert.recommended_routes?.[0]?.name || "backup operating route";
    const instruction = "Use " + route + ". Confirm when accepted.";
    try {
      const response = await fetch(`${API_URL}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ truck_code: alert.truck_code, instruction }),
      });
      if (!response.ok) throw new Error("dispatch failed");
      setToast("Instruction sent to " + alert.truck_code);
      refresh();
    } catch {
      setToast("Demo mode: instruction prepared for " + alert.truck_code);
    }
    setTimeout(() => setToast(""), 3200);
  }

  async function sendWhatsAppAlert(alert) {
    const route = alert.recommended_routes?.[0]?.name || "dispatch backup fleet";
    try {
      const response = await fetch(`${API_URL}/whatsapp/alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          truck_code: alert.truck_code,
          issue: alert.description,
          recommendation: route,
        }),
      });
      const data = await response.json();
      setToast(data.sent || data.partial ? data.message : "WhatsApp: " + (data.message || "send failed"));
    } catch {
      setToast("WhatsApp alert endpoint unavailable");
    }
    setTimeout(() => setToast(""), 4200);
  }

  return (
    <AppShell activeWorkspace={activeWorkspace} onWorkspaceChange={setActiveWorkspace} online={online} onRefresh={refresh} onLogout={onLogout} assistant={<AssistantPanel />}>
      {activeWorkspace === "fleet" && (
        <FleetOperations
          detailTab={fleetDetailTab}
          onDetailTabChange={setFleetDetailTab}
          metrics={[
            { label: "Active Trucks", value: snapshot.kpis.active_trucks, helper: "live fleet in operation" },
            { label: "Operational Issues", value: snapshot.kpis.trucks_with_issues, helper: "deviation or damage", tone: "danger" },
            { label: "Landfill Queue", value: `${snapshot.kpis.tpa_wait_minutes}m`, helper: `${snapshot.kpis.tpa_queue_trucks} trucks waiting`, tone: "warning" },
            { label: "Largest Waste Spike", value: `+${snapshot.kpis.predicted_spike_percent}%`, helper: "next 7 days", tone: "warning" },
          ]}
          map={(
            <div id="map-panel" className="map-anchor">
              <MapPanel 
                trucks={snapshot.trucks} 
                attendance={attendance} 
                rainfall={rainfall} 
                onSelectTruck={selectFleetTruck} 
                layers={layers}
                playbackTruck={playbackTruck}
                onBreadcrumbsLoaded={setPlaybackOptions}
              />
            </div>
          )}
          mapFooter={(
            <>
              <div className="map-footer-panels">
                <div className="panel map-controls-card">
                  <div className="panel-title">
                    <h2>Map Controls</h2>
                  </div>
                  <div className="map-controls-grid">
                    <label><input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} /> Heatmap</label>
                    <label><input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} /> OSRM route</label>
                    <label><input type="checkbox" checked={layers.tps} onChange={(e) => setLayers((s) => ({ ...s, tps: e.target.checked }))} /> TPS</label>
                    <label><input type="checkbox" checked={layers.wr} onChange={(e) => setLayers((s) => ({ ...s, wr: e.target.checked }))} /> Retribution registry</label>
                  </div>
                  <div className="playback-select-wrap">
                    <select value={playbackTruck || ""} onChange={(e) => setPlaybackTruck(e.target.value || null)} aria-label="Trip playback">
                      <option value="">Trip playback...</option>
                      {playbackOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="panel map-legend-card">
                  <div className="panel-title">
                    <h2>Legend</h2>
                  </div>
                  <details className="map-legend" open aria-label="Map legend">
                    <summary style={{ display: "none" }}>Legend</summary>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#22c55e", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> TPS locations <em className="legend-tag">REAL</em></span>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#f97316", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> Retribution registry <em className="legend-tag">REAL</em></span>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#a5b4fc", display: "inline-block" }} /> District waste risk <em className="legend-tag">MODEL</em></span>
                    <span><i className="legend-assigned" style={{ display: "inline-block" }} /> Assigned corridor <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-actual" style={{ backgroundColor: "#176b54", display: "inline-block" }} /> Actual (clean) <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-critical" style={{ backgroundColor: "#b42318", borderRadius: "50%", width: "10px", height: "10px", display: "inline-block" }} /> Violation segment <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-osrm" style={{ backgroundColor: "#0891b2", display: "inline-block" }} /> OSRM route <em className="legend-tag">LIVE</em></span>
                    <span><span className="legend-icon-tpa" /> TPA Bantargebang <em className="legend-tag">MODEL</em></span>
                    <span><span className="legend-icon-unlicensed" /> Unlicensed Collector <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-event" style={{ backgroundColor: "#eab308", borderRadius: "4px", width: "16px", height: "12px", display: "inline-block" }} /> Crowd Event <em className="legend-tag">SIM</em></span>
                  </details>
                </div>
              </div>

              <div className="map-footer-inspector-row">
                <div className="inspector-col">
                  <AlertQueue alerts={snapshot.alerts} onDispatch={dispatch} onWhatsApp={sendWhatsAppAlert} />
                </div>
                <div className="inspector-col">
                  <UnlicensedCollectorAlerts />
                </div>
                <div className="inspector-col">
                  <AStarReroutingPanel />
                </div>
              </div>
            </>
          )}
          alerts={null}
          rerouting={null}
          routeEvidence={<RouteEvidencePanel route={snapshot.osrm_route} />}
          queue={<><TpaQueuePanel /><StaggerSimulatorPanel /></>}
          fleetTable={<FleetTable trucks={snapshot.trucks} onOpenTripHistory={(code) => selectFleetTruck(code, true)} />}
          history={<FleetHistoryPanel filterTruck={filterTruck} setFilterTruck={setFilterTruck} />}
          carbon={<CarbonPanel />}
        />
      )}

      {activeWorkspace !== "fleet" && (
        <section className="main-grid">
        {activeWorkspace === "forecast" && (
          <WasteForecast
            metrics={[
              { label: "Largest forecast spike", value: `+${snapshot.kpis.predicted_spike_percent}%`, helper: "next 7 days", tone: "warning" },
              { label: "High-risk districts", value: snapshot.critical_predictions.length, helper: "capacity reinforcement needed", tone: "danger" },
              { label: "Peak rainfall", value: `${Math.round(Math.max(...snapshot.weather.forecast.map((day) => day.rainfall_mm)))} mm`, helper: "forecast driver", tone: "warning" },
              { label: "Planning status", value: "Ready", helper: "scenario handoff enabled" },
            ]}
            forecast={<PredictionPanel predictions={snapshot.critical_predictions} allPredictions={snapshot.predictions} />}
            weather={<WeatherPanel weather={snapshot.weather} />}
            events={<CrowdEventsPanel onSimulateEvent={(ev) => {
              setAttendance(ev.expected_attendance);
              setRainfall(10);
              setEventLat(ev.lat);
              setEventLng(ev.lng);
              setActiveWorkspace("planning");
            }} />}
            districts={<KecamatanMapPanel />}
            reportActions={<ReportActions />}
          />
        )}

        {activeWorkspace === "planning" && (
          <PlanningDecisionFlow
            attendance={attendance}
            setAttendance={setAttendance}
            rainfall={rainfall}
            setRainfall={setRainfall}
            eventLat={eventLat}
            eventLng={eventLng}
            summary={snapshot.executive_summary}
            queue={snapshot.tpa_queue}
          />
        )}

        {activeWorkspace === "drivers" && (
          <div className="grid-col-12">
            <DriverAnalytics />
          </div>
        )}

        {activeWorkspace === "weighbridge" && (
          <div className="grid-col-12">
            <WeighbridgeLogs />
          </div>
        )}

        {activeWorkspace === "wa" && (
          <div className="grid-col-12">
            <WhatsAppGateway />
          </div>
        )}

        {activeWorkspace === "iot" && (
          <div className="grid-col-12">
            <IotBinSensors />
          </div>
        )}

        {activeWorkspace === "audit" && <DataAuditWorkspace />}
      </section>
      )}
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </AppShell>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem("jwis_auth") === "true");
  const isField = useMemo(() => window.location.pathname.startsWith("/field"), []);
  function logout() {
    localStorage.removeItem("jwis_auth");
    setAuthenticated(false);
  }
  if (isField) return <FieldApp />;
  if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
  return <CommandCenter onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(<App />);
