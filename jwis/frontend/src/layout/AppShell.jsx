import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  ChevronDown,
  CircleUserRound,
  LogOut,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Workflow,
} from "lucide-react";
import { useLanguage } from "../i18n.jsx";

const items = [
  { id: "fleet", key: "nav_armada", icon: Truck, description: "Pantau dan tangani operasi hari ini" },
  { id: "forecast", key: "nav_prediksi", icon: BarChart3, description: "Antisipasi beban layanan berikutnya" },
  { id: "planning", key: "nav_rencana", icon: Workflow, description: "Susun dan setujui rencana operasi" },
  { id: "drivers", key: "nav_sopir", icon: Users, description: "Kelola kepatuhan dan kinerja pengemudi" },
  { id: "audit", key: "nav_audit", icon: ShieldCheck, description: "Periksa mutu data dan model" },
];

const ALIASES = {
  surveillance: "fleet",
  weighbridge: "fleet",
  wa: "drivers",
  iot: "audit",
};

export function AppShell({ activeWorkspace, onWorkspaceChange, online, onLogout, assistant, children }) {
  const { lang, setLang, t } = useLanguage();
  const resolvedWorkspace = ALIASES[activeWorkspace] || activeWorkspace;
  const current = items.find((item) => item.id === resolvedWorkspace) || items[0];
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setAssistantOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectWorkspace(id) {
    onWorkspaceChange(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="command-shell">
      <aside className="command-sidebar" aria-label="Navigasi utama JWIS">
        <div className="command-brand">
          <span className="command-brand-mark" aria-hidden="true">J</span>
          <div>
            <strong>JWIS</strong>
            <small>Pusat kendali DLH</small>
          </div>
        </div>

        <div className="command-nav-label">Ruang kerja</div>
        <nav className="command-nav" id="workspace-navigation" data-testid="workspace-navigation">
          {items.map(({ id, key, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`command-nav-item ${resolvedWorkspace === id ? "active" : ""}`}
              aria-current={resolvedWorkspace === id ? "page" : undefined}
              onClick={() => selectWorkspace(id)}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{t(key)}</span>
            </button>
          ))}
        </nav>

        <div className="command-sidebar-footer">
          <div className="system-connection">
            <span className={`connection-dot ${online ? "online" : "offline"}`} />
            <div>
              <strong>{online ? "Sistem terhubung" : "Mode terbatas"}</strong>
              <small>{online ? "Data diperbarui otomatis" : "Menggunakan data cadangan"}</small>
            </div>
          </div>
          <button className="command-logout" type="button" onClick={onLogout}>
            <LogOut size={18} />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <main className="command-main" id="overview">
        <header className="command-topbar">
          <div className="command-context">
            <span className="command-eyebrow">Operasi DKI Jakarta</span>
            <div className="command-title-row">
              <strong>{t(current.key)}</strong>
              <span>{current.description}</span>
            </div>
          </div>

          <div className="command-top-actions">
            <div className="command-language" aria-label="Pilih bahasa">
              <button type="button" data-testid="lang-switch-id" className={lang === "id" ? "active" : ""} onClick={() => setLang("id")}>ID</button>
              <button type="button" data-testid="lang-switch-en" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
            <button className="command-assistant" type="button" onClick={() => setAssistantOpen(true)}>
              <Sparkles size={17} />
              <span>Asisten operasi</span>
            </button>
            <button className="command-profile" type="button" aria-label="Profil operator">
              <span className="command-avatar"><CircleUserRound size={19} /></span>
              <span className="command-profile-copy"><strong>JWIS Team</strong><small>Operator DLH</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        <div className="command-canvas">{children}</div>

        <nav className="command-mobile-nav" aria-label="Navigasi ruang kerja seluler">
          {items.map(({ id, key, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={resolvedWorkspace === id ? "active" : ""}
              aria-current={resolvedWorkspace === id ? "page" : undefined}
              onClick={() => selectWorkspace(id)}
            >
              <Icon size={20} />
              <span>{id === "audit" ? "Audit" : t(key)}</span>
            </button>
          ))}
        </nav>

        {assistantOpen && (
          <div className="assistant-modal-backdrop" role="presentation" onMouseDown={() => setAssistantOpen(false)}>
            <section className="assistant-modal" role="dialog" aria-modal="true" aria-label="Asisten operasi" onMouseDown={(event) => event.stopPropagation()}>
              <button className="assistant-close" type="button" aria-label="Tutup asisten" onClick={() => setAssistantOpen(false)}>×</button>
              {assistant}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
