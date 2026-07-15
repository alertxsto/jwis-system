import React from "react";
import { Activity, BarChart3, LogOut, RefreshCcw, Route, Truck, Workflow } from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const items = [
  { id: "fleet", label: "Fleet Operations", icon: Truck },
  { id: "forecast", label: "Waste Forecast", icon: BarChart3 },
  { id: "planning", label: "Integrated Planning", icon: Workflow },
];

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, children }) {
  const current = items.find((item) => item.id === activeWorkspace) || items[0];

  return (
    <div className="dashboard-frame professional-shell">
      <aside className="side-rail" aria-label="JWIS navigation">
        <div className="side-brand"><span className="brand-mark"><Route size={19} /></span><div><strong>JWIS</strong><small>DLH Command</small></div></div>
        <p className="nav-section-label">Operations</p>
        <nav className="side-nav" data-testid="workspace-navigation">
          {items.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`} aria-current={activeWorkspace === id ? "page" : undefined} onClick={() => onWorkspaceChange(id)}><Icon size={17} />{label}</button>)}
        </nav>
        <div className="side-system-state"><Activity size={15} /><span>System status</span><StatusBadge tone={online ? "success" : "warning"}>{online ? "Connected" : "Demo fallback"}</StatusBadge></div>
        <button className="side-logout" type="button" onClick={onLogout}><LogOut size={17} />Logout</button>
      </aside>
      <main className="app-shell" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>JWIS</span><span>/</span><strong>{current.label}</strong></div>
          <div className="top-actions"><StatusBadge tone={online ? "success" : "warning"}>{online ? "API connected" : "Offline demo"}</StatusBadge><a className="ghost-button" href="/field"><Truck size={16} />Field app</a><button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh command center"><RefreshCcw size={17} /></button></div>
        </header>
        <div className="workspace-canvas">{children}</div>
      </main>
    </div>
  );
}
