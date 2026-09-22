import React, { useState, useEffect } from "react";
import { API_URL } from "../config.js";
import {
  Route,
  Truck,
  History,
  Calendar,
} from "lucide-react";

export function FleetHistoryPanel({ filterTruck, setFilterTruck }) {
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
