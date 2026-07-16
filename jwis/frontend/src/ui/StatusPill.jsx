import React from "react";

export function StatusPill({ tone, children }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}
