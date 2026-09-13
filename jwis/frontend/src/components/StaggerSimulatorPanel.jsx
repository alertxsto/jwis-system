import React, { useState } from "react";
import { ClipboardList } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

/**
 * Staggered-dispatch simulator.
 *
 * No fallback result is substituted on failure. An earlier version returned a
 * canned "116 min → 48 min, -58.6%" comparison when the endpoint was
 * unreachable, which showed an invented saving as a simulation output — the
 * exact claim the backend's impact harness retires. A failed run now reports
 * that it failed.
 */
export function StaggerSimulatorPanel() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function runSimulation() {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`${API_URL}/simulator/stagger?active_trucks=5`, { method: "POST" });
      if (!response.ok) throw new Error("simulator unavailable");
      setResult(await response.json());
    } catch {
      setResult(null);
      setFailed(true);
    }
    setLoading(false);
  }

  return (
    <section className="panel stagger-panel">
      <div className="panel-title">
        <div>
          <h2>Bantargebang queue optimisation</h2>
          <p>Staggered-dispatch simulation of landfill waiting time.</p>
        </div>
        <ClipboardList size={18} aria-hidden="true" />
      </div>
      <button className="primary-button" onClick={runSimulation} disabled={loading}>
        {loading ? "Calculating…" : "Run dispatch simulation"}
      </button>

      {failed && (
        <p className="panel-state" role="status">
          The simulation did not run — the stagger endpoint did not respond. No result is
          shown rather than an estimated one.
        </p>
      )}

      {result && (
        <>
          <div className="stagger-compare">
            <div className="stagger-col before">
              <span className="stagger-label">Without optimisation</span>
              <strong>{result.baseline_wait_minutes} min</strong>
              <small>{result.baseline_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-arrow" aria-hidden="true">→</div>
            <div className="stagger-col after">
              <span className="stagger-label">With staggered dispatch</span>
              <strong>{result.optimized_wait_minutes} min</strong>
              <small>{result.optimized_queue_trucks} queued trucks</small>
            </div>
            <div className="stagger-badge">-{result.queue_reduction_percent}%</div>
          </div>

          {result.dispatch_slots && result.dispatch_slots.length > 0 && (
            <div className="stagger-schedule-wrap">
              <h3>Recommended departure slots</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Truck</th>
                      <th>Departure</th>
                      <th>Est. TPA wait</th>
                      <th>Slot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dispatch_slots.slice(0, 10).map((slot, i) => (
                      <tr key={i}>
                        <td><strong>T-0{slot.truck_index}</strong></td>
                        <td><span className="mono">{slot.suggested_departure}</span></td>
                        <td>{slot.tpa_wait_est_minutes} min</td>
                        <td>
                          <span className="pill success">{slot.slot_status.toUpperCase()}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.dispatch_slots.length > 10 && (
                <p className="stagger-schedule-note">
                  Showing the first 10 of {result.dispatch_slots.length} scheduled slots.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
