import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { readOutbox, enqueue, flushOutbox } from "./field/OfflineOutbox.js";
import FieldApp from "./field/FieldApp.jsx";
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

function useSnapshot() {
  const [snapshot, setSnapshot] = useState(fallbackSnapshot);
  const [online, setOnline] = useState(false);

  async function load() {
    try {
      const response = await fetch(`${API_URL}/command-center`);
      if (!response.ok) throw new Error("API unavailable");
      setSnapshot(await response.json());
      setOnline(true);
    } catch {
      setSnapshot(fallbackSnapshot);
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
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span><ShieldCheck size={22} /></span>
          <div>
            <p className="eyebrow">DLH Command Access</p>
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
          <strong>Demo roles</strong>
          <span>dispatcher / supervisor / auditor · password &lt;role&gt;-demo-pass</span>
        </div>
      </section>
      <aside className="login-proof">
        <div>
          <span className="metric-label">Queue (simulated)</span>
          <strong>discrete-event</strong>
          <p>landfill waiting-time reduction from seeded simulation.</p>
        </div>
        <div>
          <span className="metric-label">Coverage</span>
          <strong>Case 1 + 2</strong>
          <p>fleet supervision, route compliance, forecasting, and resource planning.</p>
        </div>
      </aside>
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

function MapPanel({ trucks, onSelectTruck }) {
  return (
    <section className="panel map-panel">
      <div className="panel-title">
        <div>
          <h2>Live Fleet Supervision</h2>
          <p>MapLibre tracking of assigned corridors, actual movement, and field status. Positions are simulated, not live GPS.</p>
        </div>
        <StatusPill tone="warning"><Radio size={14} /> Simulation</StatusPill>
      </div>
      <LiveFleetMap trucks={trucks} onSelectTruck={onSelectTruck} />
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
        {alerts.map((alert) => (
          <article className="alert-item" key={alert.id}>
            <div className="alert-head">
              <AlertTriangle size={18} />
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.description}</p>
              </div>
            </div>
            {alert.recommended_routes?.[0] && (
              <div className="route-rec">
                <Route size={17} />
                <div>
                  <strong>{alert.recommended_routes[0].name}</strong>
                  <span>{alert.recommended_routes[0].eta_minutes} min ETA - score {alert.recommended_routes[0].score}</span>
                </div>
              </div>
            )}
            <div className="alert-actions">
              <button className="primary-button" onClick={() => onDispatch(alert)}>
                <Send size={16} /> Approve &amp; Dispatch
              </button>
              <button className="ghost-button alert-wa-button" onClick={() => onWhatsApp(alert)}>
                <MessageCircle size={16} /> WA Alert
              </button>
            </div>
          </article>
        ))}
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

function PredictionPanel({ predictions }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Predictive Readiness</h2>
          <p>Seven-day spatial risk forecast with explainable demand drivers.</p>
        </div>
        <CloudRain size={20} />
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

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>Peta Timbulan Sampah per Kecamatan (Case 2)</h2>
          <p>
            Prediksi hybrid Prophet+XGBoost untuk {data?.kecamatan_count || 42} kecamatan DKI,
            di-anchor ke timbulan resmi SILIKA DLH 2023. Total prediksi:{" "}
            <b>{data?.total_predicted_tons?.toLocaleString("id-ID") || "…"} ton/hari</b>.
          </p>
        </div>
        <MapPinned size={20} />
      </div>

      <div className="scenario-controls">
        <label>Curah hujan (mm): <b>{rain}</b>
          <input type="range" min="0" max="60" value={rain} onChange={(e) => setRain(+e.target.value)} />
        </label>
        <label>Event pengunjung: <b>{attendance.toLocaleString("id-ID")}</b>
          <input type="range" min="0" max="200000" step="5000" value={attendance} onChange={(e) => setAttendance(+e.target.value)} />
        </label>
        <label className="scenario-check">
          <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} /> Weekend
        </label>
        <button className="primary-button" onClick={load} disabled={loading}>
          {loading ? "Menghitung…" : "Prediksi ulang"}
        </button>
      </div>

      <div className="kec-list">
        {rows.slice(0, 12).map((k) => (
          <article className="kec-row" key={k.slug}>
            <div className="kec-head">
              <strong>{k.kecamatan}</strong>
              <span>{k.city}</span>
            </div>
            <div className="bar" aria-label={`${k.predicted_tons} ton`}>
              <span style={{ width: `${Math.min(100, (k.predicted_tons / maxTons) * 100)}%` }} />
            </div>
            <div className="kec-meta">
              <b>{k.predicted_tons.toLocaleString("id-ID")} t</b>
              <span>{k.trucks_required} truk · {k.crews_required} kru · {k.man_hours_required} m-hr</span>
              <span className="kec-facility" style={{ color: readinessColor[k.facility_readiness] }}>
                {k.facility_over_capacity ? "⚠ TPS over-capacity" : "TPS " + k.facility_readiness}
              </span>
            </div>
          </article>
        ))}
      </div>
      <p className="kec-note">
        Menampilkan 12 hotspot teratas dari {rows.length} kecamatan. Baseline & lokasi = SILIKA DLH 2023 (real);
        resolusi harian = calibrated-synthetic anchored to real data.
      </p>
    </section>
  );
}

function WeatherPanel({ weather }) {
  const forecast = weather?.forecast || [];
  const peak = forecast.reduce(
    (best, item) => (item.waste_impact_percent > (best?.waste_impact_percent || 0) ? item : best),
    forecast[0],
  );

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
            <strong>{new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}</strong>
            <span>{Math.round(day.rainfall_mm)} mm</span>
            <small>{Math.round(day.temperature_min_c)}-{Math.round(day.temperature_max_c)} C</small>
          </article>
        ))}
      </div>
      {peak && <p className="weather-advice">{peak.operational_advice}</p>}
    </section>
  );
}

