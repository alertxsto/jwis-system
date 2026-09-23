import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Route, Send, ShieldCheck, Truck, X } from "lucide-react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import { readOutbox, enqueue, flushOutbox } from "./OfflineOutbox.js";
import "./field.css";

// Field copy lives with the offline workflow so the selected language needs no API request.
const copy = {
  id: {
    language: "Bahasa",
    commandCenter: "Kembali ke pusat kendali",
    fieldOperations: "Operasi lapangan",
    online: "Daring",
    offline: "Luring",
    taskVehicle: "Kendaraan tugas",
    onDuty: "Bertugas",
    queued: (count) => `${count} aksi menunggu sinkronisasi`,
    syncNow: "Sinkronkan sekarang",
    syncing: "Menyinkronkan…",
    truckCode: "Kode truk",
    readyStatus: "Siap bertugas",
    receivedStatus: "Instruksi diterima",
    issueStatus: "Masalah diteruskan ke pengawas",
    queuedStatus: "Luring — konfirmasi antre untuk disinkronkan",
    queuedStatusOnline: "Konfirmasi gagal dikirim dan disimpan untuk sinkronisasi.",
    syncFailedStatus: "Aksi belum tersinkron. Periksa koneksi atau akses Anda, lalu coba lagi.",
    syncedStatus: "Aksi antrean tersinkron",
    newInstruction: "Instruksi baru dari pengawas",
    incidentReason: "Alasan masalah",
    incidentPlaceholder: "Alasan masalah (jika melapor masalah)",
    reportNote: "Masalah dilaporkan dari lapangan",
    readyNote: "Dikonfirmasi dari aplikasi lapangan",
    ready: "Siap",
    reportIssue: "Lapor masalah",
    noInstruction: "Tidak ada instruksi baru",
    continueRoute: "Lanjutkan rute pengangkutan sesuai perintah.",
    offlineInstructions: "Instruksi tidak tersedia saat luring. Periksa koneksi untuk memuat instruksi terbaru.",
    loadError: "Instruksi gagal dimuat. Periksa koneksi atau akses Anda, lalu coba lagi.",
    history: "Riwayat aktivitas",
    readySent: "SIAP terkirim",
    issueSent: "MASALAH terkirim",
    readyQueued: "SIAP diantrekan (luring)",
    issueQueued: "MASALAH diantrekan (luring)",
    readyQueuedOnline: "SIAP disimpan (gagal dikirim)",
    issueQueuedOnline: "MASALAH disimpan (gagal dikirim)",
    synced: (count) => `${count} aksi antrean tersinkron`,
  },
  en: {
    language: "Language",
    commandCenter: "Back to command center",
    fieldOperations: "Field operations",
    online: "Online",
    offline: "Offline",
    taskVehicle: "Assigned vehicle",
    onDuty: "On duty",
    queued: (count) => `${count} action${count === 1 ? "" : "s"} awaiting sync`,
    syncNow: "Sync now",
    syncing: "Syncing…",
    truckCode: "Truck code",
    readyStatus: "Ready for duty",
    receivedStatus: "Instruction received",
    issueStatus: "Issue sent to supervisor",
    queuedStatus: "Offline — confirmation queued for sync",
    queuedStatusOnline: "Could not send confirmation. Saved for sync.",
    syncFailedStatus: "Actions did not sync. Check your connection or access, then try again.",
    syncedStatus: "Queued actions synced",
    newInstruction: "New instruction from supervisor",
    incidentReason: "Issue reason",
    incidentPlaceholder: "Reason for reporting an issue",
    reportNote: "Issue reported from the field",
    readyNote: "Confirmed from the field app",
    ready: "Ready",
    reportIssue: "Report issue",
    noInstruction: "No new instructions",
    continueRoute: "Continue the collection route as directed.",
    offlineInstructions: "Instructions are unavailable offline. Check your connection for the latest instructions.",
    loadError: "Could not load instructions. Check your connection or access, then try again.",
    history: "Activity history",
    readySent: "READY sent",
    issueSent: "ISSUE sent",
    readyQueued: "READY queued (offline)",
    issueQueued: "ISSUE queued (offline)",
    readyQueuedOnline: "READY saved (send failed)",
    issueQueuedOnline: "ISSUE saved (send failed)",
    synced: (count) => `${count} queued action${count === 1 ? "" : "s"} synced`,
  },
};

