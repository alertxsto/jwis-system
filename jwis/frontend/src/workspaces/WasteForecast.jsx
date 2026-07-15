import React, { useState } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";

const horizonOptions = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
];

export function WasteForecast({
  metrics,
  forecast,
  weather,
  events,
  districts,
  assistant,
  voice,
  reportActions,
}) {
  const [horizon, setHorizon] = useState("7d");

  return (
    <section className="forecast-workspace" data-testid="forecast-workspace">
      <div className="forecast-heading">
        <div>
          <h1>Waste Forecast</h1>
          <p>Forecast demand and inspect the operating conditions behind the projected spike.</p>
        </div>
        <SegmentedControl
          label="Forecast horizon"
          value={horizon}
          options={horizonOptions}
          onChange={setHorizon}
        />
      </div>

      <MetricStrip metrics={metrics} />

      <div className="forecast-analysis-grid">
        <div className="forecast-primary-analysis" data-testid="forecast-primary-analysis">
          {forecast}
        </div>
        <aside className="forecast-driver-rail" data-testid="forecast-driver-rail">
          {weather}
          {events}
        </aside>
      </div>

      <div className="forecast-districts">{districts}</div>

      <section className="forecast-tools" aria-label="Forecast tools">
        {assistant}
        {voice}
        {reportActions}
      </section>
    </section>
  );
}
