import { API_URL } from "./config.js";

export function authenticatedRequest(path, options = {}) {
  const token = localStorage.getItem("jwis_token");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export function createAlertDispatch(alert, t, issue) {
  const route = alert.recommended_routes?.[0];
  const instruction = route
    ? `${t("ac_instruction_route")} ${route.name}. ${t("ac_instruction_confirm")}`
    : `${t("ac_instruction_handle")}: ${issue || alert.description || alert.title}`;
  return authenticatedRequest("/dispatch", {
    method: "POST",
    body: JSON.stringify({
      truck_code: alert.truck_code,
      instruction,
      manager_id: localStorage.getItem("jwis_role") || "manager_central",
    }),
  });
}
