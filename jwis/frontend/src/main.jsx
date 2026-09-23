import React, { Fragment, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { readOutbox, enqueue, flushOutbox } from "./field/OfflineOutbox.js";
import FieldApp from "./field/FieldApp.jsx";
import DriverApp from "./driver/DriverApp.jsx";
import { AppShell } from "./layout/AppShell.jsx";
import { FleetOperations } from "./workspaces/FleetOperations.jsx";
import { ActionCard } from "./workspaces/ActionCard.jsx";
import { SupervisorView } from "./pages/SupervisorView.jsx";
import { IntegratedPlanning } from "./workspaces/IntegratedPlanning.jsx";
import { WasteForecast } from "./workspaces/WasteForecast.jsx";
import { LanguageProvider, useLanguage } from "./i18n.jsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { useSnapshot } from "./hooks/useSnapshot.js";
import { StatusPill } from "./ui/StatusPill.jsx";
import { AlertQueue } from "./workspaces/AlertQueue.jsx";
import { RouteEvidencePanel } from "./workspaces/RouteEvidencePanel.jsx";
import { PredictionPanel } from "./workspaces/PredictionPanel.jsx";
import { PERMIT_VENUE_PRESETS, PermitSubmissionPanel } from "./workspaces/PermitSubmissionPanel.jsx";
import { FacilityGapPanel } from "./workspaces/FacilityGapPanel.jsx";
import { KecamatanMapPanel } from "./workspaces/KecamatanMapPanel.jsx";
import { DataAuditWorkspace } from "./workspaces/DataAuditWorkspace.jsx";
import { WeatherPanel } from "./workspaces/WeatherPanel.jsx";
import { FleetTable } from "./workspaces/FleetTable.jsx";
import { ExecutiveSummary } from "./workspaces/ExecutiveSummary.jsx";
import { AssistantPanel } from "./workspaces/AssistantPanel.jsx";
import { ScenarioPanel, PlanningApproval } from "./workspaces/PlanningApproval.jsx";
import { PlanningDecisionFlow } from "./workspaces/PlanningDecisionFlow.jsx";
import { TpaQueuePanel } from "./workspaces/TpaQueuePanel.jsx";
import { CrowdEventsPanel } from "./workspaces/CrowdEventsPanel.jsx";
import { AiNotificationFeed, AStarReroutingPanel } from "./workspaces/AStarReroutingPanel.jsx";
import { StaggerSimulatorPanel } from "./workspaces/StaggerSimulatorPanel.jsx";
import { UnlicensedCollectorAlerts } from "./workspaces/UnlicensedCollectorAlerts.jsx";
import { ReportActions } from "./workspaces/ReportActions.jsx";
import { CarbonPanel } from "./workspaces/CarbonPanel.jsx";
import { FleetHistoryPanel } from "./workspaces/FleetHistoryPanel.jsx";
import { DriverAnalytics } from "./workspaces/DriverAnalytics.jsx";
import { WeighbridgeLogs } from "./workspaces/WeighbridgeLogs.jsx";
import { WhatsAppGateway } from "./workspaces/WhatsAppGateway.jsx";
import { IotBinSensors } from "./workspaces/IotBinSensors.jsx";
import { LiveSurveillancePanel } from "./workspaces/LiveSurveillancePanel.jsx";
import { SpjCreateForm, SpjPanel } from "./workspaces/SpjPanel.jsx";
import { DamageReportsPanel } from "./workspaces/DamageReportsPanel.jsx";
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

import { API_URL } from "./config.js";
import { authenticatedRequest, createAlertDispatch } from "./dispatchApi.js";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showUpdateBanner(registration);
            }
          });
        });
      })
      .catch(() => {});

    function showUpdateBanner(registration) {
      const banner = document.createElement("button");
      banner.type = "button";
      banner.textContent = "Versi baru tersedia — Muat ulang";
      banner.style.cssText =
        "position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9999;" +
        "padding:12px 24px;min-height:44px;font-size:16px;font-weight:600;" +
        "background:#1f2937;color:#fff;border:none;border-radius:999px;cursor:pointer;" +
        "box-shadow:0 4px 16px rgba(0,0,0,0.25)";
      banner.addEventListener("click", () => {
        registration.waiting?.postMessage("SKIP_WAITING");
        navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
        // Fallback if no waiting worker (e.g. already activated): hard reload.
        setTimeout(() => location.reload(), 1500);
      });
      document.body.appendChild(banner);
    }
  });
}

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  }).catch(() => {});
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

