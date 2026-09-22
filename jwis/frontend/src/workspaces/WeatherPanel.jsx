import React from "react";
import { useLanguage } from "../i18n.jsx";
import { StatusPill } from "../ui/StatusPill.jsx";
import {
  CloudRain,
} from "lucide-react";

export function WeatherPanel({ weather }) {
  const { lang } = useLanguage();
  const forecast = weather?.forecast || [];
  const peak = forecast.reduce(
    (best, item) => (item.waste_impact_percent > (best?.waste_impact_percent || 0) ? item : best),
    forecast[0],
  );
  const trendRows = forecast.slice(0, 7);
  const maxRainfall = Math.max(...trendRows.map((item) => item.rainfall_mm || 0), 1);
  const maxImpact = Math.max(...trendRows.map((item) => item.waste_impact_percent || 0), 1);

  return (
    <section className="panel weather-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Risiko Cuaca Open-Meteo" : "Open-Meteo Weather Risk"}</h2>
          <p>{lang === "id" ? "Prakiraan curah hujan 7 hari Jakarta sebagai pemicu kesiapan armada timbulan." : "Jakarta 7-day rainfall forecast used as a driver for waste-volume readiness."}</p>
        </div>
        <StatusPill tone={weather?.source === "open-meteo" ? "success" : "warning"}>
          {weather?.source === "open-meteo" ? (lang === "id" ? "Open-Meteo live" : "Open-Meteo live") : (lang === "id" ? "Cadangan" : "fallback")}
        </StatusPill>
      </div>
      {peak && (
        <div className="weather-hero">
          <CloudRain size={26} />
          <div>
            <strong>{peak.date}</strong>
            <span>{peak.rainfall_mm.toFixed(1)} mm {lang === "id" ? "hujan" : "rain"} - {Math.round(peak.precipitation_probability)}% {lang === "id" ? "peluang" : "probability"}</span>
          </div>
          <b>+{peak.waste_impact_percent}%</b>
        </div>
      )}
      <div className="weather-strip">
        {forecast.slice(0, 7).map((day) => (
          <article key={day.date} className={`weather-day ${day.risk_level}`}>
            <div>
              <strong>{new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short" })}</strong>
              <small>{new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { month: "short", day: "numeric" })}</small>
            </div>
            <span>{Math.round(day.rainfall_mm)} mm</span>
            <small>{Math.round(day.temperature_min_c)}-{Math.round(day.temperature_max_c)} C</small>
          </article>
        ))}
      </div>
      <div className="weather-trend-chart" aria-label="Rainfall impact trend chart">
        <h3>{lang === "id" ? "Tren Dampak Curah Hujan" : "Rainfall impact trend"}</h3>
        {trendRows.map((day) => {
          const rainWidth = Math.max(4, ((day.rainfall_mm || 0) / maxRainfall) * 100);
          const impactWidth = Math.max(4, ((day.waste_impact_percent || 0) / maxImpact) * 100);
          const dayLabel = new Date(day.date).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short" });
          return (
            <article className="weather-trend-row" key={`${day.date}-trend`}>
              <span>{dayLabel}</span>
              <div className="weather-trend-bars">
                <i className="rainfall-bar" style={{ width: `${rainWidth}%` }} />
                <i className="impact-bar" style={{ width: `${impactWidth}%` }} />
              </div>
              <b>{Math.round(day.rainfall_mm)} mm</b>
              <em>+{day.waste_impact_percent}%</em>
            </article>
          );
        })}
      </div>
      {peak && <p className="weather-advice">{peak.operational_advice}</p>}
    </section>
  );
}
