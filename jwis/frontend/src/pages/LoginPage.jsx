import React, { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Eye, EyeOff, LockKeyhole, Radio, Route, UserRound } from "lucide-react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";

export function LoginPage({ onLogin }) {
  const { lang, setLang, t } = useLanguage();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-surface" aria-labelledby="login-title">
        <aside className="login-story">
          <div className="login-story-brand"><span>J</span><div><strong>JWIS</strong><small>Jakarta Waste Intelligence System</small></div></div>
          <div className="login-story-copy">
            <span className="login-story-kicker"><Radio size={14} /> Pusat kendali operasional</span>
            <h1>Satu keputusan.<br />Seluruh operasi bergerak.</h1>
            <p>Prediksi beban, susun armada, dan tindak gangguan lapangan dalam satu alur kerja yang dapat diaudit.</p>
          </div>
          <div className="login-proof-list">
            <div><CheckCircle2 size={17} /><span><strong>Operasi langsung</strong><small>Armada, pengemudi, dan antrean TPA</small></span></div>
            <div><CheckCircle2 size={17} /><span><strong>Prediksi terukur</strong><small>Bukti data selalu menyertai rekomendasi</small></span></div>
            <div><CheckCircle2 size={17} /><span><strong>Akses terlindungi</strong><small>Hak tindakan mengikuti peran pengguna</small></span></div>
          </div>
          <div className="login-story-footer"><Building2 size={16} /> Dinas Lingkungan Hidup Provinsi DKI Jakarta</div>
        </aside>

        <div className="login-card">
          <div className="login-language">
            <button type="button" className={lang === "id" ? "active" : ""} onClick={() => setLang("id")}>ID</button>
            <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <div className="login-mobile-brand"><span><Route size={20} /></span><strong>JWIS</strong></div>
          <header>
            <span className="login-eyebrow">Akses operator</span>
            <h2 id="login-title">{lang === "id" ? "Masuk ke pusat kendali" : "Sign in to command center"}</h2>
            <p>{lang === "id" ? "Gunakan akun dinas yang telah terdaftar." : "Use your registered agency account."}</p>
          </header>
          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Nama pengguna</span>
              <div className="login-input"><UserRound size={18} /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="contoh: dispatcher" required /></div>
            </label>
            <label>
              <span>Kata sandi</span>
              <div className="login-input"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan kata sandi" required /><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? "Memeriksa…" : "Masuk"}<ArrowRight size={18} /></button>
          </form>
          <p className="login-help">Masalah akses? Hubungi administrator JWIS.</p>
        </div>
      </section>
    </main>
  );
}
