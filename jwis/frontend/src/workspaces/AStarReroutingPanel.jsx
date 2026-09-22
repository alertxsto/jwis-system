import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";

export function AiNotificationFeed({ events, onAck }) {
  if (!events.length) {
    return <div className="ai-feed-empty">Belum ada event AI.</div>;
  }
  const latestFirst = events
    .map((e, i) => ({ ...e, _index: e._serverIndex ?? i }))
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

export function AStarReroutingPanel({ jamActive, aiEvents, onAckEvent }) {
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

  const rerouteEvents = (aiEvents || [])
    .map((e, serverIndex) => ({ ...e, _serverIndex: serverIndex }))
    .filter(
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
