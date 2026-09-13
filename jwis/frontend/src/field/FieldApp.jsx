import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Route, Send, ShieldCheck, Truck, X } from "lucide-react";
import { readOutbox, enqueue, flushOutbox } from "./OfflineOutbox.js";
import { StatusPill } from "../ui/StatusPill.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";

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
  const [status, setStatus] = useState("Ready for duty");
  const [timeline, setTimeline] = useState([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(readOutbox().length);
  const [incidentReason, setIncidentReason] = useState("");

  async function loadDispatches() {
    try {
      const response = await fetch(`${API_URL}/dispatch/${truckCode}`);
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
    const note = value === "ISSUE" ? (incidentReason || "Issue reported from field") : "Confirmed from field PWA";
    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch(`${API_URL}/dispatch/${dispatchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value, note }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus(value === "READY" ? "Instruction accepted" : "Issue escalated to manager");
      logTimeline(`${value} sent`);
      loadDispatches();
    } catch {
      const n = enqueue({ dispatchId, status: value, note });
      setQueued(n);
      setStatus("Offline — confirmation queued for sync");
      logTimeline(`${value} queued (offline)`);
    }
  }

  async function syncNow() {
    const { flushed, remaining } = await flushOutbox(API_URL);
    setQueued(remaining);
    if (flushed) logTimeline(`${flushed} queued action(s) synced`);
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
        <a className="field-brand" href="/" aria-label="Return to JWIS command center">
          <span className="field-brand-mark" aria-hidden="true"><Route size={16} /></span>
          <span><strong>JWIS</strong><small>Field operations</small></span>
        </a>
        <StatusPill tone={online ? "live" : "warning"}>
          <span data-testid="conn-status">{online ? "Online" : "Offline"}</span>
        </StatusPill>
      </header>
      <section className="field-card" aria-labelledby="field-truck-title">
        <div className="field-head">
          <div>
            <p className="field-kicker">Assigned vehicle</p>
            <h1 id="field-truck-title">{truckCode}</h1>
          </div>
          <span className="field-duty-label"><Truck size={15} aria-hidden="true" /> On duty</span>
        </div>
        {queued > 0 && (
          <div className="field-status field-queue-status">
            <span data-testid="queued-count">{queued} action(s) queued offline</span>
            <button className="primary-button" onClick={syncNow} disabled={!online}>Sync now</button>
          </div>
        )}
        <label className="field-label" htmlFor="truck-code">Truck code</label>
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
                <strong>New manager instruction</strong>
                <p>{activeDispatch.instruction}</p>
              </div>
            </div>
            <label className="field-label" htmlFor="incident-reason">Incident reason</label>
            <input
              id="incident-reason"
              className="field-input"
              data-testid="incident-reason"
              placeholder="Incident reason (if reporting an issue)"
              value={incidentReason}
              onChange={(e) => setIncidentReason(e.target.value)}
            />
            <div className="field-actions">
              <button className="primary-button" data-testid="btn-ready" onClick={() => confirm(activeDispatch.id, "READY")}><Check size={16} /> Ready</button>
              <button className="danger-button" data-testid="btn-issue" onClick={() => confirm(activeDispatch.id, "ISSUE")}><X size={16} /> Report issue</button>
            </div>
          </article>
        ) : (
          <article className="empty-instruction" data-testid="no-dispatch">
            <ShieldCheck size={24} />
            <strong>No pending instruction</strong>
            <p>Keep following the assigned collection corridor.</p>
          </article>
        )}

        {timeline.length > 0 && (
          <div className="field-timeline" data-testid="timeline">
            <strong>Activity timeline</strong>
            <ul>
              {timeline.map((t, i) => (
                <li key={i}>{t.at} — {t.event}</li>
              ))}
            </ul>
          </div>
        )}

        <a className="back-link" href="/"><ArrowLeft size={16} /> Return to command center</a>
      </section>
    </main>
  );
}
