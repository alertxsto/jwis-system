import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  LogOut,
  Menu,
  Route,
  Shield,
  Truck,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";
import { useLanguage } from "../i18n.jsx";

const items = [
  { id: "fleet", key: "nav_armada", icon: Truck },
  { id: "forecast", key: "nav_prediksi", icon: BarChart3 },
  { id: "planning", key: "nav_rencana", icon: Workflow },
  { id: "drivers", key: "nav_sopir", icon: Users },
  { id: "audit", key: "nav_audit", icon: Shield },
];

// Legacy workspace ids still reachable from deep links / old state.
const ALIASES = {
  surveillance: "fleet",
  weighbridge: "fleet",
  wa: "drivers",
  iot: "audit",
};

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, assistant, children }) {
  const { lang, setLang, t } = useLanguage();
  const resolvedWorkspace = ALIASES[activeWorkspace] || activeWorkspace;
  const current = items.find((item) => item.id === resolvedWorkspace) || items[0];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [mobileNavMode, setMobileNavMode] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  const mobileNavTriggerRef = useRef(null);
  const sideRailRef = useRef(null);

  const closeMobileNav = useCallback((restoreFocus = true) => {
    setMobileNavOpen(false);
    if (restoreFocus) requestAnimationFrame(() => mobileNavTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const updateMobileNavMode = (event) => {
      setMobileNavMode(event.matches);
      if (!event.matches) setMobileNavOpen(false);
    };
    const updateFromViewport = () => updateMobileNavMode(mediaQuery);
    mediaQuery.addEventListener("change", updateMobileNavMode);
    window.addEventListener("resize", updateFromViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateMobileNavMode);
      window.removeEventListener("resize", updateFromViewport);
    };
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const drawer = sideRailRef.current;
    const focusable = Array.from(
      drawer?.querySelectorAll(
        "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ) || [],
    );
    const focusDrawer = requestAnimationFrame(() => focusable[0]?.focus());
    const manageModalFocus = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNav();
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", manageModalFocus);
    return () => {
      cancelAnimationFrame(focusDrawer);
      window.removeEventListener("keydown", manageModalFocus);
    };
  }, [closeMobileNav, mobileNavOpen]);

  function selectWorkspace(id) {
    onWorkspaceChange(ALIASES[id] || id);
    closeMobileNav();
  }

  useEffect(() => {
    if (!assistantOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setAssistantOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [assistantOpen]);

  return (
    <div className="dashboard-frame professional-shell">
      <aside
        ref={sideRailRef}
        className={`side-rail ${mobileNavOpen ? "mobile-nav-open" : ""}`}
        aria-label="JWIS navigation"
        aria-modal={mobileNavOpen ? "true" : undefined}
        aria-hidden={mobileNavMode && !mobileNavOpen ? true : undefined}
        inert={mobileNavMode && !mobileNavOpen ? "true" : undefined}
        role={mobileNavOpen ? "dialog" : undefined}
      >
        <div className="side-brand">
          <span className="brand-mark"><Route size={19} /></span>
          <div>
            <strong>JWIS</strong>
            <small>DLH Command</small>
          </div>
        </div>

        <nav className="side-nav" id="workspace-navigation" data-testid="workspace-navigation">
          {items.map(({ id, key, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-tab-btn ${resolvedWorkspace === id ? "active" : ""}`}
              aria-current={resolvedWorkspace === id ? "page" : undefined}
              onClick={() => selectWorkspace(id)}
            >
              <Icon size={17} />{t(key)}
            </button>
          ))}
        </nav>

        <div className="side-system-state">
          <Activity size={15} />
          <span>{t("top_status")}</span>
          <StatusBadge tone={online ? "success" : "warning"}>{online ? (lang === "id" ? "Terhubung" : "Connected") : "Demo fallback"}</StatusBadge>
        </div>
        <button className="side-logout" type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }}>
          <LogOut size={17} />{t("top_logout")}
        </button>
      </aside>

      {mobileNavMode && mobileNavOpen && (
        <button
          className="mobile-nav-backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Dismiss workspace navigation"
          onClick={() => closeMobileNav()}
        />
      )}

      <button
        ref={mobileNavTriggerRef}
        className="icon-button mobile-nav-trigger"
        type="button"
        aria-label={mobileNavOpen ? "Close workspace navigation" : "Open workspace navigation"}
        aria-controls="workspace-navigation"
        aria-expanded={mobileNavOpen}
        onClick={() => {
          if (mobileNavOpen) closeMobileNav();
          else {
            setMobileNavMode(true);
            setMobileNavOpen(true);
          }
        }}
      >
        {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
      </button>

      <main className="app-shell" id="overview" inert={mobileNavOpen ? "true" : undefined}>
        <header className="topbar">
          <div className="breadcrumb">
            <span>JWIS</span>
            <span className="breadcrumb-separator">&gt;</span>
            <strong>{t(current.key)}</strong>
          </div>

          <div className="top-actions">
            <div className="language-toggle-widget" style={{ display: "inline-flex", alignItems: "center", background: "var(--ui-surface-muted)", borderRadius: "8px", padding: "2px", border: "1px solid var(--ui-border)" }}>
              <button
                type="button"
                data-testid="lang-switch-id"
                className={`lang-btn ${lang === "id" ? "active" : ""}`}
                onClick={() => setLang("id")}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: lang === "id" ? 700 : 500,
                  borderRadius: "6px",
                  border: 0,
                  cursor: "pointer",
                  background: lang === "id" ? "var(--ui-surface)" : "transparent",
                  color: lang === "id" ? "var(--ui-accent)" : "var(--ui-muted)",
                  boxShadow: lang === "id" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                ID
              </button>
              <button
                type="button"
                data-testid="lang-switch-en"
                className={`lang-btn ${lang === "en" ? "active" : ""}`}
                onClick={() => setLang("en")}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: lang === "en" ? 700 : 500,
                  borderRadius: "6px",
                  border: 0,
                  cursor: "pointer",
                  background: lang === "en" ? "var(--ui-surface)" : "transparent",
                  color: lang === "en" ? "var(--ui-accent)" : "var(--ui-muted)",
                  boxShadow: lang === "en" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                EN
              </button>
            </div>

            <button className="ghost-button assistant-topbar-button" type="button" onClick={() => setAssistantOpen(true)}>
              <Bot size={16} />{t("top_ai_assistant")}
            </button>
            <div className="profile-widget">
              <span className="profile-avatar" aria-hidden="true">JW</span>
              <div className="profile-info">
                <span className="profile-name">JWIS Team</span>
                <span className="profile-role">{t("top_operator_role")}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="workspace-canvas">{children}</div>
        {assistantOpen && (
          <div className="assistant-modal-backdrop" role="presentation" onMouseDown={() => setAssistantOpen(false)}>
            <section
              className="assistant-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Operational AI Assistant"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button className="icon-button assistant-modal-close" type="button" aria-label="Close AI assistant" onClick={() => setAssistantOpen(false)}>
                <X size={17} />
              </button>
              {assistant}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
