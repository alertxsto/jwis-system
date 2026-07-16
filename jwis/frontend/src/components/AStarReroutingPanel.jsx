import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

export function AStarReroutingPanel() {
  const [jamActive, setJamActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);

  async function fetchRerouteInfo() {
    try {
      const res = await fetch(`${API_URL}/fleet/astar-reroute`);
      if (res.ok) setInfo(await res.json());
    } catch {}
  }

  useEffect(() => { fetchRerouteInfo(); }, [jamActive]);

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
      setJamActive(nextState);
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
