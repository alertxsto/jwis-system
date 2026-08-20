import React from "react";
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
  reportActions,
  horizon,
  onHorizonChange,
}) {
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
            onChange={onHorizonChange}
          />
          <p id="forecast-horizon-source-limit" className="forecast-source-limit">
            Live model series per day: weekday and national-holiday drivers vary by date;
            rainfall and event scenario inputs are held constant across the horizon.
          </p>
        </div>
      </div>

      <MetricStrip metrics={metrics} />

      <div className="forecast-command-grid" data-testid="forecast-command-grid">
        <div className="forecast-primary-analysis" data-testid="forecast-primary-analysis">
          {districts}
        </div>
      </div>

      <div className="forecast-tools" aria-label="Forecast tools">
        {forecast}
        {weather}
        {events}
        {reportActions}
      </div>
    </section>
  );
}
