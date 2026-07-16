import React, { useEffect, useState } from "react";
import { History, Calendar } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

const API_URL = import.meta.env.VITE_API_URL || "/api";

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
        <History size={20} />
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
              <th>Truck</th>
              <th>Driver</th>
              <th>Date</th>
              <th>Distance</th>
              <th>Fuel</th>
              <th>GPS Points</th>
              <th>Deviation</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td className="table-empty-state" colSpan={7}>No trip history for this filter.</td></tr>
            ) : (
              history.map((trip) => (
                <tr key={`${trip.truck_code}-${trip.date}`}>
                  <td><b>{trip.truck_code}</b></td>
                  <td>{trip.driver_name}</td>
                  <td>{trip.date}</td>
                  <td>{trip.distance_km} km</td>
                  <td>{trip.fuel_consumed_liters} L</td>
                  <td>{trip.points?.length || 0} points</td>
                  <td>
                    {(trip.deviations_count ?? trip.deviations_detected ?? 0) > 0 ? (
                      <StatusPill tone="danger">{trip.deviations_count ?? trip.deviations_detected} deviations</StatusPill>
                    ) : (
                      <StatusPill tone="success">Clean</StatusPill>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
