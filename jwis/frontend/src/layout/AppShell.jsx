import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, BarChart3, LogOut, Menu, RefreshCcw, Route, Truck, Workflow, X } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const items = [
  { id: "fleet", label: "Fleet Operations", icon: Truck },
  { id: "forecast", label: "Waste Forecast", icon: BarChart3 },
  { id: "planning", label: "Integrated Planning", icon: Workflow },
];

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, children }) {
  const current = items.find((item) => item.id === activeWorkspace) || items[0];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
    const focusable = Array.from(drawer?.querySelectorAll("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") || []);
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
    onWorkspaceChange(id);
    closeMobileNav();
  }

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
        <div className="side-brand"><span className="brand-mark"><Route size={19} /></span><div><strong>JWIS</strong><small>DLH Command</small></div></div>
        <p className="nav-section-label">Operations</p>
        <nav className="side-nav" id="workspace-navigation" data-testid="workspace-navigation">
          {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`} aria-current={activeWorkspace === id ? "page" : undefined} onClick={() => selectWorkspace(id)}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="side-system-state"><Activity size={15} /><span>System status</span><StatusBadge tone={online ? "success" : "warning"}>{online ? "Connected" : "Demo fallback"}</StatusBadge></div>
        <button className="side-logout" type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }}><LogOut size={17} />Logout</button>
      </aside>
      {mobileNavMode && mobileNavOpen && <button className="mobile-nav-backdrop" type="button" tabIndex={-1} aria-label="Close workspace navigation" onClick={() => closeMobileNav()} />}
      <main className="app-shell" id="overview" inert={mobileNavOpen ? "true" : undefined}>
        <header className="topbar">
          <button
            ref={mobileNavTriggerRef}
            className="icon-button mobile-nav-trigger"
            type="button"
            aria-label="Open workspace navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => { setMobileNavMode(true); setMobileNavOpen(true); }}
          >
            {mobileNavOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
          <div className="breadcrumb"><span>JWIS</span><span>/</span><strong>{current.label}</strong></div>
          <div className="top-actions"><StatusBadge tone={online ? "success" : "warning"}>{online ? "API connected" : "Offline demo"}</StatusBadge><a className="ghost-button" href="/field"><Truck size={16} />Field app</a><button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh command center"><RefreshCcw size={17} /></button></div>
        </header>
        <div className="workspace-canvas">{children}</div>
      </main>
    </div>
  );
}
