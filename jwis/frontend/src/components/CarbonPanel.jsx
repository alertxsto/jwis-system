import React from "react";
import { Leaf } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const FALLBACK = {
  total_fleet_distance_km: 216.9,
  total_co2_emitted_kg: 206.06,
  carbon_saved_today_kg: 17.58,
  fuel_saved_equivalent_liters: 6.5,
  compliance_rate_percent: 86,
};

export function CarbonPanel() {
  const [carbon, setCarbonState] = React.useState(null);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/fleet/carbon`);
        if (!res.ok) throw new Error("no api");
        setCarbonState(await res.json());
      } catch {
        setCarbonState(FALLBACK);
      }
    }
    load();
  }, []);

  if (!carbon) return null;

  return (
    <section className="panel carbon-panel" id="carbon-panel">
      <div className="panel-title">
        <div>
          <h2>Carbon Footprint Tracker</h2>
          <p>Fleet CO2 emissions and route-optimization savings (Euro 4 diesel: 0.95 kg CO2/km).</p>
        </div>
        <Leaf size={20} />
      </div>
      <div className="carbon-grid">
        <div className="carbon-stat">
          <span>Total Distance</span>
          <strong>{carbon.total_fleet_distance_km} km</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 Emitted</span>
          <strong>{carbon.total_co2_emitted_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>CO2 Saved</span>
          <strong>{carbon.carbon_saved_today_kg} kg</strong>
        </div>
        <div className="carbon-stat">
          <span>Fuel Saved</span>
          <strong>{carbon.fuel_saved_equivalent_liters} L</strong>
        </div>
      </div>
      <div className="carbon-badge">
        <Leaf size={16} /> Optimal-route compliance: {carbon.compliance_rate_percent}% — equivalent to planting {Math.round(carbon.carbon_saved_today_kg / 21)} trees/day
      </div>
    </section>
  );
}
