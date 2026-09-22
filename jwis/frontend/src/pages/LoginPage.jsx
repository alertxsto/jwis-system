import React, { useState } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  AlertTriangle,
  Route,
  ShieldCheck,
  Lock,
  User,
} from "lucide-react";

export function LoginPage({ onLogin }) {
  const { lang, setLang, t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("bad creds");
      const principal = await res.json();
      localStorage.setItem("jwis_auth", "true");
      localStorage.setItem("jwis_role", principal.role);
      localStorage.setItem("jwis_token", principal.token);
      onLogin();
    } catch {
      setError(t("login_error"));
    }
  }

  return (
    <main className="login-shell">
      <section className="login-surface" aria-labelledby="login-title">
        <div className="login-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
            <div className="language-toggle-widget" style={{ display: "inline-flex", background: "var(--ui-surface-muted)", borderRadius: "8px", padding: "2px", border: "1px solid var(--ui-border)" }}>
              <button type="button" onClick={() => setLang("id")} style={{ padding: "3px 8px", fontSize: "11px", fontWeight: lang === "id" ? 700 : 500, borderRadius: "5px", border: 0, cursor: "pointer", background: lang === "id" ? "var(--ui-surface)" : "transparent", color: lang === "id" ? "var(--ui-accent)" : "var(--ui-muted)" }}>ID</button>
              <button type="button" onClick={() => setLang("en")} style={{ padding: "3px 8px", fontSize: "11px", fontWeight: lang === "en" ? 700 : 500, borderRadius: "5px", border: 0, cursor: "pointer", background: lang === "en" ? "var(--ui-surface)" : "transparent", color: lang === "en" ? "var(--ui-accent)" : "var(--ui-muted)" }}>EN</button>
            </div>
          </div>
          <div className="login-brand">
            <span><ShieldCheck size={22} /></span>
            <div>
              <p className="login-kicker">{t("login_kicker")}</p>
              <h1 id="login-title">{t("login_title")}</h1>
            </div>
          </div>
          <p className="login-copy">
            {t("login_copy")}
          </p>
          <form className="login-form" onSubmit={submit}>
            <label htmlFor="username">{t("login_username")}</label>
            <div className="input-shell">
              <User size={18} />
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="dispatcher"
              />
            </div>
            <label htmlFor="password">{t("login_password")}</label>
            <div className="login-password-row">
              <div className="input-shell">
                <Lock size={18} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder={t("login_password_placeholder")}
                />
              </div>
              <button
                type="button"
                className="login-show-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? t("login_hide_password") : t("login_show_password")}
              </button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                <AlertTriangle size={18} aria-hidden="true" />
                {error}
              </p>
            )}
            <button className="primary-button login-submit" type="submit">
              {t("login_submit")}
            </button>
          </form>
        </div>
        <aside className="login-proof" aria-label="JWIS operating scope">
          <div className="login-proof-intro">
            <span className="brand-mark"><Route size={19} /></span>
            <div>
              <strong>Jakarta Waste Intelligence System</strong>
              <p>Operational access for DLH command personnel, dispatch supervisors, and audit reviewers.</p>
            </div>
          </div>
          <div className="login-status-strip" aria-label="Command status">
            <div>
              <span>Command mode</span>
              <strong>Protected</strong>
            </div>
            <div>
              <span>Decision loop</span>
              <strong>Live demo</strong>
            </div>
          </div>
          <div className="login-proof-metrics">
            <div>
              <span className="metric-label">Queue model</span>
              <strong>Discrete event</strong>
              <p>Simulated landfill waiting-time operations.</p>
            </div>
            <div>
              <span className="metric-label">Coverage</span>
              <strong>Fleet + Forecast</strong>
              <p>Fleet supervision and resource planning.</p>
            </div>
            <div>
              <span className="metric-label">Assistant</span>
              <strong>Ana AI</strong>
              <p>Operational guidance for route, weather, and dispatch decisions.</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
