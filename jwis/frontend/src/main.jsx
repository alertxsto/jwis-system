import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { readOutbox, enqueue, flushOutbox } from "./field/OfflineOutbox.js";
import FieldApp from "./field/FieldApp.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { FleetOperations } from "./workspaces/FleetOperations.jsx";
import { IntegratedPlanning } from "./workspaces/IntegratedPlanning.jsx";
import { WasteForecast } from "./workspaces/WasteForecast.jsx";
import { LanguageProvider, useLanguage } from "./i18n.jsx";
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
  RotateCcw,
  Route,
  Search,
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
  Crosshair,
  ArrowRight,
  MapPin,
  Lock,
  LogOut,
  User,
  Workflow,
  Database,
  Shield,
  Cpu,
  Cctv,
  Factory,
  Paperclip,
} from "lucide-react";
import { lazy, Suspense } from "react";
const LiveFleetMap = lazy(() => import("./LiveFleetMap.jsx").then((m) => ({ default: m.LiveFleetMap })));
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

function StatusPill({ tone, children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function LoginPage({ onLogin }) {
  const { lang, setLang } = useLanguage();
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
      setError(lang === "id" ? "Nama pengguna atau kata sandi tidak valid." : "Invalid username or password.");
    }
  }

  return (
    <main className="login-shell">
      <section className="login-surface" aria-labelledby="login-title">
        <div className="login-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <div className="language-toggle-widget" style={{ display: "inline-flex", background: "var(--ui-surface-muted)", borderRadius: "8px", padding: "2px", border: "1px solid var(--ui-border)" }}>
              <button type="button" onClick={() => setLang("id")} style={{ padding: "3px 8px", fontSize: "11px", fontWeight: lang === "id" ? 700 : 500, borderRadius: "5px", border: 0, cursor: "pointer", background: lang === "id" ? "var(--ui-surface)" : "transparent", color: lang === "id" ? "var(--ui-accent)" : "var(--ui-muted)" }}>ID</button>
              <button type="button" onClick={() => setLang("en")} style={{ padding: "3px 8px", fontSize: "11px", fontWeight: lang === "en" ? 700 : 500, borderRadius: "5px", border: 0, cursor: "pointer", background: lang === "en" ? "var(--ui-surface)" : "transparent", color: lang === "en" ? "var(--ui-accent)" : "var(--ui-muted)" }}>EN</button>
            </div>
          </div>
          <div className="login-brand">
            <span><ShieldCheck size={22} /></span>
            <div>
              <p className="login-kicker">{lang === "id" ? "Akses Masuk Komando DLH" : "DLH Command Access"}</p>
              <h1 id="login-title">{lang === "id" ? "Pusat Kendali JWIS" : "JWIS Control Center"}</h1>
            </div>
          </div>
          <p className="login-copy">
            {lang === "id" ? "Akses resmi operator untuk pemantauan armada, prediksi timbulan sampah, dan pengawasan logistik." : "Secure operator entry for fleet monitoring, predictive waste planning, and dispatch supervision."}
          </p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">{lang === "id" ? "Nama Pengguna" : "Username"}</label>
            <div className="input-shell">
              <User size={18} />
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </div>
            <label htmlFor="password">{lang === "id" ? "Kata Sandi" : "Password"}</label>
            <div className="input-shell">
              <Lock size={18} />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={lang === "id" ? "Masukkan kata sandi" : "Enter password"}
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit">
              <Lock size={16} /> {lang === "id" ? "Masuk Sistem" : "Sign in"}
            </button>
          </form>
          <div className="login-demo-note">
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

function MapPanel({ trucks, attendance, rainfall, onSelectTruck, layers, playbackTruck, onBreadcrumbsLoaded, jamActive }) {
  return (
    <section className="panel map-panel">
      <div className="panel-title">
        <div>
          <h2>Live Fleet Supervision</h2>
          <p>MapLibre tracking of assigned corridors, actual movement, and field status. Positions are simulated, not live GPS.</p>
        </div>
        <StatusPill tone="warning"><Radio size={14} /> Simulation</StatusPill>
      </div>
      <Suspense fallback={<div className="map-loading-fallback">Loading map…</div>}>
        <LiveFleetMap 
          trucks={trucks} 
          attendance={attendance} 
          rainfall={rainfall} 
          onSelectTruck={onSelectTruck} 
          layers={layers}
          playbackTruck={playbackTruck}
          onBreadcrumbsLoaded={onBreadcrumbsLoaded}
          jamActive={jamActive}
        />
      </Suspense>
    </section>
  );
}

function formatAlertDescription(desc) {
  if (!desc) return "";
  return desc
    .replace(/(\d+)\s*meters/gi, (match, val) => {
      const num = Number(val);
      if (isNaN(num)) return match;
      return num >= 1000 ? `${(num / 1000).toFixed(1)} km` : `${num} m`;
    })
    .replace("from the assigned corridor", "outside designated corridor");
}

function AlertQueue({ alerts, onDispatch, onWhatsApp }) {
  const { t, lang } = useLanguage();
  const [followUps, setFollowUps] = useState({});
  const [notes, setNotes] = useState({});

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/alert/follow-ups`)
      .then((r) => (r.ok ? r.json() : []))
      .then((records) => {
        if (cancelled) return;
        const map = {};
        for (const rec of records) {
          if (rec.payload?.alert_id) map[rec.payload.alert_id] = { ...rec.payload, updated_at: rec.created_at };
        }
        setFollowUps(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function recordFollowUp(alert, status, noteOverride) {
    const note = noteOverride !== undefined ? noteOverride : (notes[alert.id] || "").trim();
    const payload = {
      alert_id: alert.id,
      status,
      operator: localStorage.getItem("jwis_role") || "dispatcher",
      note,
    };
    setFollowUps((s) => ({ ...s, [alert.id]: { ...payload, updated_at: new Date().toISOString() } }));
    setNotes((s) => ({ ...s, [alert.id]: "" }));
    try {
      await fetch(`${API_URL}/alert/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("Follow-up sync failed; kept local only", error);
    }
  }

  const activeCount = alerts.filter((a) => (followUps[a.id]?.status || "OPEN") !== "RESOLVED").length;

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{t("aq_title")}</h2>
          <p>{t("aq_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <StatusPill tone="danger">{activeCount} {lang === "id" ? "aktif" : "active"}</StatusPill>
        </div>
      </div>
      <div className="alert-list">
        {alerts.map((alert) => {
          const recommendedRoute = alert.recommended_routes?.[0];
          const status = followUps[alert.id]?.status || "OPEN";
          const statusClass = status === "RESOLVED" ? "success" : status === "DISPATCHED" ? "warning" : "danger";
          const formattedDesc = formatAlertDescription(alert.description);

          return (
            <article className="alert-item" key={alert.id}>
              <div className="alert-head">
                <div className="alert-icon-box">
                  <AlertTriangle size={17} />
                </div>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{formattedDesc}</p>
                </div>
                <span className={`pill ${statusClass}`}>
                  <span className={`status-dot ${statusClass}`} />
                  {status === "OPEN" ? (lang === "id" ? "TERBUKA" : "OPEN") : status === "DISPATCHED" ? (lang === "id" ? "DIKIRIM" : "DISPATCHED") : (lang === "id" ? "SELESAI" : "RESOLVED")}
                </span>
              </div>
              <div className={`route-rec ${recommendedRoute ? "" : "route-rec-empty"}`}>
                {recommendedRoute ? (
                  <>
                    <div className="route-rec-icon">
                      <Route size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{recommendedRoute.name}</strong>
                      <div className="route-rec-meta">
                        <span className="route-rec-tag"><Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />{recommendedRoute.eta_minutes} min ETA</span>
                        <span className="route-rec-tag"><Crosshair size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />Score {recommendedRoute.score}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <strong>{t("aq_awaiting_rec")}</strong>
                    <span>{t("aq_awaiting_sub")}</span>
                  </div>
                )}
              </div>
              {status !== "RESOLVED" ? (
                <div className="alert-actions">
                  <div className="alert-btn-row">
                    <button className="primary-button" onClick={() => { onDispatch(alert); recordFollowUp(alert, "DISPATCHED", `Routed via ${recommendedRoute?.name || "backup route"}`); }}>
                      <Send size={14} /> {t("btn_approve_dispatch")}
                    </button>
                    <button className="alert-wa-button" onClick={() => onWhatsApp(alert)}>
                      <MessageCircle size={14} /> {t("btn_wa_alert")}
                    </button>
                  </div>
                  <div className="alert-resolve-row">
                    <input
                      type="text"
                      value={notes[alert.id] || ""}
                      onChange={(e) => setNotes((s) => ({ ...s, [alert.id]: e.target.value }))}
                      placeholder={t("btn_resolve_placeholder")}
                    />
                    <button className="resolve-btn" onClick={() => recordFollowUp(alert, "RESOLVED")} disabled={!notes[alert.id]?.trim()}>
                      <Check size={14} /> {t("btn_mark_resolved")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alert-resolved-note">
                  <Check size={14} /> {lang === "id" ? "Diselesaikan oleh" : "Resolved by"} <b>{followUps[alert.id]?.operator}</b>: {followUps[alert.id]?.note || "closed"}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RouteEvidencePanel({ route }) {
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

function PredictionPanel({ predictions, allPredictions = predictions }) {
  const { t, lang } = useLanguage();
  const totalExtraTrucks = predictions.reduce((sum, item) => sum + (item.recommended_extra_trucks || 0), 0);
  const totalExtraCrews = predictions.reduce((sum, item) => sum + (item.recommended_extra_crews || 0), 0);
  const highestSpike = predictions.reduce(
    (max, item) => Math.max(max, item.spike_percent || 0),
    0,
  );
  const displayRows = [...predictions].sort((a, b) => (b.predicted_tons || 0) - (a.predicted_tons || 0));

  return (
    <section className="panel wide prediction-panel">
      <div className="panel-title">
        <div>
          <h2>{t("fc_pred_title")}</h2>
          <p>{t("fc_pred_sub")}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <CloudRain size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_hr_districts")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#dc2626" }}>{predictions.length} {lang === "id" ? "distrik" : "districts"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_peak_spike")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#d97706" }}>+{highestSpike}%</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{t("fc_extra_cap")}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{totalExtraTrucks} {lang === "id" ? "truk" : "trucks"} · {totalExtraCrews} {lang === "id" ? "kru" : "crews"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "24%" }}>{t("fc_th_district")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("fc_th_date")}</th>
              <th scope="col" style={{ width: "18%" }}>{t("fc_th_volume")}</th>
              <th scope="col" style={{ width: "20%" }}>{t("fc_th_spike")}</th>
              <th scope="col" style={{ width: "22%" }}>{t("fc_th_backup")}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((item, idx) => {
              const spike = item.spike_percent || 0;
              const isCrit = spike >= 40 || item.risk_level === "critical";
              const isHigh = spike >= 30 || item.risk_level === "high";
              const tone = isCrit ? "danger" : isHigh ? "warning" : "info";

              return (
                <tr key={`${item.district}-${item.date}-${idx}`}>
                  <td>
                    <strong style={{ color: "var(--ui-ink)", fontWeight: 700 }}>{item.district}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                      {item.date}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600, color: "var(--ui-ink)" }}>
                      {item.predicted_tons?.toFixed(1) || "0.0"} {lang === "id" ? "t/hari" : "t/day"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ flex: 1, height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, spike * 2)}%`, background: isCrit ? "#dc2626" : isHigh ? "#d97706" : "var(--ui-accent)" }} />
                      </div>
                      <span className={`pill ${tone}`} style={{ minWidth: "48px", justifyContent: "center" }}>
                        +{spike}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="zone-tag">
                      {item.recommended_extra_trucks || 0} {lang === "id" ? "truk" : "trucks"} · {item.recommended_extra_crews || 0} {lang === "id" ? "kru" : "crews"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const PERMIT_VENUE_PRESETS = [
  { key: "gbk", label: "GBK Senayan", lat: -6.2183, lng: 106.8022 },
  { key: "monas", label: "Kawasan Monas", lat: -6.1754, lng: 106.8272 },
  { key: "jiexpo", label: "JIExpo Kemayoran", lat: -6.1448, lng: 106.8487 },
  { key: "ancol", label: "Ancol", lat: -6.1260, lng: 106.8450 },
  { key: "istora", label: "Istora Senayan", lat: -6.2270, lng: 106.7990 },
  { key: "cfd", label: "Bundaran HI (CFD)", lat: -6.1950, lng: 106.8230 },
];

function PermitSubmissionPanel({ onPermitSubmitted }) {
  const { lang } = useLanguage();
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [attendance, setAttendanceLocal] = useState(50000);
  const [lat, setLat] = useState(-6.2183);
  const [lng, setLng] = useState(106.8022);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function applyPreset(key) {
    const preset = PERMIT_VENUE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setLat(preset.lat);
    setLng(preset.lng);
    if (!locationName) setLocationName(preset.label);
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/events/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, location_name: locationName, event_date: eventDate,
          expected_attendance: Number(attendance), lat: Number(lat), lng: Number(lng),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json);
      onPermitSubmitted?.(json.permit);
    } catch (err) {
      setError(lang === "id" ? "Pengajuan gagal — backend offline atau input tidak valid." : "Submission failed — backend offline or invalid input.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel wide" data-testid="permit-submission-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Pengajuan Izin Acara Keramaian" : "Event Permit Intake"}</h2>
          <p>{lang === "id" ? "Ajukan izin acara publik — sistem langsung mengestimasi volume sampah, kebutuhan armada, dan distrik terdampak." : "Submit an event permit — the system estimates waste generation, resources, and affected districts instantly."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Calendar size={18} />
        </div>
      </div>

      <form className="permit-form" onSubmit={submit}>
        <label>{lang === "id" ? "Nama Acara" : "Event name"}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} placeholder={lang === "id" ? "misal: Konser Musik GBK" : "e.g. Konser Musik GBK"} />
        </label>
        <label>{lang === "id" ? "Pilihan Lokasi Populer" : "Venue preset"}
          <select defaultValue="gbk" onChange={(e) => applyPreset(e.target.value)} aria-label="Venue preset">
            {PERMIT_VENUE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label>{lang === "id" ? "Nama Lokasi / Area" : "Location"}
          <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} required minLength={3} placeholder={lang === "id" ? "Nama venue / area acara" : "Venue / area name"} />
        </label>
        <label>{lang === "id" ? "Tanggal Acara" : "Event date"}
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </label>
        <label>{lang === "id" ? "Estimasi Jumlah Penonton:" : "Expected attendance:"} <b>{Number(attendance).toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "orang" : "people"}</b>
          <input type="range" min="1000" max="200000" step="1000" value={attendance} onChange={(e) => setAttendanceLocal(e.target.value)} />
        </label>
        <div className="permit-coords">
          <label>Lat <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} required /></label>
          <label>Lng <input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} required /></label>
        </div>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? (lang === "id" ? "Mengirim..." : "Submitting…") : (lang === "id" ? "Kirim Izin & Hitung Dampak Sampah" : "Submit permit & estimate impact")}
        </button>
        {error && <p className="permit-error">{error}</p>}
      </form>

      {result && (
        <div className="permit-impact" data-testid="permit-impact">
          <h3>{lang === "id" ? "Estimasi Dampak Sampah —" : "Estimated impact —"} {result.permit.name}</h3>
          <div className="facility-summary">
            <div><b>{result.impact.predicted_waste_tons} t</b><span>{lang === "id" ? "prediksi sampah" : "predicted waste"}</span></div>
            <div><b>{result.impact.backup_trucks_required}</b><span>{lang === "id" ? "truk cadangan" : "backup trucks"}</span></div>
            <div><b>{result.impact.crews_required}</b><span>{lang === "id" ? "kru lapangan" : "field crews"}</span></div>
            <div><b>{result.impact.man_hours_required}</b><span>{lang === "id" ? "jam-kerja kru" : "man-hours"}</span></div>
            <div><b>{result.impact.large_bins_required}</b><span>{lang === "id" ? "tong sampah besar" : "large bins"}</span></div>
          </div>
          <p className="permit-affected">
            {lang === "id" ? "Kecamatan terdampak:" : "Affected districts:"} {result.affected_kecamatan.map((a) => a.kecamatan).join(", ") || "nearest district assigned"}.
          </p>
          <p className="kec-note">{result.permit.data_note} Basis: {result.impact.resource_basis}.</p>
        </div>
      )}
    </section>
  );
}

function FacilityGapPanel({ rainfall = 0, attendance = 0 }) {
  const { lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    const params = new URLSearchParams({
      rainfall_mm: String(rainfall),
      event_attendance: String(attendance),
    });
    fetch(`${API_URL}/facilities/gap-analysis?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => { clearTimeout(timer); setLoading(false); });
  }, [rainfall, attendance]);

  const areas = data?.areas || [];
  const summary = data?.summary || {};
  const shown = showAll ? areas : areas.slice(0, 6);
  const sevColor = { critical: "#dc2626", watch: "#d97706", ok: "#16a34a", unknown: "#64748b" };

  return (
    <section className="panel wide" data-testid="facility-gap-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Kesiapan Fasilitas & Analisis Kesenjangan TPS" : "Facility Readiness & Gap Analysis"}</h2>
          <p>
            {lang === "id"
              ? "Perbandingan kebutuhan timbulan sampah vs kapasitas TPS — mendeteksi distrik yang kekurangan fasilitas pembuangan."
              : "Predicted demand vs TPS capacity proxy — where disposal and transport facilities are missing, and where to site them."}
          </p>
        </div>
        <div className="panel-header-icon-wrap">
          <Factory size={18} />
        </div>
      </div>

      {loading && <p className="panel-loading">{lang === "id" ? "Menyiapkan analisis kesenjangan fasilitas..." : "Preparing facility gap analysis…"}</p>}
      {!loading && !data && <p className="panel-loading">{lang === "id" ? "Analisis kesenjangan tidak tersedia." : "Gap analysis unavailable."}</p>}

      {data && (
        <>
          <div className="facility-summary">
            <div><b>{summary.critical_count}</b><span>{lang === "id" ? "distrik kritis" : "critical districts"}</span></div>
            <div><b>{summary.total_gap_ton_per_day?.toLocaleString(lang === "id" ? "id-ID" : "en-US")} t</b><span>{lang === "id" ? "kesenjangan kapasitas/hari" : "daily capacity gap"}</span></div>
            <div><b>{summary.total_extra_trucks_needed}</b><span>{lang === "id" ? "tambahan ritase/hari" : "extra trips/day"}</span></div>
            <div><b>{summary.total_new_tps_sites_needed}</b><span>{lang === "id" ? "lokasi TPS baru dibutuhkan" : "new TPS sites (bounded share)"}</span></div>
            <div><b>{Math.round((summary.citywide_proxy_coverage_ratio || 0) * 100)}%</b><span>{lang === "id" ? "cakupan estimasi" : "proxy coverage"}</span></div>
          </div>

          <div className="facility-list">
            {shown.map((a) => (
              <article key={a.slug} className="facility-row">
                <div className="facility-head">
                  <strong>{a.kecamatan}</strong>
                  <span className="facility-sev" style={{ color: sevColor[a.severity] }}>{a.severity}</span>
                </div>
                <div className="facility-meta">
                  <span>{lang === "id" ? "timbulan" : "demand"} {a.predicted_tons_per_day.toLocaleString(lang === "id" ? "id-ID" : "en-US")} t/{lang === "id" ? "hari" : "day"} vs {lang === "id" ? "kapasitas" : "capacity"} {a.tps_capacity_proxy_ton_per_day ?? "?"} t</span>
                  <span>{lang === "id" ? "gap" : "gap"} <b>{a.gap_ton_per_day ?? "?"} t</b> · +{a.recommended_extra_trips_per_day} {lang === "id" ? "ritase/hari" : "trips/day"} · {a.recommended_new_tps_sites} TPS</span>
                </div>
                {a.siting_candidates?.length > 0 && (
                  <div className="facility-siting">
                    {lang === "id" ? "Rekomendasi lokasi:" : "Site near:"} {a.siting_candidates.map((c) => `${c.kelurahan} (${c.predicted_tons} t, ${c.existing_tps_sites} TPS)`).join(" · ")}
                  </div>
                )}
              </article>
            ))}
          </div>

          {areas.length > 6 && (
            <button className="text-button show-more-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? (lang === "id" ? "Tampilkan lebih sedikit" : "Show fewer") : `${lang === "id" ? "Tampilkan semua" : "Show all"} (${areas.length} ${lang === "id" ? "distrik" : "districts"})`}
            </button>
          )}
          <p className="kec-note">{data.assumptions?.coverage_note}</p>
        </>
      )}
    </section>
  );
}

function KecamatanMapPanel({ horizon = "7d" }) {
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
  const { lang } = useLanguage();
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
          <h2>{lang === "id" ? "Risiko Cuaca Open-Meteo" : "Open-Meteo Weather Risk"}</h2>
          <p>{lang === "id" ? "Prakiraan curah hujan 7 hari Jakarta sebagai pemicu kesiapan armada timbulan." : "Jakarta 7-day rainfall forecast used as a driver for waste-volume readiness."}</p>
        </div>
        <StatusPill tone={weather?.source === "open-meteo" ? "success" : "warning"}>
          {weather?.source === "open-meteo" ? (lang === "id" ? "Open-Meteo live" : "Open-Meteo live") : (lang === "id" ? "Cadangan" : "fallback")}
        </StatusPill>
      </div>
      {peak && (
        <div className="weather-hero">
          <CloudRain size={26} />
          <div>
            <strong>{peak.date}</strong>
            <span>{peak.rainfall_mm.toFixed(1)} mm {lang === "id" ? "hujan" : "rain"} - {Math.round(peak.precipitation_probability)}% {lang === "id" ? "peluang" : "probability"}</span>
          </div>
          <b>+{peak.waste_impact_percent}%</b>
        </div>
      )}
      <div className="weather-strip">
        {forecast.slice(0, 7).map((day) => (
          <article key={day.date} className={`weather-day ${day.risk_level}`}>
            <div>
              <strong>{new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short" })}</strong>
              <small>{new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric" })}</small>
            </div>
            <span>{Math.round(day.rainfall_mm)} mm</span>
            <small>{Math.round(day.temperature_min_c)}-{Math.round(day.temperature_max_c)} C</small>
          </article>
        ))}
      </div>
      <div className="weather-trend-chart" aria-label="Rainfall impact trend chart">
        <h3>{lang === "id" ? "Tren Dampak Curah Hujan" : "Rainfall impact trend"}</h3>
        {trendRows.map((day) => {
          const rainWidth = Math.max(4, ((day.rainfall_mm || 0) / maxRainfall) * 100);
          const impactWidth = Math.max(4, ((day.waste_impact_percent || 0) / maxImpact) * 100);
          const dayLabel = new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short" });
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
  const { t, lang } = useLanguage();
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const filtered = trucks.filter(
    (t) =>
      t.truck_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.assigned_zone?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const shown = showAll ? filtered : filtered.slice(0, 12);
  const damagedCount = trucks.filter((t) => t.is_damaged).length;
  const violationCount = trucks.filter((t) => t.deviation?.violated).length;

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{t("ft_title")}</h2>
          <p>{trucks.length} {lang === "id" ? "unit dipantau real-time" : "units monitored in real-time"} · {damagedCount} {lang === "id" ? "peringatan perbaikan" : "maintenance alerts"} · {violationCount} {lang === "id" ? "deviasi rute" : "corridor deviations"}.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="input-shell" style={{ width: "220px", height: "36px" }}>
            <Search size={14} />
            <input
              type="text"
              placeholder={t("ft_search")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ fontSize: "12.5px" }}
            />
          </div>
        </div>
      </div>
      <div className="table-wrap fleet-table-wrap">
        <table className="fleet-state-table" aria-label="Fleet operational status">
          <thead>
            <tr>
              <th scope="col" style={{ width: "18%" }}>{t("ft_th_truck")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_driver")}</th>
              <th scope="col" style={{ width: "14%" }}>{t("ft_th_zone")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_comp")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("ft_th_activity")}</th>
              <th scope="col" style={{ width: "10%" }}>{t("ft_th_speed")}</th>
              <th scope="col" style={{ width: "10%" }}>{t("ft_th_action")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--ui-muted)" }}>
                  {lang === "id" ? `Tidak ada kendaraan yang cocok dengan "${searchTerm}".` : `No vehicles found matching "${searchTerm}".`}
                </td>
              </tr>
            ) : (
              shown.map((truck) => {
                const isViolation = Boolean(truck.deviation?.violated);
                const isBreakdown = Boolean(truck.is_damaged);
                const complianceTone = isViolation ? "danger" : isBreakdown ? "warning" : "success";
                const complianceLabel = isViolation
                  ? `${lang === "id" ? "Pelanggaran" : "Violation"} (${Math.round(truck.deviation.distance_meters >= 1000 ? truck.deviation.distance_meters / 1000 : truck.deviation.distance_meters)}${truck.deviation.distance_meters >= 1000 ? "km" : "m"})`
                  : isBreakdown
                    ? (truck.damage_status?.state === "breakdown" ? (lang === "id" ? "Mogok" : "Breakdown") : (lang === "id" ? "Perawatan" : "Maintenance"))
                    : (lang === "id" ? "Sesuai" : "Compliant");

                return (
                  <tr key={truck.truck_code}>
                    <td>
                      <div className="truck-cell" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <strong className="plate-badge">{truck.truck_code}</strong>
                        <span style={{ fontSize: "11.5px", color: "var(--ui-muted)", fontFamily: "var(--mono, monospace)" }}>
                          {truck.plate_number}
                        </span>
                      </div>
                    </td>
                    <td className="driver-name-cell">
                      <strong style={{ color: "var(--ui-ink)", fontWeight: 600 }}>{truck.driver_name}</strong>
                    </td>
                    <td><span className="zone-tag">{truck.assigned_zone}</span></td>
                    <td>
                      <span className={`pill ${complianceTone}`}>
                        <span className={`status-dot ${complianceTone}`} />
                        {complianceLabel}
                      </span>
                    </td>
                    <td>
                      <div className="activity-cell" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className={`activity-dot ${isViolation ? "danger" : isBreakdown ? "warning" : "active"}`} />
                        <span style={{ fontSize: "12.5px" }}>{truck.activity?.label || (lang === "id" ? "Siaga" : "Idle")}</span>
                      </div>
                    </td>
                    <td className="speed-cell">
                      <span className="speed-badge">{truck.latest_position?.speed_kmh || 0} km/h</span>
                    </td>
                    <td>
                      <button className="text-button" type="button" aria-label={`View ${truck.truck_code} trip history`} onClick={() => onOpenTripHistory?.(truck.truck_code)} style={{ height: "30px", padding: "0 10px", fontSize: "12px" }}>
                        {t("btn_trip_history")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 12 && (
        <div style={{ marginTop: "12px", display: "flex", justifyContent: "center" }}>
          <button className="text-button show-more-btn" onClick={() => setShowAll(!showAll)}>
            {showAll ? (lang === "id" ? "Tampilkan lebih sedikit" : "Show fewer") : `${lang === "id" ? "Tampilkan semua" : "Show all"} (${filtered.length} ${lang === "id" ? "unit" : "units"})`}
          </button>
        </div>
      )}
    </section>
  );
}

function ExecutiveSummary({ summary, queue }) {
  const { lang } = useLanguage();
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/reports/executive-summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.queue_impact) setImpact(data.queue_impact); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Ringkasan Eksekutif" : "Executive Summary"}</h2>
          <p>{lang === "id" ? "Disiapkan untuk pimpinan Dinas Lingkungan Hidup (DLH) DKI Jakarta." : "Prepared for DLH leadership and case-provider review."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <ShieldCheck size={18} />
        </div>
      </div>
      <h3>{summary.headline}</h3>
      <ul>
        {summary.points.map((point) => <li key={point}>{point}</li>)}
      </ul>
      <div className="queue-box">
        <strong>{lang === "id" ? "Antrean TPA Bantargebang" : "TPA Bantargebang queue"}</strong>
        <span>{queue.trucks_waiting} {lang === "id" ? "truk mengantre" : "trucks waiting"} - {queue.estimated_wait_minutes} {lang === "id" ? "menit estimasi keterlambatan" : "min estimated delay"}</span>
        <p>{queue.recommendation}</p>
      </div>
      {impact && (
        <div className="exec-impact">
          <div className="exec-impact-head"><strong>{lang === "id" ? "Dampak Optimasi — Keberangkatan Bertahap" : "Optimization Impact — Staggered Dispatch"}</strong></div>
          <div className="exec-impact-grid">
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Baseline (semua truk jam puncak)" : "Baseline (all trucks peak)"}</span>
              <strong>{impact.baseline_queue_trucks} {lang === "id" ? "truk" : "trucks"} · {impact.baseline_wait_minutes} {lang === "id" ? "menit antre" : "min wait"}</strong>
              <small>p95 {impact.baseline_p95_minutes} min</small>
            </div>
            <div className="exec-impact-arrow" aria-hidden="true">→</div>
            <div className="exec-impact-col">
              <span className="exec-impact-label">{lang === "id" ? "Dengan keberangkatan bertahap" : "With staggered dispatch"}</span>
              <strong>{impact.optimized_queue_trucks} {lang === "id" ? "truk" : "trucks"} · {impact.optimized_wait_minutes} {lang === "id" ? "menit antre" : "min wait"}</strong>
              <small>p95 {impact.optimized_p95_minutes} min</small>
            </div>
            <div className="exec-impact-delta">
              <strong>−{impact.queue_reduction_percent}% {lang === "id" ? "antrean" : "wait"}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AssistantPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I am Ana. Ask me about route deviation, rainfall risk, TPA queue, dispatch priority, or waste forecast spikes. You can also upload a photo or PDF for analysis.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const fileType = isPdf ? "pdf" : "image";
    const reader = new FileReader();
    reader.onload = () => {
      let dataUrl = reader.result;
      if (isPdf && dataUrl instanceof ArrayBuffer) {
        const bytes = new Uint8Array(dataUrl);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        dataUrl = "data:application/pdf;base64," + btoa(binary);
      }
      setAttachedFile({ data: dataUrl, type: fileType, name: file.name });
    };
    if (isPdf) reader.readAsArrayBuffer(file);
    else reader.readAsDataURL(file);
    event.target.value = "";
  }

  async function askAssistant(promptOverride) {
    const prompt = (promptOverride || question).trim();
    if ((!prompt && !attachedFile) || loading) return;
    const fileMeta = attachedFile ? ` [${attachedFile.name}]` : "";
    setMessages((current) => [...current, { role: "user", text: (prompt || "Analyze this file") + fileMeta }]);
    const currentFile = attachedFile;
    setQuestion("");
    setAttachedFile(null);
    setLoading(true);
    try {
      const body = {
        question: prompt || "Analyze this file/image and tell me what you see related to JWIS waste operations.",
        history: messages.slice(-8).map((m) => ({ role: m.role, content: m.text })),
      };
      if (currentFile) {
        body.file_data = currentFile.data;
        body.file_type = currentFile.type;
      }
      const response = await fetch(`${API_URL}/assistant/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: `Ana tidak dapat menjawab saat ini. AI gateway error: ${data.detail || "unknown"}`,
            provider: "error",
          },
        ]);
        return;
      }
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

  function humanizeAssistantAnswer(text) {
    if (!text) return text;
    const humanPhrases = {
      is_damaged: "truck damage confirmed",
      off_corridor: "off the assigned corridor",
      far_off_corridor: "far off the assigned corridor",
    };
    return text
      .replace(/flags\s*:\s*([^\n]+)/gi, (match, list) => {
        const cleaned = list
          .split(",")
          .map((item) => item.trim().replace(/^`|`$/g, "").trim())
          .filter(Boolean)
          .map((key) => humanPhrases[key] || key)
          .join(", ");
        return `Risks: ${cleaned}`;
      })
      .replace(/`?([a-z_]+)\s*:\s*(?:true|false|yes|no)`?/gi, (match, key) => humanPhrases[key] || match);
  }

  function renderAssistantText(text) {
    if (!text) return null;
    const rawHtml = marked.parse(humanizeAssistantAnswer(text), { gfm: true, breaks: true });
    return DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["style", "script", "iframe", "form", "input"],
    });
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
              <div className="assistant-formatted-answer" dangerouslySetInnerHTML={{ __html: renderAssistantText(message.text) }} />
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
        {attachedFile && (
          <div className="assistant-file-chip">
            <Paperclip size={14} />
            <span>{attachedFile.name}</span>
            <button type="button" aria-label="Remove file" onClick={() => setAttachedFile(null)}>
              <X size={14} />
            </button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="assistant-upload-button"
          title="Upload image or PDF"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach photo or PDF"
        >
          <Paperclip size={18} />
        </button>
        <label className="sr-only" htmlFor="assistant-question">Ask Ana anything</label>
        <input
          id="assistant-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={attachedFile ? "Ask about this file..." : "Ask Ana anything..."}
          autoComplete="off"
        />
        <button className="primary-button" type="submit" aria-label="Send message" disabled={loading || (!question.trim() && !attachedFile)}>
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
  const { t, lang } = useLanguage();
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
          <h2>{t("plan_sim_title")}</h2>
          <p>{t("plan_sim_sub")}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Users size={18} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "16px" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui-muted)" }}>{t("plan_att")}</span>
          <input type="range" min="0" max="200000" step="5000" value={attendance} onChange={(event) => setAttendance(Number(event.target.value))} />
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{attendance.toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "orang" : "people"}</small>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--ui-muted)" }}>{t("plan_rain")}</span>
          <input type="range" min="0" max="100" step="1" value={rainfall} onChange={(event) => setRainfall(Number(event.target.value))} />
          <small style={{ fontSize: "13px", fontWeight: 700, color: "var(--ui-accent)" }}>{rainfall} mm / {lang === "id" ? "hari" : "day"}</small>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button className="primary-button" onClick={run} disabled={loading} style={{ width: "auto", minHeight: "36px", height: "36px", padding: "0 20px" }}>
          {loading ? (lang === "id" ? "Menghitung..." : "Calculating...") : t("btn_run_scenario")}
        </button>
      </div>
      <div className="scenario-result" style={{ marginBottom: "16px" }}>
        <strong>{lang === "id" ? `Total estimasi timbulan ${totalTons.toLocaleString("id-ID")} ton/hari (${data?.kecamatan_count || 42} distrik)` : `Total forecast ${totalTons.toLocaleString("en-US")} tons/day (${data?.kecamatan_count || 42} districts)`}</strong>
        <span>{lang === "id" ? "Titik Puncak:" : "Peak Hotspot:"} {top5[0]?.kecamatan || "..."} — {top5[0]?.predicted_tons?.toLocaleString(lang === "id" ? "id-ID" : "en-US") || "..."} {lang === "id" ? "ton" : "tons"}</span>
      </div>
      <div className="scenario-reqs" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{manHours}</b><span>{lang === "id" ? "jam-kerja kru (top 5)" : "man-hours (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{crews}</b><span>{lang === "id" ? "kru lapangan (top 5)" : "field crews (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{trucks}</b><span>{lang === "id" ? "truk armada (top 5)" : "trucks (top 5)"}</span></div>
        <div className="req-chip" style={{ padding: "10px 12px" }}><b>{bins}</b><span>{lang === "id" ? "tong sampah besar (top 5)" : "large bins (top 5)"}</span></div>
      </div>
          </ScenarioPanel>
        ),
        recommendation: (
          <ScenarioPanel mode="recommendation">
      <div className="optimizer-section">
        <div className="optimizer-head">
          <h3>{t("plan_opt_title")}</h3>
        </div>
        
        {!plan && (
          <>
            <div className="plan-preflight-grid" aria-label="Plan preflight" style={{ marginBottom: "16px" }}>
              <div>
                <span>{t("plan_demand")}</span>
                <strong>{totalTons.toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "ton/hari" : "tons/day"}</strong>
              </div>
              <div>
                <span>{t("plan_fleet_need")}</span>
                <strong>{trucks} {lang === "id" ? "truk" : "trucks"} / {crews} {lang === "id" ? "kru" : "crews"}</strong>
              </div>
              <div>
                <span>{t("plan_tpa_queue")}</span>
                <strong>{queue.trucks_waiting} {lang === "id" ? "truk" : "trucks"} / {queue.estimated_wait_minutes} min</strong>
              </div>
            </div>

            <button className="primary-button" onClick={generatePlan} disabled={planLoading || loading} style={{ width: "auto", minHeight: "38px", height: "38px", padding: "0 24px", marginBottom: "14px" }}>
              {planLoading ? (lang === "id" ? "Mengoptimalkan Alokasi..." : "Optimizing Assignments...") : t("btn_generate_plan")}
            </button>

            <div className="optimizer-empty-state" aria-live="polite" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <Workflow size={18} style={{ color: "var(--ui-accent)", flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong style={{ fontSize: "13px" }}>{t("plan_awaiting_title")}</strong>
                  <p style={{ fontSize: "12px", color: "var(--ui-muted)" }}>
                    {t("plan_awaiting_desc")}
                  </p>
                </div>
              </div>
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
  const { t, lang } = useLanguage();
  const [queue, setQueue] = useState(null);
  const [scenario, setScenario] = useState("peak");

  async function fetchQueue(sc = scenario) {
    try {
      const res = await fetch(`${API_URL}/tpa/queue-status?scenario=${sc}`);
      if (res.ok) setQueue(await res.json());
    } catch {}
  }

  useEffect(() => {
    fetchQueue(scenario);
    const interval = setInterval(() => fetchQueue(scenario), 6000);
    return () => clearInterval(interval);
  }, [scenario]);

  if (!queue) return null;

  return (
    <section className="panel tpa-queue-panel">
      <div className="panel-title">
        <div>
          <h2>{t("tpa_title")}</h2>
          <p>{t("tpa_subtitle")}</p>
        </div>
        <div className="tpa-scenario-toggle" role="group" aria-label="Arrival scenario">
          {[["peak", lang === "id" ? "Jam Puncak" : "Peak hour"], ["live", lang === "id" ? "Waktu Nyata" : "Live clock"]].map(([id, label]) => (
            <button key={id} className={scenario === id ? "active" : ""} onClick={() => setScenario(id)}>{label}</button>
          ))}
        </div>
        <div className="panel-header-icon-wrap">
          <Clock size={18} />
        </div>
      </div>
      {queue.arrival_profile && (
        <p className="tpa-scenario-note">{lang === "id" ? "Profil kedatangan:" : "Arrival profile:"} {queue.arrival_profile} · {queue.method}</p>
      )}

      <div className="tpa-status-grid">
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Truk Mengantre" : "Queued Trucks"}</span>
          <strong>{queue.trucks_in_queue} {lang === "id" ? "unit" : "units"}</strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Estimasi Waktu Antre" : "Estimated Wait"}</span>
          <strong className={queue.avg_wait_minutes > 60 ? "text-danger" : "text-success"}>
            {queue.avg_wait_minutes} min
          </strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Status Jembatan Timbang" : "Weighbridge"}</span>
          <strong className={queue.weighbridge_status.includes("DEGRADED") ? "text-danger" : "text-success"}>
            {queue.weighbridge_status}
          </strong>
        </div>
      </div>

      <div className="tpa-logs">
        <h3>{lang === "id" ? "Log Timbangan Terkini" : "Latest Weighbridge Log"}</h3>
        <ul>
          {queue.scale_logs?.map((log, i) => (
            <li key={i}>
              <span className="time"><Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />{log.time}</span>
              <span className="truck">{log.truck}</span>
              <span className="weight">{log.weight_ton} {lang === "id" ? "ton" : "tons"}</span>
              <span className={`status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CrowdEventsPanel({ onSimulateEvent }) {
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

function AiNotificationFeed({ events, onAck }) {
  if (!events.length) {
    return <div className="ai-feed-empty">Belum ada event AI.</div>;
  }
  const latestFirst = events
    .map((e, i) => ({ ...e, _index: i }))
    .reverse()
    .slice(0, 6);
  return (
    <div className="ai-feed">
      {latestFirst.map((e) => (
        <div key={e._index} className={`ai-feed-item ai-feed-${e.event_type}`}>
          <div className="ai-feed-head">
            <span className="ai-feed-badge">{e.event_type}</span>
            <span className="ai-feed-time">
              {new Date(e.created_at).toLocaleTimeString("id-ID")}
            </span>
          </div>
          <div className="ai-feed-title">{e.title}</div>
          {e.status === "new" ? (
            <button className="ai-ack-btn" onClick={() => onAck(e._index)}>
              Setujui
            </button>
          ) : (
            <span className="ai-ack-done">✓ acknowledged</span>
          )}
        </div>
      ))}
    </div>
  );
}

function AStarReroutingPanel({ jamActive, aiEvents, onAckEvent }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const load = () => fetch(`${API_URL}/fleet/astar-reroute`)
      .then((res) => res.json())
      .then(setInfo)
      .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const rerouteEvents = (aiEvents || []).filter(
    (e) => e.event_type === "auto_reroute" || e.event_type === "jam_cleared"
  );
  const diverted = info?.diversion_applied;
  const dist = info?.active_route?.distance_km ?? 12.7;
  const eta = info?.active_route?.eta_minutes ?? 17;

  return (
    <section className="panel astar-panel">
      <div className="panel-title">
        <div>
          <h2>AI Traffic Monitor</h2>
          <p>Deteksi & reroute otomatis oleh AI Engine</p>
        </div>
        <span className={`traffic-status-badge ${jamActive ? "congested" : "clear"}`}>
          <span className={`status-dot ${jamActive ? "danger" : "success"}`} />
          {jamActive ? "JAM TERDETEKSI AI" : "KORIDOR NORMAL"}
        </span>
      </div>

      <div className="astar-info-card">
        <div className="astar-stats">
          <div className="astar-stat-col">
            <span>Distance</span>
            <strong>{Number(dist).toFixed(1)} km</strong>
          </div>
          <div className="astar-stat-col">
            <span>ETA</span>
            <strong>{Math.round(eta)} min</strong>
          </div>
          <div className="astar-stat-col">
            <span>Status</span>
            <strong className={diverted ? "text-diverted" : "text-normal"}>
              {diverted ? "Diverted (A*)" : "Primary"}
            </strong>
          </div>
        </div>

        <div className="astar-reroute-details">
          <div className="astar-route-step">
            <span>Koridor Utama:</span>
            <strong>Daan Mogot ⇄ Bantargebang</strong>
          </div>
          <div className="astar-route-step">
            <span>Mesin Reroute:</span>
            <strong>A* Heuristic (OSRM Grid)</strong>
          </div>
        </div>
      </div>

      <AiNotificationFeed events={rerouteEvents} onAck={onAckEvent} />
    </section>
  );
}

function StaggerSimulatorPanel() {
  const { t } = useLanguage();
  const [result, setResult] = useState({
    baseline_wait_minutes: 116,
    baseline_queue_trucks: 47,
    optimized_wait_minutes: 48,
    optimized_queue_trucks: 19,
    queue_reduction_percent: 58.6,
    recommended_stagger_minutes: 15,
    dispatch_slots: [
      { truck_index: 1, suggested_departure: "08:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 2, suggested_departure: "08:15", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 3, suggested_departure: "08:30", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 4, suggested_departure: "08:45", slot_status: "assigned", tpa_wait_est_minutes: 48 },
      { truck_index: 5, suggested_departure: "09:00", slot_status: "assigned", tpa_wait_est_minutes: 48 },
    ],
  });
  const [loading, setLoading] = useState(false);

  async function runSimulation() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/simulator/stagger?active_trucks=5`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setResult(data);
      }
    } catch {}
    setLoading(false);
  }

  return (
    <section className="panel wide stagger-panel">
      <div className="panel-title">
        <div>
          <h2>{t("stagger_title")}</h2>
          <p>{t("stagger_subtitle")}</p>
        </div>
        <button className="primary-button" onClick={runSimulation} disabled={loading} style={{ width: "auto", minHeight: "36px", height: "36px", padding: "0 16px", fontSize: "12.5px" }}>
          <RefreshCcw size={14} /> {loading ? (lang === "id" ? "Mengoptimalkan..." : "Optimizing...") : t("btn_rerun_optimizer")}
        </button>
      </div>

      <div className="stagger-compare" style={{ marginBottom: "20px" }}>
        <div className="stagger-col before">
          <span className="stagger-label">{t("stagger_uncoord")}</span>
          <strong>{result.baseline_wait_minutes} min</strong>
          <small>{result.baseline_queue_trucks} {lang === "id" ? "truk mengantre" : "queued trucks"}</small>
        </div>
        <div className="stagger-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowRight size={18} />
        </div>
        <div className="stagger-col after">
          <span className="stagger-label">{t("stagger_jwis")}</span>
          <strong>{result.optimized_wait_minutes} min</strong>
          <small>{result.optimized_queue_trucks} {lang === "id" ? "truk mengantre" : "queued trucks"}</small>
        </div>
        <div className="stagger-badge">-{result.queue_reduction_percent}% {t("stagger_delay_badge")}</div>
      </div>

      {result.dispatch_slots && result.dispatch_slots.length > 0 && (
        <div className="stagger-schedule-wrap">
          <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 10px", color: "var(--ui-ink)" }}>
            {lang === "id" ? "Rekomendasi Jadwal Keberangkatan Bertahap:" : "Recommended Staggered Departure Slots:"}
          </h3>
          <div className="table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "ID Truk" : "Truck ID"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Saran Jam Berangkat" : "Recommended Departure"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Estimasi Antre TPA" : "Est. Landfill Wait"}</th>
                  <th scope="col" style={{ width: "25%" }}>{lang === "id" ? "Status Jadwal" : "Slot Status"}</th>
                </tr>
              </thead>
              <tbody>
                {result.dispatch_slots.slice(0, 10).map((slot, i) => (
                  <tr key={i}>
                    <td><span className="plate-badge">T-00{slot.truck_index}</span></td>
                    <td>
                      <span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600 }}>
                        <Clock size={12} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "4px" }} />
                        {slot.suggested_departure} WIB
                      </span>
                    </td>
                    <td>
                      <span className="speed-badge">{slot.tpa_wait_est_minutes} min</span>
                    </td>
                    <td>
                      <span className="pill success">
                        <span className="status-dot success" />
                        {slot.slot_status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function getDistrictFromCoords(lat, lng) {
  if (lat > -6.18 && lng < 106.78) return "Cengkareng, Jakbar";
  if (lat > -6.18 && lng >= 106.78 && lng < 106.86) return "Kemayoran, Jakpus";
  if (lat > -6.18 && lng >= 106.86) return "Tanjung Priok, Jakut";
  if (lat <= -6.18 && lat > -6.23 && lng < 106.82) return "Kebon Jeruk, Jakbar";
  if (lat <= -6.18 && lat > -6.23 && lng >= 106.82) return "Jatinegara, Jaktim";
  if (lat <= -6.23 && lng >= 106.85) return "Pasar Rebo, Jaktim";
  if (lat <= -6.23 && lng < 106.85) return "Pasar Minggu, Jaksel";
  return "DKI Jakarta Area";
}

function UnlicensedCollectorAlerts() {
  const { t, lang } = useLanguage();
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
      <section className="panel wide unlicensed-alerts-panel">
        <div className="panel-title">
          <div>
            <h2>{t("unlicensed_title")}</h2>
            <p>{t("unlicensed_subtitle")}</p>
          </div>
          <div className="panel-header-icon-wrap warning">
            <AlertTriangle size={18} />
          </div>
        </div>
        <div className="empty-state compact">
          {loading ? (lang === "id" ? "Memuat telemetri deteksi..." : "Loading detection telemetry...") : (lang === "id" ? "Tidak ada peringatan kolektor liar terdeteksi." : "No unlicensed collector alerts detected.")}
        </div>
      </section>
    );
  }

  const unauthCount = alerts.alerts.filter(a => !enforced[a.plate]).length;

  return (
    <section className="panel wide unlicensed-alerts-panel">
      <div className="panel-title">
        <div>
          <h2>{t("unlicensed_title")}</h2>
          <p>{t("unlicensed_subtitle")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <StatusPill tone={unauthCount > 0 ? "danger" : "success"}>
            {unauthCount} {lang === "id" ? "tanpa izin" : "unauthorized"}
          </StatusPill>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "20%" }}>{t("unlicensed_th_plate")}</th>
              <th scope="col" style={{ width: "24%" }}>{t("unlicensed_th_loc")}</th>
              <th scope="col" style={{ width: "22%" }}>{t("unlicensed_th_coords")}</th>
              <th scope="col" style={{ width: "18%" }}>{t("unlicensed_th_status")}</th>
              <th scope="col" style={{ width: "16%" }}>{t("unlicensed_th_action")}</th>
            </tr>
          </thead>
          <tbody>
            {alerts.alerts.map((a, i) => {
              const isEnforced = Boolean(enforced[a.plate]);
              const districtName = getDistrictFromCoords(a.lat, a.lng);
              return (
                <tr key={i}>
                  <td>
                    <span className="plate-badge" style={{ fontSize: "13px" }}>{a.plate || "UNKNOWN"}</span>
                  </td>
                  <td>
                    <span className="zone-tag">{districtName}</span>
                  </td>
                  <td>
                    <span className="coord-chip"><MapPin size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</span>
                  </td>
                  <td>
                    <span className={`pill ${isEnforced ? "success" : "danger"}`}>
                      <span className={`status-dot ${isEnforced ? "success" : "danger"}`} />
                      {isEnforced ? t("unlicensed_dispatched") : t("unlicensed_unauth")}
                    </span>
                  </td>
                  <td>
                    <button 
                      className={`compact-enforce-btn ${isEnforced ? "enforced" : ""}`} 
                      onClick={() => handleEnforce(a.plate)}
                      disabled={isEnforced}
                    >
                      {isEnforced ? (
                        <>
                          <Check size={13} /> {t("btn_patrol_sent")}
                        </>
                      ) : (
                        <>
                          <Send size={13} /> {t("btn_dispatch_patrol")}
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="unlicensed-footer-meta">
        <ShieldCheck size={14} style={{ color: "var(--ui-accent)", flexShrink: 0 }} />
        <span>{lang === "id" ? "Pencocokan plat nomor dilakukan secara real-time terhadap registrasi armada DLH dan perizinan komersial." : "Matching is automated in real-time against DLH 2023 fleet registry and commercial vehicle licenses."}</span>
      </div>
    </section>
  );
}

function ReportActions() {
  const { t } = useLanguage();
  async function downloadSummaryPdf() {
    const response = await fetch(`${API_URL}/reports/executive-summary`);
    const data = await response.json();
    const impact = data.queue_impact || {};
    const impactHtml = impact.baseline_wait_minutes !== undefined
      ? `
      <h2>Queue Optimization Impact (Case 1)</h2>
      <p>Baseline (all trucks at peak): <b>${impact.baseline_queue_trucks} trucks, ${impact.baseline_wait_minutes} min wait</b> (p95 ${impact.baseline_p95_minutes} min)</p>
      <p>With staggered dispatch: <b>${impact.optimized_queue_trucks} trucks, ${impact.optimized_wait_minutes} min wait</b> (p95 ${impact.optimized_p95_minutes} min)</p>
      <p>Queue wait reduction: <b>-${impact.queue_reduction_percent}%</b> (${impact.method})</p>
      `
      : "";
    const hotspots = Array.isArray(data.top_hotspots) ? data.top_hotspots : [];
    const hotspotRows = hotspots.map((h) => `
      <tr>
        <td>${h.kecamatan}</td><td>${h.city}</td>
        <td>${h.predicted_tons} t/day</td><td>${h.trucks_required}</td>
        <td>${h.crews_required}</td><td>${h.man_hours_required}</td>
      </tr>`).join("");
    const hotspotsHtml = hotspotRows ? `
      <h2>Predicted Hotspots &amp; Resource Readiness (Case 2)</h2>
      <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-size:12px;">
        <thead><tr><th>District</th><th>City</th><th>Forecast</th><th>Trucks</th><th>Crews</th><th>Man-hours</th></tr></thead>
        <tbody>${hotspotRows}</tbody>
      </table>` : "";
    const fs = data.fleet_status || {};
    const activityLine = fs.by_activity
      ? Object.entries(fs.by_activity).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ")
      : "";
    const fleetHtml = fs.total_trucks
      ? `
      <h2>Fleet Condition (Case 1)</h2>
      <p><b>${fs.total_trucks} units</b> tracked — ${fs.damaged_count} with open damage status.</p>
      <p>Activity: ${activityLine}</p>
      `
      : "";
    const gap = data.facility_summary || {};
    const gapHtml = gap.kecamatan_total
      ? `
      <h2>Facility Gap Analysis (Case 2)</h2>
      <p>${gap.critical_count} critical districts · total gap <b>${gap.total_gap_ton_per_day} t/day</b> ·
      +${gap.total_extra_trucks_needed} trips/day recommended · ${gap.total_new_tps_sites_needed} new TPS sites (bounded share).</p>
      `
      : "";
    const node = document.createElement("section");
    node.className = "pdf-report";
    node.innerHTML = `
      <h1>JWIS Executive Summary</h1>
      <p class="pdf-date">Generated by Jakarta Waste Intelligence System</p>
      <p>${data.summary}</p>
      ${impactHtml}
      ${fleetHtml}
      ${hotspotsHtml}
      ${gapHtml}
      <h2>Audit &amp; Evidence Trail</h2>
      <ul>
        <li>AI route deviation detection (Isolation Forest + corridor geometry) with follow-up trail (OPEN &rarr; DISPATCHED &rarr; RESOLVED)</li>
        <li>Permit-compliant A* rerouting with computed alternative corridors (JORR bypass, coastal toll)</li>
        <li>Prophet+XGBoost forecast over real SILIKA/SIPSN/Open-Meteo data; hotspot rank Spearman 0.998</li>
        <li>Field dispatch loop with driver confirmation and offline sync</li>
      </ul>
      <p style="font-size:11px;color:#666;">${data.model_suitability_note || ""}</p>
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
    <button 
      className="primary-button" 
      onClick={downloadSummaryPdf} 
      style={{ width: "auto", minHeight: "38px", height: "38px", padding: "0 18px", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}
    >
      <Download size={15} /> {t("btn_export_pdf")}
    </button>
  );
}

function CarbonPanel() {
  const { lang } = useLanguage();
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
          <h2>{lang === "id" ? "Pelacak Jejak Karbon Armada" : "Carbon Footprint Tracker"}</h2>
          <p>{lang === "id" ? "Emisi CO2 armada dan penghematan optimasi rute (Standar Euro 4 diesel: 0.95 kg CO2/km)." : "Fleet CO2 emissions and route-optimization savings (Euro 4 diesel: 0.95 kg CO2/km)."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Leaf size={18} />
        </div>
      </div>
      <div className="carbon-grid">
        <div className="carbon-stat">
          <span>{lang === "id" ? "Total Jarak Tempuh" : "Total Distance"}</span>
          <strong>{carbon.total_fleet_distance_km} km</strong>
        </div>
        <div className="carbon-stat">
          <span>{lang === "id" ? "Emisi CO2 Dihasilkan" : "CO2 Emitted"}</span>
          <strong>{carbon.total_co2_emitted_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>{lang === "id" ? "CO2 Berhasil Dihemat" : "CO2 Saved"}</span>
          <strong style={{ color: "#15803d" }}>{carbon.carbon_saved_today_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>{lang === "id" ? "Bahan Bakar Dihemat" : "Fuel Saved"}</span>
          <strong style={{ color: "#15803d" }}>{carbon.fuel_saved_equivalent_liters} L</strong>
        </div>
      </div>
      <div className="carbon-badge">
        <Leaf size={16} /> {lang === "id" ? `Tingkat kepatuhan rute optimal: ${carbon.compliance_rate_percent}% — setara dengan menanam ${Math.round(carbon.carbon_saved_today_kg / 21)} pohon/hari` : `Optimal-route compliance: ${carbon.compliance_rate_percent}% — equivalent to planting ${Math.round(carbon.carbon_saved_today_kg / 21)} trees/day`}
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
        <div className="panel-header-icon-wrap">
          <History size={18} />
        </div>
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
              <th scope="col" style={{ width: "16%" }}>Truck</th>
              <th scope="col" style={{ width: "18%" }}>Driver</th>
              <th scope="col" style={{ width: "16%" }}>Date</th>
              <th scope="col" style={{ width: "14%" }}>Distance</th>
              <th scope="col" style={{ width: "12%" }}>Fuel Consumed</th>
              <th scope="col" style={{ width: "12%" }}>GPS Points</th>
              <th scope="col" style={{ width: "12%" }}>Deviation Status</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td className="table-empty-state" colSpan={7}>No trip history recorded for the selected filter.</td></tr>
            ) : (
              history.map((trip) => {
                const devCount = trip.deviations_count ?? trip.deviations_detected ?? 0;
                return (
                  <tr key={`${trip.truck_code}-${trip.date}`}>
                    <td><span className="plate-badge">{trip.truck_code}</span></td>
                    <td><strong style={{ color: "var(--ui-ink)", fontWeight: 600 }}>{trip.driver_name}</strong></td>
                    <td><span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>{trip.date}</span></td>
                    <td><span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600 }}>{trip.distance_km} km</span></td>
                    <td><span style={{ fontFamily: "var(--mono, monospace)", color: "var(--ui-muted)" }}>{trip.fuel_consumed_liters} L</span></td>
                    <td><span className="speed-badge">{trip.points?.length || 0} pts</span></td>
                    <td>
                      <span className={`pill ${devCount > 0 ? "danger" : "success"}`}>
                        <span className={`status-dot ${devCount > 0 ? "danger" : "success"}`} />
                        {devCount > 0 ? `${devCount} deviations` : "Compliant"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DriverAnalytics() {
  const { lang } = useLanguage();
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
          <h2>{lang === "id" ? "Analisis Kinerja Pengemudi" : "Driver Performance Analytics"}</h2>
          <p>{lang === "id" ? "Penilaian skor kepatuhan koridor rute, keselamatan, dan efisiensi bahan bakar driver." : "Real-time scoring of route corridor compliance, safety, and fuel efficiency across active drivers."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Truck size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Rata-rata Skor" : "Fleet Avg Score"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>88.75%</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Pengemudi Aktif" : "Active Drivers"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{drivers.length} {lang === "id" ? "orang" : "personnel"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Efisiensi BBM" : "Avg Fuel Economy"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>4.28 km/L</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Bebas Pelanggaran" : "Zero-Deviation"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#15803d" }}>50% {lang === "id" ? "patuh" : "compliant"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "22%" }}>{lang === "id" ? "Nama Pengemudi" : "Driver Name"}</th>
              <th scope="col" style={{ width: "16%" }}>{lang === "id" ? "Kode Truk" : "Assigned Truck"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Skor Kepatuhan Koridor" : "Compliance Score"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Efisiensi Bahan Bakar" : "Fuel Economy"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Total Trip" : "Trips"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Deviasi Rute" : "Deviations"}</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => {
              const isHigh = d.score >= 90;
              const isMed = d.score >= 80;
              const scoreTone = isHigh ? "success" : isMed ? "warning" : "danger";
              return (
                <tr key={d.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11.5px", fontWeight: 700, color: "#334155" }}>
                        {d.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <strong style={{ color: "var(--ui-ink)", fontWeight: 600 }}>{d.name}</strong>
                    </div>
                  </td>
                  <td><span className="plate-badge">{d.truck}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ flex: 1, height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
                        <div style={{ height: "100%", width: `${d.score}%`, background: isHigh ? "#16a34a" : isMed ? "#d97706" : "#dc2626", borderRadius: "9999px" }} />
                      </div>
                      <span className={`pill ${scoreTone}`} style={{ minWidth: "46px", justifyContent: "center" }}>{d.score}%</span>
                    </div>
                  </td>
                  <td><span className="speed-badge">{d.fuel} km/L</span></td>
                  <td><span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 600 }}>{d.trips}</span></td>
                  <td>
                    <span className={`pill ${d.deviations > 0 ? "danger" : "success"}`}>
                      <span className={`status-dot ${d.deviations > 0 ? "danger" : "success"}`} />
                      {d.deviations > 0 ? `${d.deviations} ${lang === "id" ? "kali" : "alerts"}` : (lang === "id" ? "Nihil" : "None")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeighbridgeLogs() {
  const { lang } = useLanguage();
  const logs = [
    { time: "16:45:12", truck: "T-001", type: "Dump Truck Besar", gross: 24.2, tare: 6.0, net: 18.2, status: "SUCCESS" },
    { time: "16:42:05", truck: "T-088", type: "Arm Roll Besar", gross: 23.8, tare: 5.8, net: 18.0, status: "SUCCESS" },
    { time: "16:35:50", truck: "T-136", type: "Dump Truck Kecil", gross: 12.5, tare: 3.5, net: 9.0, status: "SUCCESS" },
    { time: "16:30:14", truck: "T-112", type: "Compactor Kecil", gross: 11.2, tare: 3.2, net: 8.0, status: "SUCCESS" },
    { time: "16:15:22", truck: "T-047", type: "Compactor Besar", gross: 24.5, tare: 6.2, net: 18.3, status: "SUCCESS" },
  ];

  const totalNet = logs.reduce((sum, l) => sum + l.net, 0);

  return (
    <section className="panel wide">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Catatan Penimbangan Jembatan Timbang" : "Weighbridge Weighing Records"}</h2>
          <p>{lang === "id" ? "Transaksi real-time dari sensor timbangan digital TPA Bantargebang." : "Real-time transactions ingested from Bantargebang weighbridge digital telemetry scales."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Workflow size={18} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Total Muatan Masuk" : "Total Ingested Load"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{totalNet.toFixed(1)} {lang === "id" ? "ton" : "tons"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Status Timbangan" : "Scale Status"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "#15803d" }}>{lang === "id" ? "Timbangan #01 — Aktif" : "Scale #01 — Online"}</strong>
        </div>
        <div style={{ background: "var(--ui-surface-muted)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--ui-border)" }}>
          <span style={{ fontSize: "11px", color: "var(--ui-muted)", textTransform: "uppercase", fontWeight: 600 }}>{lang === "id" ? "Rata-rata Muatan Bersih" : "Avg Net Tonnage"}</span>
          <strong style={{ display: "block", fontSize: "18px", marginTop: "2px", color: "var(--ui-ink)" }}>{(totalNet / logs.length).toFixed(1)} t / {lang === "id" ? "truk" : "truck"}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Waktu Transaksi" : "Timestamp"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Kode Truk" : "Truck Code"}</th>
              <th scope="col" style={{ width: "22%" }}>{lang === "id" ? "Kategori Kendaraan" : "Vehicle Category"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Berat Kotor" : "Gross Weight"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Berat Tara" : "Tare Weight"}</th>
              <th scope="col" style={{ width: "14%" }}>{lang === "id" ? "Berat Bersih" : "Net Weight"}</th>
              <th scope="col" style={{ width: "12%" }}>{lang === "id" ? "Status" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l, idx) => (
              <tr key={idx}>
                <td>
                  <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                    <Clock size={11} style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }} />
                    {l.time}
                  </span>
                </td>
                <td><span className="plate-badge">{l.truck}</span></td>
                <td><span className="zone-tag">{l.type}</span></td>
                <td><span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 500 }}>{l.gross} t</span></td>
                <td><span style={{ fontFamily: "var(--mono, monospace)", color: "var(--ui-muted)" }}>{l.tare} t</span></td>
                <td><strong style={{ fontFamily: "var(--mono, monospace)", color: "var(--ui-ink)", fontWeight: 700 }}>{l.net} t</strong></td>
                <td>
                  <span className="pill success">
                    <span className="status-dot success" />
                    {l.status}
                  </span>
                </td>
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
  const [followUps, setFollowUps] = useState([]);
  const [status, setStatus] = useState({ configured: false, connected: false, base_url: "", session_id: "", message: "" });
  const [qrState, setQrState] = useState({ state: "unknown", qr: null });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsFilter, setGroupsFilter] = useState("");

  const driverDisplay = (jid) => {
    if (!jid) return "";
    const digits = jid.replace(/\D/g, "");
    return digits.startsWith("62") && digits.length > 2 ? "0" + digits.slice(2) : jid;
  };

  const groupLabel = (g) => {
    const dupes = groups.filter((x) => x.subject === g.subject);
    return dupes.length > 1 ? `${g.subject} (…${g.jid.slice(-4)})` : g.subject;
  };

  const groupDisplay = (jid) => {
    if (!jid) return "";
    const match = groups.find((g) => g.jid === jid);
    if (match) return groupLabel(match);
    if (!jid.endsWith("@g.us")) return jid;
    return "";
  };

  const loadGroups = async () => {
    setGroupsLoading(true);
    try {
      const res = await fetch(`${API_URL}/whatsapp/groups`);
      const data = await res.json();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (err) {
      console.error("Failed to load WA groups", err);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

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

  const fetchQr = async () => {
    let result = null;
    try {
      const res = await fetch(`${API_URL}/whatsapp/qr`);
      result = await res.json();
      setQrState(result);
    } catch (err) {
      console.error("Failed to load WA QR", err);
    }
    return result;
  };

  const waitForFreshQr = async () => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      fetchStatus();
      const next = await fetchQr();
      if (next && next.state === "qr" && next.qr) break;
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setQrState({ state: "starting", qr: null });
    try {
      await fetch(`${API_URL}/whatsapp/logout`, { method: "POST" });
    } catch (err) {
      console.error("Failed to logout WA session", err);
    }
    await waitForFreshQr();
    setBusy(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStatus();
    fetchQr();
    fetchLogs();
    setTimeout(() => setRefreshing(false), 800);
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

  const fetchFollowUps = async () => {
    try {
      const res = await fetch(`${API_URL}/alert/follow-ups`);
      if (!res.ok) return;
      const records = await res.json();
      setFollowUps(records);
    } catch (err) {
      console.error("Failed to load follow-ups", err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchStatus();
    fetchQr();
    fetchLogs();
    fetchFollowUps();
    loadGroups();
    const interval = setInterval(() => {
      fetchStatus();
      fetchQr();
    }, 3000);
    return () => clearInterval(interval);
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
        fetchConfig();
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
            <button type="button" className="ghost-button" onClick={handleRefresh} title="Refresh status & QR now" disabled={refreshing || busy}>
              <RefreshCcw size={16} /> Refresh
            </button>
          </div>
          <dl className="approval-evidence-list mt-16">
            <div><dt>Gateway</dt><dd>Baileys WhatsApp Gateway</dd></div>
            <div>
              <dt>Status</dt>
              <dd>
                {status.connected ? (
                  <span className="wa-live-badge"><span className="wa-live-dot" /> CONNECTED</span>
                ) : (
                  <span className={`pill ${qrState.state === "qr" ? "success" : qrState.state === "gateway_offline" ? "danger" : "warning"}`}>
                    {qrState.state === "qr" ? "SCAN QR" : qrState.state === "gateway_offline" ? "GATEWAY OFFLINE" : qrState.state === "starting" ? "CONNECTING..." : "DISCONNECTED"}
                  </span>
                )}
              </dd>
            </div>
            <div><dt>Gateway state</dt><dd className="mono">{qrState.state || status.state || "unknown"}</dd></div>
            <div><dt>Session JID</dt><dd className="mono">{status.session_id || "default"}@c.us</dd></div>
            {!status.connected && status.message && <div><dt>Reason</dt><dd>{status.message}</dd></div>}
          </dl>

          {!status.connected && (
            <div className="wa-pairing">
              {qrState.state === "qr" && qrState.qr ? (
                <>
                  <img className="wa-qr-image" src={qrState.qr} alt="WhatsApp pairing QR" />
                  <ol className="wa-qr-steps">
                    <li>Open WhatsApp on the operator phone.</li>
                    <li>Go to <b>Settings → Linked Devices → Link a Device</b>.</li>
                    <li>Point the phone at this QR code.</li>
                    <li>Wait — the status above turns <b>CONNECTED</b> automatically.</li>
                  </ol>
                </>
              ) : (
                <p className="text-muted small">
                  {qrState.state === "starting" || qrState.state === "closed"
                    ? "Waiting for a fresh QR from the gateway — this can take a few seconds after logout."
                    : "No QR available yet. Make sure the WhatsApp gateway is running (npm start in backend/wa-gateway) and not already paired."}
                </p>
              )}
              {busy && <p className="text-muted small">Re-pairing — waiting for a fresh QR...</p>}
            </div>
          )}

          <div className="wa-connection-actions">
            {status.connected ? (
              <button type="button" className="ghost-button wa-logout-button wa-danger-button" onClick={handleLogout} disabled={busy}>
                {busy ? "Logging out..." : <><LogOut size={16} /> Disconnect & Unlink</>}
              </button>
            ) : (
              <button type="button" className="ghost-button wa-logout-button" onClick={handleLogout} disabled={busy}>
                {busy ? "Re-creating session..." : <><RefreshCcw size={16} /> Reset & Get New QR</>}
              </button>
            )}
          </div>
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
                    value={driverDisplay(config.drivers[driverName])}
                    onChange={(e) => {
                      const newDrivers = { ...config.drivers, [driverName]: e.target.value };
                      setConfig({ ...config, drivers: newDrivers });
                    }}
                    placeholder="e.g. 081234567890"
                  />
                </div>
              ))}
            </div>

            <div className="wa-field-stack">
              <strong>Coordination Group:</strong>
              <input
                type="text"
                value={groupDisplay(config.group_jid)}
                onChange={(e) => setConfig({ ...config, group_jid: e.target.value })}
                placeholder="08123... atau pilih dari daftar"
              />
              <div className="wa-group-tools">
                <button type="button" className="ghost-button" onClick={loadGroups} disabled={groupsLoading || status.connected === false}>
                  {groupsLoading ? "Loading..." : "Load My Groups"}
                </button>
                {groups.length > 0 && (
                  <>
                    <input
                      type="text"
                      className="wa-group-search"
                      value={groupsFilter}
                      onChange={(e) => setGroupsFilter(e.target.value)}
                      placeholder="Cari grup (mis. JWIS)..."
                    />
                    <select
                      className="wa-group-select"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setConfig({ ...config, group_jid: e.target.value });
                      }}
                    >
                      <option value="">Pilih grup WhatsApp...</option>
                      {groups
                        .filter((g) => !groupsFilter || (g.subject || "").toLowerCase().includes(groupsFilter.toLowerCase()))
                        .map((g) => (
                          <option key={g.jid} value={g.jid}>{groupLabel(g)}</option>
                        ))}
                    </select>
                  </>
                )}
              </div>
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
            onClick={() => { fetchLogs(); fetchStatus(); fetchFollowUps(); }} 
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
        {followUps.length > 0 && (
          <div className="table-wrap wa-log-table fu-trail-table">
            <h3 className="fu-trail-title">Follow-up Trail (supervisor actions)</h3>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Alert ID</th>
                  <th>Status</th>
                  <th>Operator</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((rec, idx) => {
                  const p = rec.payload || {};
                  const statusCls = p.status === "RESOLVED" ? "success" : p.status === "DISPATCHED" ? "warning" : "danger";
                  return (
                    <tr key={idx}>
                      <td><span className="mono">{new Date(rec.created_at).toLocaleString()}</span></td>
                      <td><span className="mono">{p.alert_id}</span></td>
                      <td><span className={`pill ${statusCls}`}>{p.status}</span></td>
                      <td><b className="wa-recipient">{p.operator}</b></td>
                      <td><span className="wa-message-cell">{p.note || "—"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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

function LiveSurveillancePanel() {
  const { lang } = useLanguage();
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState("");

  async function fetchFeed() {
    try {
      const res = await fetch(`${API_URL}/cv/surveillance-feed`);
      if (res.ok) {
        setFeed(await res.json());
        setError("");
      }
    } catch {
      setError("CV feed endpoint unavailable");
    }
  }

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, []);

  const events = feed?.events || [];
  const last = events[0] || null;
  const streaming = feed?.status === "streaming";

  return (
    <section className="panel wide" data-testid="live-surveillance-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Pengawasan Gerbang ANPR Real-Time" : "Live Surveillance — ANPR Gate Feed"}</h2>
          <p>
            {feed?.source === "simulated"
              ? (lang === "id" ? "Telemetri kamera gerbang: Deteksi truk YOLO + pengenalan plat OCR dengan verifikasi izin DLH." : "Automated gate camera telemetry: YOLO vehicle detection + OCR plate recognition with whitelist verification.")
              : (lang === "id" ? "Pengenalan Plat Nomor Otomatis di gerbang operasional TPA dan transfer station." : "Automatic Number-Plate Recognition at operational landfill & transfer station gates.")}
          </p>
        </div>
        <div className="panel-header-icon-wrap">
          <Cctv size={18} />
        </div>
      </div>

      <div className="tpa-status-grid">
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Status Aliran Kamera" : "Camera Stream Status"}</span>
          <strong className={streaming ? "text-success" : "text-danger"}>
            <span className={`status-dot ${streaming ? "success" : "danger"}`} style={{ display: "inline-block", marginRight: "6px" }} />
            {streaming ? (lang === "id" ? "STREAMING (24 FPS)" : "STREAMING (24 FPS)") : (feed?.status || "OFFLINE").toUpperCase()}
          </strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Mesin Inferensi" : "Inference Engine"}</span>
          <strong>{feed?.device === "cuda" ? (lang === "id" ? "Akselerasi GPU (CUDA)" : "GPU Accelerated (CUDA)") : (feed?.device || "Edge CPU")}</strong>
        </div>
        <div className="tpa-status-card">
          <span>{lang === "id" ? "Total Plat Terbaca" : "Total Plates Read"}</span>
          <strong style={{ color: "var(--ui-ink)" }}>{feed?.plates_read ?? 0} {lang === "id" ? "terbaca" : "scanned"}</strong>
        </div>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {feed?.error && <p className="text-danger">Feed error: {feed.error}</p>}
      {feed && !feed.error && (
        <p className="text-muted small" style={{ marginBottom: "16px" }}>
          {feed.trucks_detected || 0} {lang === "id" ? "truk terdeteksi" : "trucks detected"} · {feed.frames_processed || 0} {lang === "id" ? "frame diproses" : "frames processed"} · {feed.video || "gate-cam-01.mp4"}
        </p>
      )}

      {last && (
        <div className={`cv-last-event ${last.severity === "critical" ? "cv-event-critical" : "cv-event-ok"}`} style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="plate-badge" style={{ fontSize: "14px", padding: "4px 10px" }}>{last.plate}</span>
              <span className={`pill ${last.severity === "critical" ? "danger" : "success"}`}>
                <span className={`status-dot ${last.severity === "critical" ? "danger" : "success"}`} />
                {last.authorized ? (lang === "id" ? "KENDARAAN TERDAFTAR" : "AUTHORIZED VEHICLE") : (lang === "id" ? "KOLEKTOR LIAR TERDETEKSI" : "UNLICENSED DETECTED")}
              </span>
            </div>
            <span style={{ fontSize: "12px", color: "var(--ui-muted)", fontFamily: "var(--mono, monospace)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Clock size={12} />
              {last.timestamp}
            </span>
          </div>
          <p style={{ margin: "8px 0 4px", fontSize: "13px", color: "var(--ui-ink)" }}>{last.reason}</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <small style={{ color: "var(--ui-muted)" }}>{lang === "id" ? "Akurasi Pengenalan:" : "Recognition Confidence:"}</small>
            <div style={{ width: "120px", height: "6px", background: "var(--ui-surface-muted)", borderRadius: "9999px", overflow: "hidden", border: "1px solid var(--ui-border)" }}>
              <div style={{ width: `${Math.round(last.confidence * 100)}%`, height: "100%", background: last.authorized ? "#16a34a" : "#dc2626" }} />
            </div>
            <small style={{ fontWeight: 700, color: "var(--ui-ink)" }}>{Math.round(last.confidence * 100)}%</small>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ui-border)", background: "var(--ui-surface-muted)" }}>
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "var(--ui-ink)" }}>{lang === "id" ? "Log Verifikasi Plat Gerbang Terkini" : "Recent Gate ANPR Verification Logs"}</h3>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: "18%" }}>{lang === "id" ? "Waktu" : "Timestamp"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Plat Kendaraan" : "Vehicle Plate"}</th>
              <th scope="col" style={{ width: "24%" }}>{lang === "id" ? "Status Izin" : "Registry Status"}</th>
              <th scope="col" style={{ width: "18%" }}>{lang === "id" ? "Akurasi OCR" : "OCR Confidence"}</th>
              <th scope="col" style={{ width: "16%" }}>{lang === "id" ? "Tindakan Gerbang" : "Gate Action"}</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--ui-muted)" }}>
                  {lang === "id" ? "Belum ada rekaman plat terdeteksi — menunggu kendaraan masuk." : "No plate events detected yet — awaiting incoming vehicle."}
                </td>
              </tr>
            ) : (
              events.map((ev, i) => {
                const isAuth = Boolean(ev.authorized);
                return (
                  <tr key={i}>
                    <td>
                      <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", color: "var(--ui-muted)" }}>
                        {ev.timestamp}
                      </span>
                    </td>
                    <td>
                      <span className="plate-badge">{ev.plate}</span>
                    </td>
                    <td>
                      <span className={`pill ${isAuth ? "success" : "danger"}`}>
                        <span className={`status-dot ${isAuth ? "success" : "danger"}`} />
                        {isAuth ? (lang === "id" ? "Terdaftar" : "Authorized") : (lang === "id" ? "Kolektor Liar" : "Unlicensed")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontFamily: "var(--mono, monospace)", fontSize: "12px", fontWeight: 600 }}>
                          {Math.round(ev.confidence * 100)}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: isAuth ? "#15803d" : "#b91c1c" }}>
                        {isAuth ? (lang === "id" ? "Palang Dibuka" : "Gate Opened") : (lang === "id" ? "Diperiksa Petugas" : "Flagged for Inspection")}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CommandCenter({ onLogout }) {
  const { t, lang } = useLanguage();
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
  const [forecastHorizon, setForecastHorizon] = useState("7d");

  // Map state lifted from LiveFleetMap
  const [layers, setLayers] = useState({ heatmap: false, osrm: true, unlicensed: true, tps: true, wr: true });
  const [playbackTruck, setPlaybackTruck] = useState(null);
  const [playbackOptions, setPlaybackOptions] = useState([]);
  const [jamActive, setJamActive] = useState(false);
  const [aiEvents, setAiEvents] = useState([]);

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/fleet/astar-reroute`)
        .then((r) => r.json())
        .then((body) => setJamActive(Boolean(body.jam_active)))
        .catch(() => {});
      fetch(`${API_URL}/ai/events`)
        .then((r) => r.json())
        .then((body) => setAiEvents(body.events || []))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const ackAiEvent = useCallback((index) => {
    fetch(`${API_URL}/ai/events/${index}/ack`, { method: "POST" })
      .then(() => fetch(`${API_URL}/ai/events`))
      .then((r) => r.json())
      .then((body) => setAiEvents(body.events || []))
      .catch(() => {});
  }, []);

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
            { label: t("kpi_active_trucks"), value: snapshot.kpis.active_trucks, helper: t("kpi_active_trucks_sub") },
            { label: t("kpi_operational_issues"), value: snapshot.kpis.trucks_with_issues, helper: t("kpi_operational_issues_sub"), tone: "danger" },
            { label: t("kpi_landfill_queue"), value: `${snapshot.kpis.tpa_wait_minutes}m`, helper: `${snapshot.kpis.tpa_queue_trucks} ${t("kpi_landfill_queue_sub")}`, tone: "warning" },
            { label: t("kpi_waste_spike"), value: `+${snapshot.kpis.predicted_spike_percent}%`, helper: t("kpi_waste_spike_sub"), tone: "warning" },
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
                jamActive={jamActive}
              />
            </div>
          )}
          mapFooter={(
            <>
              <div className="map-footer-panels">
                <div className="panel map-controls-card">
                  <div className="panel-title">
                    <h2>{lang === "id" ? "Kontrol Peta" : "Map Controls"}</h2>
                  </div>
                  <div className="map-controls-grid">
                    <label><input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} /> {lang === "id" ? "Peta Panas" : "Heatmap"}</label>
                    <label><input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} /> {lang === "id" ? "Rute OSRM" : "OSRM route"}</label>
                    <label><input type="checkbox" checked={layers.tps} onChange={(e) => setLayers((s) => ({ ...s, tps: e.target.checked }))} /> {lang === "id" ? "Titik TPS" : "TPS"}</label>
                    <label><input type="checkbox" checked={layers.wr} onChange={(e) => setLayers((s) => ({ ...s, wr: e.target.checked }))} /> {lang === "id" ? "Wajib Retribusi" : "Retribution registry"}</label>
                  </div>
                  <div className="playback-select-wrap">
                    <select value={playbackTruck || ""} onChange={(e) => setPlaybackTruck(e.target.value || null)} aria-label="Trip playback">
                      <option value="">{lang === "id" ? "Putar riwayat rute..." : "Trip playback..."}</option>
                      {playbackOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="panel map-legend-card">
                  <div className="panel-title">
                    <h2>{lang === "id" ? "Legenda Peta" : "Legend"}</h2>
                  </div>
                  <details className="map-legend" open aria-label="Map legend">
                    <summary style={{ display: "none" }}>Legend</summary>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#22c55e", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> {lang === "id" ? "Titik TPS" : "TPS locations"} <em className="legend-tag">REAL</em></span>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#f97316", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> {lang === "id" ? "Wajib Retribusi" : "Retribution registry"} <em className="legend-tag">REAL</em></span>
                    <span><i className="legend-heatmap" style={{ backgroundColor: "#a5b4fc", display: "inline-block" }} /> {lang === "id" ? "Risiko Sampah Wilayah" : "District waste risk"} <em className="legend-tag">MODEL</em></span>
                    <span><i className="legend-assigned" style={{ display: "inline-block" }} /> {lang === "id" ? "Koridor Ditugaskan" : "Assigned corridor"} <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-actual" style={{ backgroundColor: "#176b54", display: "inline-block" }} /> {lang === "id" ? "Rute Aktual" : "Actual (clean)"} <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-critical" style={{ backgroundColor: "#b42318", borderRadius: "50%", width: "10px", height: "10px", display: "inline-block" }} /> {lang === "id" ? "Segmen Pelanggaran" : "Violation segment"} <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-osrm" style={{ backgroundColor: "#0891b2", display: "inline-block" }} /> {lang === "id" ? "Rute OSRM" : "OSRM route"} <em className="legend-tag">LIVE</em></span>
                    <span><span className="legend-icon-tpa" /> TPA Bantargebang <em className="legend-tag">MODEL</em></span>
                    <span><span className="legend-icon-unlicensed" /> {lang === "id" ? "Kolektor Liar" : "Unlicensed Collector"} <em className="legend-tag">SIM</em></span>
                    <span><i className="legend-event" style={{ backgroundColor: "#eab308", borderRadius: "4px", width: "16px", height: "12px", display: "inline-block" }} /> {lang === "id" ? "Event Keramaian" : "Crowd Event"} <em className="legend-tag">SIM</em></span>
                  </details>
                </div>
              </div>

              <div className="map-footer-inspector-row">
                <div className="inspector-col">
                  <AlertQueue alerts={snapshot.alerts} onDispatch={dispatch} onWhatsApp={sendWhatsAppAlert} />
                </div>
                <div className="inspector-col">
                  <AStarReroutingPanel jamActive={jamActive} aiEvents={aiEvents} onAckEvent={ackAiEvent} />
                </div>
              </div>
            </>
          )}
          alerts={null}
          rerouting={null}
          routeEvidence={<RouteEvidencePanel route={snapshot.osrm_route} />}
          queue={<div className="fleet-queue-stack"><TpaQueuePanel /><StaggerSimulatorPanel /></div>}
          fleetTable={<FleetTable trucks={snapshot.trucks} onOpenTripHistory={(code) => selectFleetTruck(code, true)} />}
          unlicensedTable={<UnlicensedCollectorAlerts />}
          history={<FleetHistoryPanel filterTruck={filterTruck} setFilterTruck={setFilterTruck} />}
          carbon={<CarbonPanel />}
        />
      )}

      {activeWorkspace !== "fleet" && (
        <section className="main-grid">
        {activeWorkspace === "forecast" && (
          <WasteForecast
            metrics={[
              { label: lang === "id" ? "Lonjakan Terbesar" : "Largest forecast spike", value: `+${snapshot.kpis.predicted_spike_percent}%`, helper: lang === "id" ? "7 hari ke depan" : "next 7 days", tone: "warning" },
              { label: lang === "id" ? "Distrik Risiko Tinggi" : "High-risk districts", value: snapshot.critical_predictions.length, helper: lang === "id" ? "perlu penguatan armada" : "capacity reinforcement needed", tone: "danger" },
              { label: lang === "id" ? "Puncak Curah Hujan" : "Peak rainfall", value: `${Math.round(Math.max(...snapshot.weather.forecast.map((day) => day.rainfall_mm)))} mm`, helper: lang === "id" ? "faktor pemicu timbulan" : "forecast driver", tone: "warning" },
              { label: lang === "id" ? "Status Perencanaan" : "Planning status", value: lang === "id" ? "Siap" : "Ready", helper: lang === "id" ? "dapat dialihkan ke perencana" : "scenario handoff enabled" },
            ]}
            forecast={<PredictionPanel predictions={snapshot.critical_predictions} allPredictions={snapshot.predictions} />}
            weather={<WeatherPanel weather={snapshot.weather} />}
            events={<>
              <CrowdEventsPanel onSimulateEvent={(ev) => {
                setAttendance(ev.expected_attendance);
                setRainfall(10);
                setEventLat(ev.lat);
                setEventLng(ev.lng);
                setActiveWorkspace("planning");
              }} />
            </>}
            districts={<>
              <KecamatanMapPanel horizon={forecastHorizon} />
              <PermitSubmissionPanel onPermitSubmitted={(permit) => {
                setAttendance(permit.expected_attendance);
                setEventLat(permit.lat);
                setEventLng(permit.lng);
              }} />
              <FacilityGapPanel rainfall={rainfall} attendance={attendance} />
            </>}
            reportActions={<ReportActions />}
            horizon={forecastHorizon}
            onHorizonChange={setForecastHorizon}
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

        {activeWorkspace === "surveillance" && (
          <div className="grid-col-12">
            <LiveSurveillancePanel />
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

createRoot(document.getElementById("root")).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
