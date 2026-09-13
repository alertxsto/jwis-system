import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  Database,
  LogOut,
  Menu,
  MessageCircle,
  RefreshCcw,
  Route,
  Scale,
  Search,
  Truck,
  Users,
  Workflow,
  X,
} from "lucide-react";

/* Grouped by who uses them. Operators do not think in competition-case
   numbers, so the rail does not label anything "Case 1" or "Case 2". */
const items = [
  { id: "fleet", label: "Fleet Operations", icon: Truck, section: "operations", keywords: "truck map corridor deviation route" },
  { id: "forecast", label: "Waste Forecast", icon: BarChart3, section: "operations", keywords: "prediction kecamatan rainfall event tonnage" },
  { id: "planning", label: "Integrated Planning", icon: Workflow, section: "operations", keywords: "optimizer dispatch plan approval capacity" },
  { id: "drivers", label: "Driver Analytics", icon: Users, section: "field", keywords: "score compliance safety" },
  { id: "weighbridge", label: "Weighbridge Logs", icon: Scale, section: "field", keywords: "scale tonnage weighing transactions" },
  { id: "wa", label: "WhatsApp Gateway", icon: MessageCircle, section: "platform", keywords: "alert message contacts notification" },
  { id: "iot", label: "Bin Sensors", icon: Activity, section: "platform", keywords: "ultrasonic volume fill level" },
  { id: "audit", label: "Data & ML Audit", icon: Database, section: "platform", keywords: "provenance model registry evidence" },
];

const sectionLabels = {
  operations: "Operations",
  field: "Field & Logistics",
  platform: "Platform",
};

const sectionOrder = ["operations", "field", "platform"];

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onRefresh, onLogout, children }) {
  const current = items.find((item) => item.id === activeWorkspace) || items[0];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavMode, setMobileNavMode] = useState(() => window.matchMedia("(max-width: 860px)").matches);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileNavTriggerRef = useRef(null);
  const sideRailRef = useRef(null);
  const searchInputRef = useRef(null);

  const role = localStorage.getItem("jwis_role") || "dispatcher";
  const initials = role.slice(0, 2).toUpperCase();

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return items.filter((item) =>
      `${item.label} ${item.keywords}`.toLowerCase().includes(needle));
  }, [query]);

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

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setQuery("");
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectWorkspace(id) {
    onWorkspaceChange(id);
    setQuery("");
    setSearchOpen(false);
    closeMobileNav();
  }

  function onSearchKeyDown(event) {
    if (event.key === "Enter" && matches.length > 0) {
      event.preventDefault();
      selectWorkspace(matches[0].id);
    }
  }

  const resultsVisible = searchOpen && query.trim().length > 0;

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
          <span className="brand-mark" aria-hidden="true"><Route size={16} /></span>
          <div>
            <strong>JWIS</strong>
            <small>DLH Jakarta</small>
          </div>
        </div>

        {sectionOrder.map((section) => (
          <React.Fragment key={section}>
            <p className="nav-section-label">{sectionLabels[section]}</p>
            <nav
              className="side-nav"
              id={section === "operations" ? "workspace-navigation" : undefined}
              data-testid={section === "operations" ? "workspace-navigation" : undefined}
              aria-label={section === "operations" ? undefined : sectionLabels[section]}
            >
              {items.filter((item) => item.section === section).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`nav-tab-btn ${activeWorkspace === id ? "active" : ""}`}
                  aria-current={activeWorkspace === id ? "page" : undefined}
                  onClick={() => selectWorkspace(id)}
                >
                  <Icon size={15} aria-hidden="true" />{label}
                </button>
              ))}
            </nav>
          </React.Fragment>
        ))}

        <div className="side-system-state">
          <span className="status-dot" data-tone={online ? "success" : "warning"} aria-hidden="true" />
          <span>{online ? "API connected" : "Offline sample data"}</span>
        </div>
        <button className="side-logout" type="button" onClick={() => { setMobileNavOpen(false); onLogout(); }}>
          <LogOut size={15} aria-hidden="true" />Logout
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
            <span>{sectionLabels[current.section]}</span>
            <span className="breadcrumb-separator" aria-hidden="true">/</span>
            <strong>{current.label}</strong>
          </div>

          <div className="workspace-search">
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              role="combobox"
              aria-expanded={resultsVisible}
              aria-controls="workspace-search-results"
              aria-label="Search workspaces"
              placeholder="Search workspaces"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
            />
            <kbd>Ctrl K</kbd>
            {resultsVisible && (
              <ul className="workspace-search-results" id="workspace-search-results" role="listbox">
                {matches.length === 0 && <li className="workspace-search-empty">No workspace matches “{query}”.</li>}
                {matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" role="option" aria-selected={item.id === activeWorkspace} onClick={() => selectWorkspace(item.id)}>
                      <item.icon size={14} aria-hidden="true" />
                      <span>{item.label}</span>
                      <em>{sectionLabels[item.section]}</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="top-actions">
            {/* "Live" here would read as "this data is live", which is exactly
                what the map's Simulation pill denies. This badge reports API
                reachability, so it says so. */}
            <span className="connection-state" data-online={online ? "true" : "false"}>
              <span className="status-dot" data-tone={online ? "success" : "warning"} aria-hidden="true" />
              {online ? "API connected" : "API offline"}
            </span>
            <a className="ghost-button" href="/field"><Truck size={15} aria-hidden="true" />Field app</a>
            <button className="icon-button" type="button" onClick={onRefresh} aria-label="Refresh command center">
              <RefreshCcw size={15} />
            </button>
            <div className="profile-widget">
              <span className="profile-avatar" aria-hidden="true">{initials}</span>
              <div className="profile-info">
                <span className="profile-name">Signed in</span>
                <span className="profile-role">{role}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="workspace-canvas">{children}</div>
      </main>
    </div>
  );
}
