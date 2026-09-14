import React from "react";

export function StatusDot({ tone = "neutral", pulsing = false }) {
  return (
    <span
      className={`status-dot ${tone} ${pulsing ? "pulsing" : ""}`}
      aria-hidden="true"
    />
  );
}

export function EnterpriseBadge({ tone = "neutral", children, icon: Icon, size = "md" }) {
  return (
    <span className={`pill ${tone} pill-${size}`} data-testid="enterprise-badge">
      <StatusDot tone={tone} />
      {Icon && <Icon size={size === "sm" ? 11 : 13} style={{ marginRight: 4 }} />}
      <span>{children}</span>
    </span>
  );
}

export function MetricCard({ label, value, helper, tone = "neutral", icon: Icon, trend }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        {Icon && <Icon size={15} className="metric-icon" />}
      </div>
      <div className="metric-value-row">
        <strong className="metric-value">{value}</strong>
        {trend && (
          <span className={`metric-trend ${trend.type || "neutral"}`}>
            {trend.value}
          </span>
        )}
      </div>
      {helper && <small className="metric-helper">{helper}</small>}
    </div>
  );
}
