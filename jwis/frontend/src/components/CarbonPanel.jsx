import React from "react";
import { Leaf } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

/**
 * Fleet carbon accounting.
 *
 * There is deliberately no fallback dataset. An earlier version substituted
 * fixed figures (including a "17.58 kg CO2 saved" and a tree-planting
 * equivalent) whenever the API was unreachable, which presented invented
 * savings as an operational result. The backend's impact harness explicitly
 * retires those claims — fuel and carbon factors here are reference constants,
 * not measured savings — so when the endpoint is unavailable this panel says so.
 */
export function CarbonPanel() {
  const [carbon, setCarbon] = React.useState(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/fleet/carbon`);
        if (!res.ok) throw new Error("no api");
        const data = await res.json();
        if (!cancelled) {
          setCarbon(data);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (failed) {
    return (
      <section className="panel carbon-panel" id="carbon-panel">
        <div className="panel-title">
          <div>
            <h2>Carbon footprint</h2>
            <p>Fleet distance and emissions from the routing engine.</p>
          </div>
          <Leaf size={18} aria-hidden="true" />
        </div>
        <p className="panel-state" role="status">
          Carbon figures are unavailable — the fleet carbon endpoint did not respond.
          Reload once the API is reachable.
        </p>
      </section>
    );
  }

  if (!carbon) return null;

  return (
    <section className="panel carbon-panel" id="carbon-panel">
      <div className="panel-title">
        <div>
          <h2>Carbon footprint</h2>
          <p>Fleet distance and emissions from the routing engine (Euro 4 diesel: 0.95 kg CO2/km).</p>
        </div>
        <Leaf size={18} aria-hidden="true" />
      </div>
      <div className="carbon-grid">
        <div className="carbon-stat">
          <span>Total distance</span>
          <strong>{carbon.total_fleet_distance_km} km</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 emitted</span>
          <strong>{carbon.total_co2_emitted_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 avoided vs unoptimized</span>
          <strong>{carbon.carbon_saved_today_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>Fuel avoided</span>
          <strong>{carbon.fuel_saved_equivalent_liters} L</strong>
        </div>
      </div>
      <div className="carbon-badge">
        <Leaf size={15} aria-hidden="true" />
        Corridor compliance {carbon.compliance_rate_percent}% · avoided figures are
        modelled from the reference emission factor, not field measurement
      </div>
    </section>
  );
}
