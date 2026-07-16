import React, { useState } from "react";
import { MetricStrip } from "../ui/MetricStrip.jsx";
import { SegmentedControl } from "../ui/SegmentedControl.jsx";

const horizonOptions = [
  { value: "7d", label: "7 days" },
  { value: "14d", label: "14 days", disabled: true, title: "Unavailable: source provides 7 days" },
  { value: "30d", label: "30 days", disabled: true, title: "Unavailable: source provides 7 days" },
];

export function WasteForecast({
  metrics,
  forecast,
  weather,
  events,
  districts,
  assistant,
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
        <div className="forecast-horizon-control">
          <SegmentedControl
            label="Forecast horizon"
            describedBy="forecast-horizon-source-limit"
            value={horizon}
            options={horizonOptions}
            onChange={setHorizon}
          />
          <p id="forecast-horizon-source-limit" className="forecast-source-limit">
            Source currently provides a 7-day forecast.
          </p>
        </div>
      </div>

      <MetricStrip metrics={metrics} />

      <div className="forecast-analysis-grid">
        <div className="forecast-primary-analysis" data-testid="forecast-primary-analysis">
          {districts}
          {forecast}
        </div>
        <aside className="forecast-driver-rail" data-testid="forecast-driver-rail" aria-label="Forecast drivers">
          {weather}
          {events}
        </aside>
      </div>

      <div className="forecast-tools" aria-label="Forecast tools">
        {assistant}
        {reportActions}
      </div>
    </section>
  );
}
