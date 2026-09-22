import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Route, Send, ShieldCheck, Truck, X } from "lucide-react";
import { readOutbox, enqueue, flushOutbox } from "./OfflineOutbox.js";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

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
  const [truckCode, setTruckCode] = useState("T-047");
  const [dispatches, setDispatches] = useState([]);
  const [status, setStatus] = useState("Siap bertugas");
  const [timeline, setTimeline] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(readOutbox().length);
  const [incidentReason, setIncidentReason] = useState("");

  async function loadDispatches() {
    try {
      const response = await fetch(`${API_URL}/dispatch/${truckCode}`, { headers: authHeaders() });
      if (!response.ok) throw new Error("no api");
      setDispatches(await response.json());
      setOnline(true);
    } catch {
      setDispatches([]);
      setOnline(false);
    }
  }

  function logTimeline(event) {
    setTimeline((prev) => [{ event, at: new Date().toLocaleTimeString("id-ID") }, ...prev].slice(0, 8));
  }

  async function confirm(dispatchId, value) {
    const note = value === "ISSUE" ? (incidentReason || "Masalah dilaporkan dari lapangan") : "Dikonfirmasi dari aplikasi lapangan";
    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch(`${API_URL}/dispatch/${dispatchId}/confirm`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: value, note }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus(value === "READY" ? "Instruksi diterima" : "Masalah diteruskan ke pengawas");
      logTimeline(value === "READY" ? "SIAP terkirim" : "MASALAH terkirim");
      loadDispatches();
    } catch {
      const n = enqueue({ dispatchId, status: value, note });
      setQueued(n);
      setStatus("Luring — konfirmasi antre untuk disinkronkan");
      logTimeline(`${value} diantrekan (luring)`);
    }
  }

  async function syncNow() {
    const { flushed, remaining } = await flushOutbox(API_URL);
    setQueued(remaining);
    if (flushed) logTimeline(`${flushed} aksi antrean tersinkron`);
    loadDispatches();
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

  return (
    <main className="field-shell" data-testid="field-app">
      <header className="field-app-header">
        <a className="field-brand" href="/" aria-label="Kembali ke pusat kendali">
          <span className="field-brand-mark"><Route size={19} /></span>
          <span><strong>JWIS</strong><small>Operasi lapangan</small></span>
        </a>
        <StatusPill tone={online ? "live" : "warning"}>
          <span data-testid="conn-status">{online ? "Daring" : "Luring"}</span>
        </StatusPill>
      </header>
      <section className="field-card" aria-labelledby="field-truck-title">
        <div className="field-head">
          <div>
            <p className="field-kicker">Kendaraan tugas</p>
            <h1 id="field-truck-title">{truckCode}</h1>
          </div>
          <span className="field-duty-label"><Truck size={16} /> Bertugas</span>
        </div>
        {queued > 0 && (
          <div className="field-status field-queue-status">
            <span data-testid="queued-count">{queued} aksi diantrekan saat luring</span>
            <button className="primary-button" onClick={syncNow} disabled={!online}>Sinkronkan sekarang</button>
          </div>
        )}
        <label className="field-label" htmlFor="truck-code">Kode truk</label>
        <select id="truck-code" data-testid="truck-select" value={truckCode} onChange={(event) => setTruckCode(event.target.value)}>
          <option>T-047</option>
          <option>T-001</option>
          <option>T-112</option>
        </select>
        <div className="field-status">
          <Truck size={19} />
          <span data-testid="field-status">{status}</span>
        </div>

        {activeDispatch ? (
          <article className="instruction" data-testid="active-dispatch">
            <div className="alert-head">
              <Send size={18} />
              <div>
                <strong>Instruksi baru dari pengawas</strong>
                <p>{activeDispatch.instruction}</p>
              </div>
            </div>
            <label className="field-label" htmlFor="incident-reason">Alasan masalah</label>
            <input
              id="incident-reason"
              className="field-input"
              data-testid="incident-reason"
              placeholder="Alasan masalah (jika melapor masalah)"
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
            />
            <div className="field-actions">
              <button className="primary-button" data-testid="btn-ready" onClick={() => confirm(activeDispatch.id, "READY")}><Check size={16} /> Siap</button>
              <button className="danger-button" data-testid="btn-issue" onClick={() => confirm(activeDispatch.id, "ISSUE")}><X size={16} /> Lapor masalah</button>
            </div>
          </article>
        ) : (
          <article className="empty-instruction" data-testid="no-dispatch">
            <ShieldCheck size={24} />
            <strong>Tidak ada instruksi baru</strong>
            <p>Lanjutkan rute pengangkutan sesuai perintah.</p>
          </article>
        )}

        {timeline.length > 0 && (
          <div className="field-timeline" data-testid="timeline">
            <strong>Riwayat aktivitas</strong>
            <ul>
              {timeline.map((t, i) => (
                <li key={i}>{t.at} — {t.event}</li>
              ))}
            </ul>
          </div>
        )}

        <a className="back-link" href="/"><ArrowLeft size={16} /> Kembali ke pusat kendali</a>
      </section>
    </main>
  );
}
