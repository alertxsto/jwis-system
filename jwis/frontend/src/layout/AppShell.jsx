import React, { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const updateMobileNavMode = (event) => {
      setMobileNavMode(event.matches);
      if (!event.matches) setMobileNavOpen(false);
    };
    mediaQuery.addEventListener("change", updateMobileNavMode);
    return () => mediaQuery.removeEventListener("change", updateMobileNavMode);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setMobileNavOpen(false);
      mobileNavTriggerRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  function selectWorkspace(id) {
    onWorkspaceChange(id);
    setMobileNavOpen(false);
  }

  return (
    <div className="dashboard-frame professional-shell">
      <aside
        className={`side-rail ${mobileNavOpen ? "mobile-nav-open" : ""}`}
        aria-label="JWIS navigation"
        aria-hidden={mobileNavMode && !mobileNavOpen ? true : undefined}
        inert={mobileNavMode && !mobileNavOpen ? true : undefined}
      >
        <div className="side-brand"><span className="brand-mark"><Route size={19} /></span><div><strong>JWIS</strong><small>DLH Command</small></div></div>
        <p className="nav-section-label">Operations</p>
        <nav className="side-nav" id="workspace-navigation" data-testid="workspace-navigation">
          {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`} aria-current={activeWorkspace === id ? "page" : undefined} onClick={() => selectWorkspace(id)}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="side-system-state"><Activity size={15} /><span>System status</span><StatusBadge tone={online ? "success" : "warning"}>{online ? "Connected" : "Demo fallback"}</StatusBadge></div>
        <button className="side-logout" type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }}><LogOut size={17} />Logout</button>
      </aside>
      {mobileNavMode && mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Close workspace navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="app-shell" id="overview">
        <header className="topbar">
          <button
            ref={mobileNavTriggerRef}
            className="icon-button mobile-nav-trigger"
            type="button"
            aria-label="Open workspace navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
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