function FleetTable({ trucks }) {
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
  const [question, setQuestion] = useState("What is the highest operational risk today?");
  const [answer, setAnswer] = useState("");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);

  async function askAssistant() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await response.json();
      setAnswer(data.answer || "No answer returned.");
      setProvider(data.provider || "unknown");
    } catch {
      setAnswer("Assistant fallback unavailable. Check API server.");
      setProvider("offline");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel assistant-panel">
      <div className="panel-title">
        <div>
          <h2>Operational AI Assistant</h2>
          <p>Natural language query endpoint; uses OpenAI when OPENAI_API_KEY is configured.</p>
        </div>
        <Bot size={20} />
      </div>
      <label className="field-label" htmlFor="assistant-question">Question</label>
      <textarea
        id="assistant-question"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={3}
      />
      <button className="primary-button" onClick={askAssistant} disabled={loading}>
        <Send size={16} /> {loading ? "Analyzing..." : "Ask JWIS"}
      </button>
      {answer && (
        <article className="assistant-answer">
          <StatusPill tone={provider === "openai" ? "success" : "warning"}>{provider}</StatusPill>
          <p>{answer}</p>
        </article>
      )}
    </section>
  );
}

function ScenarioPanel() {
  const [attendance, setAttendance] = useState(85000);
  const [rainfall, setRainfall] = useState(42);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        rainfall_mm: String(rainfall),
        event_attendance: String(attendance),
        is_weekend: "true",
      });
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
  }, []);

  const top5 = (data?.top_hotspots || []).slice(0, 5);
  const totalTons = data?.total_predicted_tons || 0;
  const manHours = top5.reduce((s, k) => s + (k.man_hours_required || 0), 0);
  const crews = top5.reduce((s, k) => s + (k.crews_required || 0), 0);
  const trucks = top5.reduce((s, k) => s + (k.trucks_required || 0), 0);
  const bins = top5.reduce((s, k) => s + (k.disposal_bins_required || 0), 0);

  return (
    <section className="panel scenario-panel">
      <div className="panel-title">
        <div>
          <h2>Event Scenario Simulator (Case 2)</h2>
          <p>Skenario cuaca + keramaian dijalankan melalui model hybrid 42 kecamatan (live), bukan estimasi statis.</p>
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
          {loading ? "Menghitung…" : "Jalankan skenario"}
        </button>
      </div>
      <div className="scenario-result">
        <strong>Total prediksi {totalTons.toLocaleString("id-ID")} ton/hari ({data?.kecamatan_count || 42} kecamatan)</strong>
        <span>Puncak: {top5[0]?.kecamatan || "…"} — {top5[0]?.predicted_tons?.toLocaleString("id-ID") || "…"} ton</span>
      </div>
      <div className="scenario-reqs">
        <div className="req-chip"><b>{manHours}</b><span>man-hours (top 5)</span></div>
        <div className="req-chip"><b>{crews}</b><span>field crews (top 5)</span></div>
        <div className="req-chip"><b>{trucks}</b><span>trucks (top 5)</span></div>
        <div className="req-chip"><b>{bins}</b><span>large bins (top 5)</span></div>
      </div>
    </section>
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
          <h2>Bantargebang Landfill Queue Status (Case 1)</h2>
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
        <h3>Latest Weighbridge Log:</h3>
        <ul>
          {queue.scale_logs?.map((log, i) => (
            <li key={i}>
              <span className="time">{log.time}</span> - 
              <span className="truck"> {log.truck}</span> | 
              <span className="weight"> {log.weight_ton} ton</span> | 
              <span className={`status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}


function CrowdEventsPanel() {
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
          <h2>Crowd Permit & Waste-Volume Forecast (Case 2)</h2>
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
                <strong>{ev.predicted_waste_tons} ton</strong>
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
                <strong>{ev.large_bins_required} unit</strong>
              </div>
            </div>
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
          <h2>A* Dynamic Rerouting (Case 1)</h2>
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
        dispatch_slots: [],
      });
    }
    setLoading(false);
  }

  return (
    <section className="panel stagger-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang Queue Optimization (Case 1)</h2>
          <p>Staggered-dispatch simulation to reduce landfill waiting time.</p>
        </div>
        <ClipboardList size={20} />
      </div>
      <button className="primary-button" onClick={runSimulation} disabled={loading}>
        {loading ? "Calculating..." : "Run Dispatch Simulation"}
      </button>
      {result && (
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
      )}
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
        <li>Kelurahan waste-risk heatmap layer</li>
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

function VoicePanel({ onCommand }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      handleVoiceCommand(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  function speak(message) {
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(message);
      utter.lang = "en-US";
      window.speechSynthesis.speak(utter);
    }
  }

  function handleVoiceCommand(text) {
    const lower = text.toLowerCase();
    let response = "Command not recognized.";
    if (lower.includes("refresh") || lower.includes("reload")) {
      response = "Refreshing the command center.";
      onCommand({ type: "refresh" });
    } else if (lower.includes("truck")) {
      const match = lower.match(/t.?(\\d{3})/);
      if (match) {
        const code = "T-" + match[1];
        response = "Showing history for truck " + code + ".";
        onCommand({ type: "filter_truck", value: code });
      }
    } else if (lower.includes("carbon")) {
      response = "Showing fleet carbon footprint.";
      onCommand({ type: "scroll_carbon" });
    } else if (lower.includes("forecast") || lower.includes("prediction")) {
      response = "Showing waste-volume forecast.";
      onCommand({ type: "scroll_prediction" });
    }
    speak(response);
  }

  function toggleListening() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setTranscript("");
      recognitionRef.current.start();
      setListening(true);
    }
  }

  return (
    <section className="panel voice-panel">
      <div className="panel-title">
        <div>
          <h2>Voice Command Center</h2>
          <p>Hands-free dashboard control through the browser Web Speech API.</p>
        </div>
        <Volume2 size={20} />
      </div>
      {supported ? (
        <>
          <button className={`voice-btn ${listening ? "listening" : "idle"}`} onClick={toggleListening}>
            {listening ? <><MicOff size={18} /> Listening... click to stop</> : <><Mic size={18} /> Start Voice Command</>}
          </button>
          {transcript && <div className="voice-transcript">"{transcript}"</div>}
          <div className="voice-command-hints">
            <span><b>"Refresh"</b> - reload live data</span>
            <span><b>"Truck T-047"</b> - filter truck history</span>
            <span><b>"Carbon"</b> - show fleet footprint</span>
            <span><b>"Forecast"</b> - show waste-volume forecast</span>
          </div>
        </>
      ) : (
        <div className="voice-transcript">This browser does not support the Web Speech API. Use the latest Chrome or Edge.</div>
      )}
    </section>
  );
}

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
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#98a2b3", padding: "20px" }}>No trip history for this filter.</td></tr>
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

// ── COMMAND CENTER (main dashboard) ──────────────────────────────────

function CommandCenter({ onLogout }) {
  const { snapshot, online, refresh } = useSnapshot();
  const [toast, setToast] = useState("");
  const [filterTruck, setFilterTruck] = useState("ALL");

  function handleVoiceCommand(cmd) {
    if (cmd.type === "refresh") refresh();
    else if (cmd.type === "filter_truck") setFilterTruck(cmd.value);
    else if (cmd.type === "scroll_carbon") {
      const el = document.getElementById("carbon-panel");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else if (cmd.type === "scroll_prediction") {
      const el = document.querySelector(".prediction-list");
      if (el) el.scrollIntoView({ behavior: "smooth" });
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
      setToast(data.sent ? "WhatsApp alert sent for " + alert.truck_code : "OpenWA: " + data.message);
    } catch {
      setToast("OpenWA alert endpoint unavailable");
    }
    setTimeout(() => setToast(""), 4200);
  }

  return (
    <div className="dashboard-frame">
      <aside className="side-rail" aria-label="JWIS navigation">
        <div className="side-brand">
          <span><ShieldCheck size={22} /></span>
          <div>
            <strong>JWIS</strong>
            <small>DLH Command</small>
          </div>
        </div>
        <nav className="side-nav">
          <a href="#overview"><Activity size={17} /> Overview</a>
          <a href="#map-panel"><MapPinned size={17} /> Fleet map</a>
          <a href="#history-panel"><History size={17} /> History</a>
          <a href="#carbon-panel"><Leaf size={17} /> Carbon</a>
        </nav>
        <button className="side-logout" onClick={onLogout}>
          <LogOut size={17} /> Logout
        </button>
      </aside>
      <main className="app-shell" id="overview">
      <header className="topbar">
        <div>
          <h1>Jakarta Waste Intelligence System</h1>
          <p className="topbar-subtitle">Professional command dashboard for predictive waste logistics, route compliance, and field dispatch.</p>
        </div>
        <div className="top-actions">
          <StatusPill tone={online ? "success" : "warning"}>{online ? "API connected" : "offline demo"}</StatusPill>
          <a className="ghost-button" href="/field"><Truck size={16} /> Field app</a>
          <button className="icon-button" onClick={refresh} aria-label="Refresh command center"><RefreshCcw size={18} /></button>
        </div>
      </header>

      <section className="kpi-grid">
        <KpiCard icon={Truck} label="Active Trucks" value={snapshot.kpis.active_trucks} helper="live fleet in operation" />
        <KpiCard icon={AlertTriangle} label="Operational Issues" value={snapshot.kpis.trucks_with_issues} helper="deviation or damage" tone="danger" />
        <KpiCard icon={ClipboardList} label="Landfill Queue" value={`${snapshot.kpis.tpa_wait_minutes}m`} helper={`${snapshot.kpis.tpa_queue_trucks} trucks waiting`} tone="warning" />
        <KpiCard icon={Activity} label="Largest Waste Spike" value={`+${snapshot.kpis.predicted_spike_percent}%`} helper="next 7 days" tone="purple" />
      </section>

      <section className="main-grid">
        <div id="map-panel" className="map-anchor"><MapPanel trucks={snapshot.trucks} onSelectTruck={(code, dispatch) => {
          setFilterTruck(code);
          if (dispatch) {
            const el = document.getElementById("history-panel");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }
        }} /></div>
        <FleetHistoryPanel filterTruck={filterTruck} setFilterTruck={setFilterTruck} />
        <AlertQueue alerts={snapshot.alerts} onDispatch={dispatch} onWhatsApp={sendWhatsAppAlert} />
        <RouteEvidencePanel route={snapshot.osrm_route} />
        <CarbonPanel />
        <PredictionPanel predictions={snapshot.critical_predictions} />
        <KecamatanMapPanel />
        <WeatherPanel weather={snapshot.weather} />
        <VoicePanel onCommand={handleVoiceCommand} />
        <AssistantPanel />
        <ScenarioPanel />
        <StaggerSimulatorPanel />
        <AStarReroutingPanel />
        <TpaQueuePanel />
        <CrowdEventsPanel />
        <ReportActions />
        <ExecutiveSummary summary={snapshot.executive_summary} queue={snapshot.tpa_queue} />
        <FleetTable trucks={snapshot.trucks} />
      </section>
      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
      </main>
    </div>
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