function MapPanel({ trucks, attendance, rainfall, onSelectTruck, layers, playbackTruck, onBreadcrumbsLoaded, jamActive, focusRequest }) {
  const { lang } = useLanguage();
  return (
    <section className="panel map-panel">
      <div className="map-data-notice">
        <StatusPill tone="warning"><Radio size={14} /> {lang === "id" ? "Data simulasi" : "Simulated data"}</StatusPill>
        <span>{lang === "id" ? "Posisi bukan GPS langsung" : "Positions are not live GPS"}</span>
      </div>
      <Suspense fallback={<div className="map-loading-fallback">{lang === "id" ? "Memuat peta…" : "Loading map…"}</div>}>
        <LiveFleetMap
          trucks={trucks}
          attendance={attendance}
          rainfall={rainfall}
          onSelectTruck={onSelectTruck}
          layers={layers}
          playbackTruck={playbackTruck}
          onBreadcrumbsLoaded={onBreadcrumbsLoaded}
          jamActive={jamActive}
          focusRequest={focusRequest}
        />
      </Suspense>
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
  const [selectedMapTruck, setSelectedMapTruck] = useState(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(null);

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
    const idx = aiEvents.findIndex(
      (e) => e.event_type === "auto_replay" && e.status === "new"
        && playbackOptions.includes(e.truck_code)
    );
    if (idx === -1) return;
    const code = aiEvents[idx].truck_code;
    setPlaybackTruck(code);
    setToast(`Replay otomatis: ${code} menyimpang dari koridor`);
    setTimeout(() => setToast(""), 4200);
    ackAiEvent(idx);
  }, [aiEvents, playbackOptions, ackAiEvent]);

  useEffect(() => {
    if (!historyScrollRequest || fleetDetailTab !== "history") return;
    const el = document.getElementById("history-panel");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [fleetDetailTab, historyScrollRequest]);

  function selectFleetTruck(code, openTripHistory = false) {
    setFilterTruck(code);
    setSelectedMapTruck(code);
    if (openTripHistory) {
      setFleetDetailTab("history");
      setHistoryScrollRequest((request) => request + 1);
    }
  }

  function focusFleetTruck(code) {
    setSelectedMapTruck(code);
    setMapFocusRequest({ code, ts: Date.now() });
  }

  async function dispatch(alert) {
    try {
      const response = await createAlertDispatch(alert, t);
      if (!response.ok) {
        setToast({ error: true, message: response.status === 401
          ? (lang === "id" ? "Sesi berakhir. Masuk kembali untuk mengirim instruksi." : "Session expired. Sign in again to dispatch.")
          : response.status === 403
            ? (lang === "id" ? "Akses ditolak. Anda tidak dapat mengirim instruksi." : "Access denied. You cannot dispatch this instruction.")
            : (lang === "id" ? "Gagal mengirim instruksi. Coba lagi." : "Dispatch failed. Try again.") });
        return false;
      }
      setToast(lang === "id" ? `Instruksi dikirim ke ${alert.truck_code}` : `Instruction sent to ${alert.truck_code}`);
      refresh();
      return true;
    } catch {
      setToast({ error: true, message: lang === "id" ? "Tidak dapat menghubungi server dispatch. Coba lagi." : "Cannot reach dispatch server. Try again." });
      return false;
    } finally {
      setTimeout(() => setToast(""), 4200);
    }
  }

  async function sendWhatsAppAlert(alert) {
    const route = alert.recommended_routes?.[0]?.name || (lang === "id" ? "tugaskan armada cadangan" : "dispatch backup fleet");
    try {
      const response = await authenticatedRequest("/whatsapp/alert", {
        method: "POST",
        body: JSON.stringify({
          truck_code: alert.truck_code,
          issue: alert.description || alert.title,
          recommendation: route,
        }),
      });
      if (!response.ok) {
        setToast({ error: true, message: response.status === 401
          ? (lang === "id" ? "Sesi berakhir. Masuk kembali untuk mengirim WhatsApp." : "Session expired. Sign in again to send WhatsApp.")
          : response.status === 403
            ? (lang === "id" ? "Akses ditolak. WhatsApp tidak terkirim." : "Access denied. WhatsApp was not sent.")
            : (lang === "id" ? "WhatsApp gagal dikirim. Coba lagi." : "WhatsApp delivery failed. Try again.") });
        return;
      }
      const data = await response.json();
      setToast(data.sent
        ? (lang === "id" ? "WhatsApp berhasil dikirim." : "WhatsApp delivered.")
        : { error: !data.partial, message: data.partial
          ? (lang === "id" ? "WhatsApp hanya terkirim ke sebagian penerima." : "WhatsApp delivered to some recipients only.")
          : (lang === "id" ? "WhatsApp tidak terkirim. Periksa gateway." : "WhatsApp not delivered. Check the gateway.") });
    } catch {
      setToast({ error: true, message: lang === "id" ? "Tidak dapat menghubungi layanan WhatsApp." : "Cannot reach the WhatsApp service." });
    } finally {
      setTimeout(() => setToast(""), 4200);
    }
  }

  return (
    <AppShell activeWorkspace={activeWorkspace} onWorkspaceChange={setActiveWorkspace} online={online} onRefresh={refresh} onLogout={onLogout} assistant={<AssistantPanel />}>
      {activeWorkspace === "fleet" && (
        <ErrorBoundary name="fleet">
        <FleetOperations
          detailTab={fleetDetailTab}
          onDetailTabChange={setFleetDetailTab}
          actionCard={<ActionCard snapshot={snapshot} targetTruck={selectedMapTruck} />}
          trucks={snapshot.trucks}
          queueTrucks={snapshot.kpis.tpa_queue_trucks}
          queueWaitMinutes={snapshot.kpis.tpa_wait_minutes}
          onFocusProblem={focusFleetTruck}
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
                focusRequest={mapFocusRequest}
              />
            </div>
          )}
          mapTools={(
            <>
              <div className="deck-tools-section">
                <span className="deck-tools-label">{lang === "id" ? "Lapisan" : "Layers"}</span>
                <div className="map-controls-grid">
                  <label><input type="checkbox" checked={layers.heatmap} onChange={(e) => setLayers((s) => ({ ...s, heatmap: e.target.checked }))} /> {lang === "id" ? "Peta Panas" : "Heatmap"}</label>
                  <label><input type="checkbox" checked={layers.osrm} onChange={(e) => setLayers((s) => ({ ...s, osrm: e.target.checked }))} /> {lang === "id" ? "Rute OSRM" : "OSRM route"}</label>
                  <label><input type="checkbox" checked={layers.tps} onChange={(e) => setLayers((s) => ({ ...s, tps: e.target.checked }))} /> {lang === "id" ? "Titik TPS" : "TPS"}</label>
                  <label><input type="checkbox" checked={layers.wr} onChange={(e) => setLayers((s) => ({ ...s, wr: e.target.checked }))} /> {lang === "id" ? "Wajib Retribusi" : "Retribution registry"}</label>
                </div>
              </div>
              <div className="deck-tools-section">
                <span className="deck-tools-label">{lang === "id" ? "Replay rute" : "Route replay"}</span>
                <div className="playback-select-wrap">
                  <select value={playbackTruck || ""} onChange={(e) => setPlaybackTruck(e.target.value || null)} aria-label={lang === "id" ? "Putar ulang perjalanan" : "Trip playback"}>
                    <option value="">{lang === "id" ? "Putar riwayat rute..." : "Trip playback..."}</option>
                    {playbackOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {playbackTruck && (
                    <button className="compact-enforce-btn" onClick={() => setPlaybackTruck(null)}>
                      {lang === "id" ? "Tutup putar ulang" : "Close replay"}
                    </button>
                  )}
                </div>
              </div>
              <details className="deck-tools-section deck-legend">
                <summary>{lang === "id" ? "Legenda peta" : "Map legend"}</summary>
                <div className="map-legend deck-legend-body" aria-label={lang === "id" ? "Legenda peta" : "Map legend"}>
                  <span><i className="legend-heatmap" style={{ backgroundColor: "#22c55e", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> {lang === "id" ? "Titik TPS" : "TPS locations"} <em className="legend-tag">{lang === "id" ? "RIIL" : "REAL"}</em></span>
                  <span><i className="legend-heatmap" style={{ backgroundColor: "#f97316", borderRadius: "50%", width: "10px", height: "10px", border: "1.5px solid #fff", display: "inline-block" }} /> {lang === "id" ? "Wajib Retribusi" : "Retribution registry"} <em className="legend-tag">{lang === "id" ? "RIIL" : "REAL"}</em></span>
                  <span><i className="legend-heatmap" style={{ backgroundColor: "#a5b4fc", display: "inline-block" }} /> {lang === "id" ? "Risiko Sampah Wilayah" : "District waste risk"} <em className="legend-tag">MODEL</em></span>
                  <span><i className="legend-assigned" style={{ display: "inline-block" }} /> {lang === "id" ? "Koridor Ditugaskan" : "Assigned corridor"} <em className="legend-tag">{lang === "id" ? "SIMULASI" : "SIMULATED"}</em></span>
                  <span><i className="legend-actual" style={{ backgroundColor: "#176b54", display: "inline-block" }} /> {lang === "id" ? "Rute Aktual" : "Actual (clean)"} <em className="legend-tag">{lang === "id" ? "SIMULASI" : "SIMULATED"}</em></span>
                  <span><i className="legend-critical" style={{ backgroundColor: "#b42318", borderRadius: "50%", width: "10px", height: "10px", display: "inline-block" }} /> {lang === "id" ? "Segmen Pelanggaran" : "Violation segment"} <em className="legend-tag">{lang === "id" ? "SIMULASI" : "SIMULATED"}</em></span>
                  <span><i className="legend-osrm" style={{ backgroundColor: "#0891b2", display: "inline-block" }} /> {lang === "id" ? "Rute OSRM" : "OSRM route"} <em className="legend-tag">{lang === "id" ? "LANGSUNG" : "LIVE"}</em></span>
                  <span><span className="legend-icon-tpa" /> TPA Bantargebang <em className="legend-tag">MODEL</em></span>
                  <span><span className="legend-icon-unlicensed" /> {lang === "id" ? "Kolektor Liar" : "Unlicensed Collector"} <em className="legend-tag">{lang === "id" ? "SIMULASI" : "SIMULATED"}</em></span>
                  <span><i className="legend-event" style={{ backgroundColor: "#eab308", borderRadius: "4px", width: "16px", height: "12px", display: "inline-block" }} /> {lang === "id" ? "Acara Keramaian" : "Crowd Event"} <em className="legend-tag">{lang === "id" ? "SIMULASI" : "SIMULATED"}</em></span>
                </div>
              </details>
              <div className="deck-tools-section">
                <details className="alert-queue-collapsible">
                  <summary>{t("ac_all_alerts").replace("{n}", snapshot.alerts.length)}</summary>
                  <AlertQueue alerts={snapshot.alerts} onDispatch={dispatch} onWhatsApp={sendWhatsAppAlert} />
                </details>
              </div>
              <div className="deck-tools-section">
                <AStarReroutingPanel jamActive={jamActive} aiEvents={aiEvents} onAckEvent={ackAiEvent} />
              </div>
            </>
          )}
          routeEvidence={<RouteEvidencePanel route={snapshot.osrm_route} />}
          queue={<div className="fleet-queue-stack"><TpaQueuePanel /><StaggerSimulatorPanel /></div>}
          fleetTable={<FleetTable trucks={snapshot.trucks} onOpenTripHistory={(code) => selectFleetTruck(code, true)} />}
          unlicensedTable={<UnlicensedCollectorAlerts />}
          history={<FleetHistoryPanel filterTruck={filterTruck} setFilterTruck={setFilterTruck} />}
          carbon={<CarbonPanel />}
          spj={<SpjPanel />}
          damage={<DamageReportsPanel />}
        />
        </ErrorBoundary>
      )}

      {activeWorkspace !== "fleet" && (
        <section className="main-grid">
        {activeWorkspace === "forecast" && (
        <ErrorBoundary name="forecast">
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
          /></ErrorBoundary>
        )}

        {activeWorkspace === "planning" && (
        <ErrorBoundary name="planning">
          <PlanningDecisionFlow
            snapshot={snapshot}
            attendance={attendance}
            setAttendance={setAttendance}
            rainfall={rainfall}
            setRainfall={setRainfall}
            eventLat={eventLat}
            eventLng={eventLng}
            summary={snapshot.executive_summary}
            queue={snapshot.tpa_queue}
          /></ErrorBoundary>
        )}

        {activeWorkspace === "drivers" && (
          <div className="grid-col-12">
            <ErrorBoundary name="drivers"><DriverAnalytics /></ErrorBoundary>
          </div>
        )}

        {activeWorkspace === "weighbridge" && (
          <div className="grid-col-12">
            <ErrorBoundary name="weighbridge"><WeighbridgeLogs /></ErrorBoundary>
          </div>
        )}

        {activeWorkspace === "surveillance" && (
          <div className="grid-col-12">
            <ErrorBoundary name="surveillance"><LiveSurveillancePanel /></ErrorBoundary>
          </div>
        )}

        {activeWorkspace === "wa" && (
          <div className="grid-col-12">
            <ErrorBoundary name="wa"><WhatsAppGateway /></ErrorBoundary>
          </div>
        )}

        {activeWorkspace === "iot" && (
          <div className="grid-col-12">
            <ErrorBoundary name="iot"><IotBinSensors /></ErrorBoundary>
          </div>
        )}

        {activeWorkspace === "audit" && <ErrorBoundary name="audit"><DataAuditWorkspace /></ErrorBoundary>}
      </section>
      )}
      {toast && <div className="toast" role={toast.error ? "alert" : "status"}>{toast.error ? <AlertTriangle size={16} /> : <Check size={16} />} {toast.message || toast}</div>}
    </AppShell>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem("jwis_auth") === "true");
  const isField = useMemo(() => window.location.pathname.startsWith("/field"), []);
  const isDriver = useMemo(() => window.location.pathname.startsWith("/driver"), []);
  const isSupervisor = useMemo(() => window.location.pathname.startsWith("/pengawas"), []);
  function logout() {
    localStorage.removeItem("jwis_auth");
    setAuthenticated(false);
  }
  if (isField) return <FieldApp />;
  if (isDriver) return <DriverApp />;
  if (!authenticated) return <LoginPage onLogin={() => setAuthenticated(true)} />;
  if (isSupervisor) return <SupervisorView />;
  return <CommandCenter onLogout={logout} />;
}

createRoot(document.getElementById("root")).render(
  <ErrorBoundary name="root">
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </ErrorBoundary>
);
