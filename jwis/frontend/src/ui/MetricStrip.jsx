import React from "react";

export function MetricStrip({ metrics }) {
  return (
    <section className="metric-strip" data-testid="metric-strip">
      {metrics.map(({ label, value, helper, tone = "neutral" }) => (
        <article className={`metric-cell metric-${tone}`} data-testid="metric-cell" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <small>{helper}</small>
        </article>
      ))}
    </section>
  );
}
