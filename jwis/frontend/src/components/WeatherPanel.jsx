import React from "react";
import { CloudRain } from "lucide-react";
import { StatusPill } from "../ui/StatusPill.jsx";

export function WeatherPanel({ weather }) {
  const forecast = weather?.forecast || [];
  const peak = forecast.reduce(
    (best, item) => (item.waste_impact_percent > (best?.waste_impact_percent || 0) ? item : best),
    forecast[0],
  );

  return (
    <section className="panel weather-panel">
      <div className="panel-title">
        <div>
          <h2>Open-Meteo Weather Risk</h2>
          <p>Jakarta 7-day rainfall forecast used as a driver for waste-volume readiness.</p>
        </div>
        <StatusPill tone={weather?.source === "open-meteo" ? "success" : "warning"}>
          {weather?.source === "open-meteo" ? "Open-Meteo live" : "fallback"}
        </StatusPill>
      </div>
      {peak && (
        <div className="weather-hero">
          <CloudRain size={26} />
          <div>
            <strong>{peak.date}</strong>
            <span>{peak.rainfall_mm.toFixed(1)} mm rain - {Math.round(peak.precipitation_probability)}% probability</span>
          </div>
          <b>+{peak.waste_impact_percent}%</b>
        </div>
      )}
      <div className="weather-strip">
        {forecast.slice(0, 7).map((day) => (
          <article key={day.date} className={`weather-day ${day.risk_level}`}>
            <strong>{new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}</strong>
            <span>{Math.round(day.rainfall_mm)} mm</span>
            <small>{Math.round(day.temperature_min_c)}-{Math.round(day.temperature_max_c)} C</small>
          </article>
        ))}
      </div>
      {peak && <p className="weather-advice">{peak.operational_advice}</p>}
    </section>
  );
}