function authHeaders(extra = {}) {
  const token = localStorage.getItem("jwis_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function StatusPill({ tone, children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

function isoTimestampMicros(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match || !Number.isFinite(Date.parse(value))) return null;

  const [, year, month, day, hour, minute, second, fraction = "", , offsetSign, offsetHour = "0", offsetMinute = "0"] = match;
  const localMilliseconds = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const offsetDirection = offsetSign === "-" ? -1 : 1;
  const offsetMinutes = offsetSign ? offsetDirection * (Number(offsetHour) * 60 + Number(offsetMinute)) : 0;
  const utcMilliseconds = localMilliseconds - offsetMinutes * 60_000;
  return BigInt(utcMilliseconds) * 1_000n + BigInt(fraction.padEnd(6, "0") || "0");
}

function newestPendingDispatch(dispatches) {
  return dispatches
    .map((dispatch) => ({ dispatch, timestamp: isoTimestampMicros(dispatch?.created_at) }))
    .filter(({ dispatch, timestamp }) => (
      timestamp !== null
      && dispatch?.field_status === "PENDING"
      && typeof dispatch.id === "string"
      && typeof dispatch.instruction === "string"
      && dispatch.instruction.trim().length > 0
    ))
    .reduce((newest, candidate) => {
      if (!newest) return candidate;
      if (candidate.timestamp !== newest.timestamp) return candidate.timestamp > newest.timestamp ? candidate : newest;
      return candidate.dispatch.id.localeCompare(newest.dispatch.id) > 0 ? candidate : newest;
    }, null);
}

export default function FieldApp() {
  const { lang, setLang } = useLanguage();
  const text = copy[lang] || copy.id;
  const [truckCode, setTruckCode] = useState("T-047");
  const [dispatches, setDispatches] = useState([]);
  const [status, setStatus] = useState("readyStatus");
  const [timeline, setTimeline] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [loadError, setLoadError] = useState(null);
  const [queued, setQueued] = useState(readOutbox().length);
  const [syncing, setSyncing] = useState(false);
  const [incidentReason, setIncidentReason] = useState("");

  async function loadDispatches() {
    try {
      const response = await fetch(`${API_URL}/dispatch/${truckCode}`, { headers: authHeaders() });
      if (!response.ok) throw new Error("no api");
      setDispatches(await response.json());
      setLoadError(null);
      setOnline(navigator.onLine);
    } catch {
      setDispatches([]);
      setLoadError(navigator.onLine ? "loadError" : "offlineInstructions");
      setOnline(navigator.onLine);
    }
  }

  function logTimeline(event, count) {
    setTimeline((prev) => [{ event, count, at: new Date() }, ...prev].slice(0, 8));
  }

  async function confirm(dispatchId, value) {
    const note = value === "ISSUE" ? (incidentReason || text.reportNote) : text.readyNote;
    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch(`${API_URL}/dispatch/${dispatchId}/confirm`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: value, note }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus(value === "READY" ? "receivedStatus" : "issueStatus");
      logTimeline(value === "READY" ? "readySent" : "issueSent");
      loadDispatches();
    } catch {
      const n = enqueue({ dispatchId, status: value, note });
      setQueued(n);
      const unavailable = !navigator.onLine;
      setStatus(unavailable ? "queuedStatus" : "queuedStatusOnline");
      logTimeline(value === "READY"
        ? (unavailable ? "readyQueued" : "readyQueuedOnline")
        : (unavailable ? "issueQueued" : "issueQueuedOnline"));
    }
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const { flushed, remaining } = await flushOutbox(API_URL);
      setQueued(remaining);
      if (flushed) logTimeline("synced", flushed);
      if (remaining) setStatus("syncFailedStatus");
      else if (flushed) setStatus("syncedStatus");
      loadDispatches();
    } catch {
      setStatus("syncFailedStatus");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadDispatches();
    const timer = setInterval(loadDispatches, 5000);
    const onOnline = () => { setOnline(true); syncNow(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [truckCode]);

  const activeDispatch = useMemo(() => newestPendingDispatch(dispatches)?.dispatch, [dispatches]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(lang === "en" ? "en-US" : "id-ID", {
    hour: "numeric", minute: "2-digit",
  }), [lang]);

  return (
    <main className="field-shell" data-testid="field-app">
      <header className="field-app-header">
        <a className="field-brand" href="/" aria-label={text.commandCenter}>
          <span className="field-brand-mark"><Route size={19} /></span>
          <span><strong>JWIS</strong><small>{text.fieldOperations}</small></span>
        </a>
        <div className="field-header-actions">
          <StatusPill tone={online ? "live" : "warning"}>
            <span data-testid="conn-status">{online ? text.online : text.offline}</span>
          </StatusPill>
          <div className="field-language" role="group" aria-label={text.language}>
            <button type="button" data-testid="field-lang-id" aria-label="Bahasa Indonesia" aria-pressed={lang === "id"} className={lang === "id" ? "active" : ""} onClick={() => setLang("id")}>ID</button>
            <button type="button" data-testid="field-lang-en" aria-label="English" aria-pressed={lang === "en"} className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
        </div>
      </header>
      <section className="field-card" aria-labelledby="field-truck-title">
        <div className="field-head">
          <div>
            <p className="field-kicker">{text.taskVehicle}</p>
            <h1 id="field-truck-title">{truckCode}</h1>
          </div>
          <span className="field-duty-label"><Truck size={16} /> {text.onDuty}</span>
        </div>
        {queued > 0 && (
          <div className="field-status field-queue-status">
            <span data-testid="queued-count">{text.queued(queued)}</span>
            <button type="button" className="primary-button" onClick={syncNow} disabled={!online || syncing}>{syncing ? text.syncing : text.syncNow}</button>
          </div>
        )}
        <label className="field-label" htmlFor="truck-code">{text.truckCode}</label>
        <select id="truck-code" data-testid="truck-select" value={truckCode} onChange={(event) => setTruckCode(event.target.value)}>
          <option>T-047</option>
          <option>T-001</option>
          <option>T-112</option>
        </select>
        <div className="field-status" role="status">
          <Truck size={19} />
          <span data-testid="field-status">{text[status]}</span>
        </div>

        {activeDispatch ? (
          <article className="instruction" data-testid="active-dispatch">
            <div className="alert-head">
              <Send size={18} />
              <div>
                <strong>{text.newInstruction}</strong>
                <p>{activeDispatch.instruction}</p>
              </div>
            </div>
            <label className="field-label" htmlFor="incident-reason">{text.incidentReason}</label>
            <input
              id="incident-reason"
              className="field-input"
              data-testid="incident-reason"
              placeholder={text.incidentPlaceholder}
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
            />
            <div className="field-actions">
              <button type="button" className="primary-button" data-testid="btn-ready" onClick={() => confirm(activeDispatch.id, "READY")}><Check size={16} /> {text.ready}</button>
              <button type="button" className="danger-button" data-testid="btn-issue" onClick={() => confirm(activeDispatch.id, "ISSUE")}><X size={16} /> {text.reportIssue}</button>
            </div>
          </article>
        ) : (
          <article className="empty-instruction" data-testid="no-dispatch" role={loadError ? "alert" : undefined}>
            <ShieldCheck size={24} />
            <strong>{loadError ? text[loadError] : text.noInstruction}</strong>
            {!loadError && <p>{text.continueRoute}</p>}
          </article>
        )}

        {timeline.length > 0 && (
          <div className="field-timeline" data-testid="timeline">
            <strong>{text.history}</strong>
            <ul>
              {timeline.map((item, i) => (
                <li key={i}>{timeFormatter.format(item.at)} — {item.event === "synced" ? text.synced(item.count) : text[item.event]}</li>
              ))}
            </ul>
          </div>
        )}

        <a className="back-link" href="/"><ArrowLeft size={16} /> {text.commandCenter}</a>
      </section>
    </main>
  );
}
