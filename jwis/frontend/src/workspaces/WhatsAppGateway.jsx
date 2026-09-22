import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import {
  Activity,
  RefreshCcw,
  Send,
  Users,
  LogOut,
} from "lucide-react";

export function WhatsAppGateway() {
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
