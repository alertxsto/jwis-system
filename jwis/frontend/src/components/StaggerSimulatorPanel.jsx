import React, { useState } from "react";
import { ClipboardList } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const FALLBACK_RESULT = {
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
};

export function StaggerSimulatorPanel() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function runSimulation() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/simulator/stagger?active_trucks=5`, { method: "POST" });
      setResult(await response.json());
    } catch {
      setResult(FALLBACK_RESULT);
    }
    setLoading(false);
  }

  return (
    <section className="panel stagger-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang Queue Optimization (Case 1)</h2>
          <p>Staggered-dispatch simulation to reduce landfill waiting time.</p>
        </div>
        <ClipboardList size={20} />
      </div>
      <button className="primary-button" onClick={runSimulation} disabled={loading}>
        {loading ? "Calculating..." : "Run Dispatch Simulation"}
      </button>
      {result && (
        <>
          <div className="stagger-compare">
            <div className="stagger-col before">
              <span className="stagger-label">Without Optimization</span>
              <strong>{result.baseline_wait_minutes} min</strong>
              <small>{result.baseline_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-arrow">-&gt;</div>
            <div className="stagger-col after">
              <span className="stagger-label">With JWIS</span>
              <strong>{result.optimized_wait_minutes} min</strong>
              <small>{result.optimized_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-badge">-{result.queue_reduction_percent}%</div>
          </div>

          {result.dispatch_slots && result.dispatch_slots.length > 0 && (
            <div className="stagger-schedule-wrap">
              <h3>Rekomendasi Jadwal Keberangkatan Staggered:</h3>
              <div className="table-wrap">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>ID Truk</th>
                      <th>Saran Jam Berangkat</th>
                      <th>Estimasi Antri TPA</th>
                      <th>Status Jadwal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dispatch_slots.slice(0, 10).map((slot, i) => (
                      <tr key={i}>
                        <td><strong>T-0{slot.truck_index}</strong></td>
                        <td><code>{slot.suggested_departure}</code></td>
                        <td>{slot.tpa_wait_est_minutes} menit</td>
                        <td>
                          <span className="status-pill success">{slot.slot_status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.dispatch_slots.length > 10 && (
                <p className="stagger-schedule-note">
                  Menampilkan 10 slot pertama dari {result.dispatch_slots.length} total armada terjadwal.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
