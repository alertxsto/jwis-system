import React from "react";

export function StatusBadge({ tone, children }) {
  return <span className={`status-badge status-${tone}`} data-testid="status-badge">{children}</span>;
}
