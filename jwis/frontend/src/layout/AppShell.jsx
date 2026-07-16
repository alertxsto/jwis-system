import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCcw,
  Route,
  Search,
  Shield,
  Truck,
  Workflow,
  X,
} from "lucide-react";
import { StatusBadge } from "../ui/StatusBadge.jsx";

const items = [
  { id: "fleet", label: "Fleet Operations", icon: Truck, section: "Operations" },
  { id: "forecast", label: "Waste Forecast", icon: BarChart3, section: "Operations" },
  { id: "planning", label: "Integrated Planning", icon: Workflow, section: "Operations" },
  { id: "drivers", label: "Driver Analytics", icon: Truck, section: "Logistics" },
  { id: "weighbridge", label: "Weighbridge Logs", icon: Workflow, section: "Logistics" },
  { id: "wa", label: "WhatsApp Gateway", icon: MessageCircle, section: "Admin" },
  { id: "iot", label: "IoT Bin Sensors", icon: Activity, section: "Admin" },
  { id: "audit", label: "Data & ML Audit", icon: Shield, section: "Admin" },
];

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, children }) {
  const current = items.find((item) => item.id === activeWorkspace) || items[0];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavMode, setMobileNavMode] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  const mobileNavTriggerRef = useRef(null);
  const sideRailRef = useRef(null);
  const roleRaw = localStorage.getItem("jwis_role") || "operator";
  const roleLabel = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1);

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
    onWorkspaceChange(id);
    closeMobileNav();
  }

  const sections = ["Operations", "Logistics", "Admin"];
  const sectionLabels = {
    Operations: "Operations",
    Logistics: "Logistics (Case 1)",
    Admin: "Admin (Case 2)",
  };

  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

        {sections.map((section) => (
          <React.Fragment key={section}>
            <p className="nav-section-label">{sectionLabels[section]}</p>
            <nav className="side-nav" id={section === "Operations" ? "workspace-navigation" : undefined} data-testid={section === "Operations" ? "workspace-navigation" : undefined}>
              {items.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`}
                  aria-current={activeWorkspace === id ? "page" : undefined}
                  onClick={() => selectWorkspace(id)}
                >
                  <Icon size={17} />{label}
                </button>
              ))}
            </nav>
          </React.Fragment>
        ))}

        <div className="side-system-state">
          <Activity size={15} />
          <span>System status</span>
        </div>
        <button className="side-logout" type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }}>
          <LogOut size={17} />Logout
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
            <span>Home</span>
            <span className="breadcrumb-separator">&gt;</span>
            <strong>{current.label}</strong>
          </div>

          <div className="topbar-search">
            <Search size={15} aria-hidden="true" />
            <input ref={searchInputRef} type="text" placeholder="Search workspaces..." />
            <span className="kbd">Ctrl K</span>
          </div>

          <div className="top-actions">
            <StatusBadge tone={online ? "success" : "warning"}>{online ? "API connected" : "Offline demo"}</StatusBadge>
            <a className="ghost-button" href="/field"><Truck size={16} />Field app</a>
            <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh command center">
              <RefreshCcw size={16} />
            </button>
            <div className="profile-widget">
              <span className="profile-avatar" aria-hidden="true">JW</span>
              <div className="profile-info">
                <span className="profile-name">JWIS Team</span>
                <span className="profile-role">{roleLabel}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="workspace-canvas">{children}</div>
      </main>
    </div>
  );

}
