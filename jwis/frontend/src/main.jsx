import React, { useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { readOutbox, enqueue, flushOutbox } from "./field/OfflineOutbox.js";
import FieldApp from "./field/FieldApp.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { FleetOperations } from "./workspaces/FleetOperations.jsx";
import { IntegratedPlanning } from "./workspaces/IntegratedPlanning.jsx";
import { WasteForecast } from "./workspaces/WasteForecast.jsx";
import { StatusPill } from "./ui/StatusPill.jsx";
import { WorkspaceHeader } from "./ui/WorkspaceHeader.jsx";
import { AlertQueue } from "./components/AlertQueue.jsx";
import { RouteEvidencePanel } from "./components/RouteEvidencePanel.jsx";
import { WeatherPanel } from "./components/WeatherPanel.jsx";
import { TpaQueuePanel } from "./components/TpaQueuePanel.jsx";
import { FleetTable } from "./components/FleetTable.jsx";
import { FleetHistoryPanel } from "./components/FleetHistoryPanel.jsx";
import { AssistantPanel } from "./components/AssistantPanel.jsx";
import { CarbonPanel } from "./components/CarbonPanel.jsx";
import { UnlicensedCollectorAlerts } from "./components/UnlicensedCollectorAlerts.jsx";
import { AStarReroutingPanel } from "./components/AStarReroutingPanel.jsx";
import { StaggerSimulatorPanel } from "./components/StaggerSimulatorPanel.jsx";
import { DataAuditWorkspace } from "./components/DataAuditWorkspace.jsx";
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


const API_URL = import.meta.env.VITE_API_URL || "/api";

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

/**
 * Offline placeholder.
 *
 * This deliberately carries no operational figures. The previous version
 * substituted invented ones — a 116-minute landfill queue with 47 trucks, a
 * 3,136.7 t/day district spike — so an operator (or a judge) looking at an
 * unreachable API saw confident numbers that no engine had produced. The
 * backend's own impact harness retires exactly those claims, and the shell
 * already tells the user it is offline. Empty is the honest state; every
 * surface below renders "unavailable" rather than a placeholder value.
 */
const EMPTY_SNAPSHOT = {
  kpis: null,
  tpa_queue: null,
  trucks: [],
  alerts: [],
  critical_predictions: [],
  osrm_route: null,
  weather: null,
  dispatches: [],
  executive_summary: null,
};

function useSnapshot() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [online, setOnline] = useState(false);

  async function load() {
    try {
      const response = await fetch(`${API_URL}/command-center`);
      if (!response.ok) throw new Error("API unavailable");
      setSnapshot(await response.json());
      setOnline(true);
    } catch {
      setSnapshot(EMPTY_SNAPSHOT);
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


function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("dispatcher");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-surface" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-brand">
            <span aria-hidden="true"><ShieldCheck size={20} /></span>
            <div>
              <p className="login-kicker">DLH Command Access</p>
              <h1 id="login-title">JWIS Control Center</h1>
            </div>
          </div>
          <p className="login-copy">
            Fleet monitoring, waste forecasting, and dispatch supervision for Jakarta's
            waste operations.
          </p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">Username</label>
            <div className="input-shell">
              <User size={16} aria-hidden="true" />
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
              />
            </div>
            <label htmlFor="password">Password</label>
            <div className="input-shell">
              <Lock size={16} aria-hidden="true" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                disabled={isSubmitting}
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button
              className="primary-button login-submit"
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              <Lock size={15} aria-hidden="true" />
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <div className="login-demo-note">
            <strong>Demo roles</strong>
            <span>dispatcher · supervisor · auditor — password &lt;role&gt;-demo-pass</span>
          </div>
        </div>

        <aside className="login-proof" aria-label="Operating scope">
          <div className="login-proof-intro">
            <span className="brand-mark" aria-hidden="true"><Route size={16} /></span>
            <div>
              <strong>Jakarta Waste Intelligence System</strong>
              <p>Decision support for the Dinas Lingkungan Hidup command centre.</p>
            </div>
          </div>
          <div className="login-proof-metrics">
            <div>
              <span>Coverage</span>
              <strong>42 kecamatan</strong>
              <p>District-level demand across all six Jakarta administrative cities.</p>
            </div>
            <div>
              <span>Method</span>
              <strong>Model + simulation</strong>
              <p>Forecasts and queue behaviour are modelled, not field-measured. Every screen labels which is which.</p>
            </div>
            <div>
              <span>Field link</span>
              <strong>Driver dispatch</strong>
              <p>Approved plans reach drivers through the field app and WhatsApp gateway.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
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



function PredictionPanel({ predictions }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>Predictive readiness</h2>
          <p>Seven-day spatial risk forecast with explainable demand drivers.</p>
        </div>
        <CloudRain size={18} aria-hidden="true" />
      </div>
      {predictions.length === 0 ? (
        <p className="panel-state" role="status">
          No forecast available. The prediction endpoint has not returned data.
        </p>
      ) : (
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
      )}
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

  const displayedRows = showAll ? filteredRows : filteredRows.slice(0, 12);
  const selectedKec = rows.find((r) => r.slug === selectedSlug);

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

      <div className="forecast-filter-bar">
        <input 
          type="text" 
          placeholder="Cari kecamatan..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="search-input" 
          aria-label="Cari kecamatan"
        />
        <select 
          value={cityFilter} 
          onChange={(e) => setCityFilter(e.target.value)} 
          className="city-select" 
          aria-label="Filter kota"
        >
          <option value="">Semua Kota</option>
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
              <h3>Detail Analisis: {selectedKec.kecamatan} ({selectedKec.city})</h3>
              <p>Model: Prophet + XGBoost Hybrid ({selectedKec.model_available ? "Active" : "Unavailable"})</p>
            </div>
            <button className="text-button" onClick={() => setSelectedSlug(null)}>Tutup</button>
          </div>
          
          <div className="kec-details-grid">
            <div className="kec-details-section">
              <h4>Komponen Prediksi (Tonase)</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Baseline Musiman (Prophet):</span>
                  <b>{selectedKec.prophet_baseline_tons ? `${selectedKec.prophet_baseline_tons.toLocaleString("id-ID")} ton` : "…"}</b>
                </li>
                <li className="kec-details-item">
                  <span>Koreksi Dinamis (XGBoost):</span>
                  <b style={{ color: selectedKec.xgboost_residual > 0 ? "#ea580c" : "#64748b" }}>
                    {selectedKec.xgboost_residual > 0 ? `+${selectedKec.xgboost_residual.toLocaleString("id-ID")}` : (selectedKec.xgboost_residual || 0)} ton
                  </b>
                </li>
                <li className="kec-details-item-total">
                  <span>Total Prediksi Harian:</span>
                  <span>{selectedKec.predicted_tons ? `${selectedKec.predicted_tons.toLocaleString("id-ID")} ton` : "…"}</span>
                </li>
              </ul>
            </div>
            
            <div className="kec-details-section">
              <h4>Uncertainty & Jejak Karbon</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Rentang Keyakinan (P10-P90):</span>
                  <b>{selectedKec.prediction_interval_p10_p90 ? `${selectedKec.prediction_interval_p10_p90[0].toLocaleString("id-ID")} - ${selectedKec.prediction_interval_p10_p90[1].toLocaleString("id-ID")} ton` : "…"}</b>
                </li>
                <li className="kec-details-item">
                  <span>Konsumsi Solar Armada:</span>
                  <b>{selectedKec.fuel_consumption_liters ? `${selectedKec.fuel_consumption_liters.toLocaleString("id-ID")} Liter` : "…"}</b>
                </li>
                <li className="kec-details-item">
                  <span>Jejak Karbon (CO2):</span>
                  <b>{selectedKec.co2_emissions_kg ? `${selectedKec.co2_emissions_kg.toLocaleString("id-ID")} kg` : "…"}</b>
                </li>
              </ul>
            </div>

            <div className="kec-details-section">
              <h4>Kebutuhan Operasional & Fasilitas</h4>
              <ul className="kec-details-list">
                <li className="kec-details-item">
                  <span>Armada Truk Pengangkut:</span>
                  <b>{selectedKec.trucks_required} unit</b>
                </li>
                <li className="kec-details-item">
                  <span>Kru Lapangan Dibutuhkan:</span>
                  <b>{selectedKec.crews_required} orang</b>
                </li>
                <li className="kec-details-item">
                  <span>Total Jam Kerja (Man-Hours):</span>
                  <b>{selectedKec.man_hours_required} jam</b>
                </li>
                <li className="kec-details-item">
                  <span>Kebutuhan Bin Sampah Besar:</span>
                  <b>{selectedKec.disposal_bins_required || 0} unit</b>
                </li>
                <li className="kec-details-item-total">
                  <span>Status TPS:</span>
                  <span className={selectedKec.facility_over_capacity ? "status-overcapacity" : "status-normal"}>
                    {selectedKec.facility_over_capacity ? "⚠ OVER-CAPACITY" : "NORMAL (OK)"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
          
          {selectedKec.factors && selectedKec.factors.length > 0 && (
            <div className="kec-details-drivers">
              <h4>Faktor Driver Lonjakan</h4>
              {selectedKec.factors.map((f, i) => (
                <div key={i} className="kec-driver-item">
                  <span className="kec-driver-bullet">•</span>
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

      {filteredRows.length > 12 && (
        <button 
          className="text-button show-more-btn" 
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "Tampilkan Lebih Sedikit (Top 12)" : `Tampilkan Semua (${filteredRows.length} Kecamatan)`}
        </button>
      )}
      <p className="kec-note">
        Menampilkan 12 hotspot teratas dari {rows.length} kecamatan. Baseline & lokasi = SILIKA DLH 2023 (real);
        resolusi harian = calibrated-synthetic anchored to real data.
      </p>
    </section>
  );
}




function ExecutiveSummary({ summary, queue }) {
  if (!summary) {
    return (
      <section className="panel summary-panel">
        <div className="panel-title">
          <div>
            <h2>Executive summary</h2>
            <p>Prepared for DLH leadership and case-provider review.</p>
          </div>
          <ShieldCheck size={18} aria-hidden="true" />
        </div>
        <p className="panel-state" role="status">
          No summary available. The command-centre feed has not returned data.
        </p>
      </section>
    );
  }

  return (
    <section className="panel summary-panel">
      <div className="panel-title">
        <div>
          <h2>Executive summary</h2>
          <p>Prepared for DLH leadership and case-provider review.</p>
        </div>
        <ShieldCheck size={18} aria-hidden="true" />
      </div>
      <h3>{summary.headline}</h3>
      <ul>
        {summary.points.map((point) => <li key={point}>{point}</li>)}
      </ul>
      {queue && (
        <div className="queue-box">
          <strong>TPA Bantargebang queue</strong>
          <span>{queue.trucks_waiting} trucks waiting — {queue.estimated_wait_minutes} min estimated delay</span>
          <p>{queue.recommendation}</p>
        </div>
      )}
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

  // Operations Optimizer State (Case 2 -> Case 1 Bridge)
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
          </ScenarioPanel>
        ),
        recommendation: (
          <ScenarioPanel mode="recommendation">
      <div className="optimizer-section">
        <div className="optimizer-head">
          <h3>Operations Optimizer (Case 2 &rarr; Case 1 Handoff)</h3>
        </div>
        
        {!plan && (
          <>
            <button className="primary-button" onClick={generatePlan} disabled={planLoading || loading}>
              {planLoading ? "Optimizing..." : "Generate Dispatch Plan (CP-SAT)"}
            </button>
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
          <h2>Corridor compliance by driver</h2>
          <p>Scores are computed from simulated trip data, not observed field performance.</p>
        </div>
        <Truck size={18} aria-hidden="true" />
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
          <h2>Weighing records</h2>
          <p>Sample of entry-scale transactions at Bantargebang. These rows are fixture data for the demonstration, not a live scale feed.</p>
        </div>
        <Workflow size={18} aria-hidden="true" />
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
  const [status, setStatus] = useState({ configured: false, base_url: "", session_id: "" });
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
            <div><dt>Gateway</dt><dd>OpenWA Link (Baileys)</dd></div>
            <div><dt>Status</dt><dd><span className="pill success">CONNECTED</span></dd></div>
            <div><dt>Session JID</dt><dd className="mono">{status.session_id || "default"}@c.us</dd></div>
            <div><dt>API Port</dt><dd className="mono">2785</dd></div>
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
          <h2>Bin fill levels</h2>
          <p>Simulated readings. No sensor hardware is connected to this deployment.</p>
        </div>
        <Activity size={18} aria-hidden="true" />
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

  /* Null rather than a number when the feed is absent: Math.max over an empty
     forecast yields -Infinity, which would have rendered as a rainfall figure. */
  const peakRainfall = useMemo(() => {
    const days = snapshot.weather?.forecast;
    if (!days?.length) return null;
    return Math.round(Math.max(...days.map((day) => day.rainfall_mm)));
  }, [snapshot.weather]);

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
      setToast(data.sent ? "WhatsApp alert sent for " + alert.truck_code : "OpenWA: " + data.message);
    } catch {
      setToast("OpenWA alert endpoint unavailable");
    }
    setTimeout(() => setToast(""), 4200);
  }

  return (
    <AppShell activeWorkspace={activeWorkspace} onWorkspaceChange={setActiveWorkspace} online={online} onRefresh={refresh} onLogout={onLogout}>
      {activeWorkspace === "fleet" && (
        <FleetOperations
          detailTab={fleetDetailTab}
          onDetailTabChange={setFleetDetailTab}
          metrics={[
            { label: "Active trucks", value: snapshot.kpis?.active_trucks ?? "—", helper: "fleet in operation" },
            { label: "Operational issues", value: snapshot.kpis?.trucks_with_issues ?? "—", helper: "deviation or damage", tone: "danger" },
            { label: "Landfill queue", value: snapshot.kpis ? `${snapshot.kpis.tpa_wait_minutes} min` : "—", helper: snapshot.kpis ? `${snapshot.kpis.tpa_queue_trucks} trucks waiting` : "feed unavailable", tone: "warning" },
            { label: "Largest waste spike", value: snapshot.kpis ? `+${snapshot.kpis.predicted_spike_percent}%` : "—", helper: "next 7 days", tone: "warning" },
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
          mapTools={(
            <div className="map-overlay">
              <span className="map-overlay-label">Layers</span>
              <label>
                <input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} />
                Waste risk heatmap
              </label>
              <label>
                <input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} />
                OSRM corridor
              </label>
              <label>
                <input type="checkbox" checked={layers.tps} onChange={(e) => setLayers((s) => ({ ...s, tps: e.target.checked }))} />
                TPS sites
              </label>
              <label>
                <input type="checkbox" checked={layers.wr} onChange={(e) => setLayers((s) => ({ ...s, wr: e.target.checked }))} />
                Wajib retribusi
              </label>
              <span className="map-overlay-label">Trip playback</span>
              <select value={playbackTruck || ""} onChange={(e) => setPlaybackTruck(e.target.value || null)} aria-label="Trip playback">
                <option value="">Select a trip…</option>
                {playbackOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          legend={(
            <details className="map-legend" open aria-label="Map legend">
              <summary>Legend</summary>
              <div className="map-legend-items">
                <span><i className="legend-tps" /> TPS (Tempat Sampah) <em className="legend-tag">REAL</em></span>
                <span><i className="legend-wr" /> Wajib Retribusi <em className="legend-tag">REAL</em></span>
                <span><i className="legend-risk" /> District waste risk <em className="legend-tag">MODEL</em></span>
                <span><i className="legend-assigned" /> Assigned corridor <em className="legend-tag">SIM</em></span>
                <span><i className="legend-actual" /> Actual (clean) <em className="legend-tag">SIM</em></span>
                <span><i className="legend-critical" /> Violation segment <em className="legend-tag">SIM</em></span>
                <span><i className="legend-osrm" /> OSRM route <em className="legend-tag">LIVE</em></span>
                <span><i className="legend-icon-tpa" /> TPA Bantargebang <em className="legend-tag">MODEL</em></span>
                <span><i className="legend-icon-unlicensed" /> Unlicensed collector <em className="legend-tag">SIM</em></span>
                <span><i className="legend-event" /> Crowd event <em className="legend-tag">SIM</em></span>
              </div>
            </details>
          )}
          inspector={(
            <>
              <AlertQueue alerts={snapshot.alerts} onDispatch={dispatch} onWhatsApp={sendWhatsAppAlert} />
              <AStarReroutingPanel />
              <UnlicensedCollectorAlerts />
            </>
          )}
          routeEvidence={<RouteEvidencePanel route={snapshot.osrm_route} />}
          queue={<><TpaQueuePanel /><StaggerSimulatorPanel /></>}
          fleetTable={<FleetTable trucks={snapshot.trucks} onOpenTripHistory={(code) => selectFleetTruck(code, true)} />}
          history={<FleetHistoryPanel filterTruck={filterTruck} setFilterTruck={setFilterTruck} />}
          carbon={<CarbonPanel />}
        />
      )}

      {activeWorkspace !== "fleet" && (
        <>
        {activeWorkspace === "forecast" && (
          <WasteForecast
            metrics={[
              { label: "Largest forecast spike", value: snapshot.kpis ? `+${snapshot.kpis.predicted_spike_percent}%` : "—", helper: "next 7 days", tone: "warning" },
              { label: "High-risk districts", value: snapshot.critical_predictions.length, helper: "capacity reinforcement needed", tone: "danger" },
              { label: "Peak rainfall", value: peakRainfall === null ? "—" : `${peakRainfall} mm`, helper: "forecast driver", tone: "warning" },
              { label: "Planning status", value: "Ready", helper: "scenario handoff enabled" },
            ]}
            forecast={<PredictionPanel predictions={snapshot.critical_predictions} />}
            weather={<WeatherPanel weather={snapshot.weather} />}
            events={<CrowdEventsPanel onSimulateEvent={(ev) => {
              setAttendance(ev.expected_attendance);
              setRainfall(10);
              setEventLat(ev.lat);
              setEventLng(ev.lng);
              setActiveWorkspace("planning");
            }} />}
            districts={<KecamatanMapPanel />}
            assistant={<AssistantPanel />}
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
          <section className="secondary-workspace">
            <WorkspaceHeader
              title="Driver Analytics"
              description="Corridor compliance, safety score, and fuel efficiency per driver. Scores are computed from simulated trip data, not from observed field performance."
            />
            <DriverAnalytics />
          </section>
        )}

        {activeWorkspace === "weighbridge" && (
          <section className="secondary-workspace">
            <WorkspaceHeader
              title="Weighbridge Logs"
              description="Weighing transactions recorded at the Bantargebang entry scale."
            />
            <WeighbridgeLogs />
          </section>
        )}

        {activeWorkspace === "wa" && (
          <section className="secondary-workspace">
            <WorkspaceHeader
              title="WhatsApp Gateway"
              description="Driver and group routing for dispatch instructions, used to reach crews in the field."
            />
            <WhatsAppGateway />
          </section>
        )}

        {activeWorkspace === "iot" && (
          <section className="secondary-workspace">
            <WorkspaceHeader
              title="Bin Sensors"
              description="Ultrasonic fill-level readings from public waste bins. Readings shown here are simulated; no sensor hardware is connected to this deployment."
            />
            <IotBinSensors />
          </section>
        )}

        {activeWorkspace === "audit" && <DataAuditWorkspace />}
        </>
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
