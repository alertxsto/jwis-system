import React, { useState } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";
import {
  Calendar,
} from "lucide-react";

export const PERMIT_VENUE_PRESETS = [
  { key: "gbk", label: "GBK Senayan", lat: -6.2183, lng: 106.8022 },
  { key: "monas", label: "Kawasan Monas", lat: -6.1754, lng: 106.8272 },
  { key: "jiexpo", label: "JIExpo Kemayoran", lat: -6.1448, lng: 106.8487 },
  { key: "ancol", label: "Ancol", lat: -6.1260, lng: 106.8450 },
  { key: "istora", label: "Istora Senayan", lat: -6.2270, lng: 106.7990 },
  { key: "cfd", label: "Bundaran HI (CFD)", lat: -6.1950, lng: 106.8230 },
];

export function PermitSubmissionPanel({ onPermitSubmitted }) {
  const { lang } = useLanguage();
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [attendance, setAttendanceLocal] = useState(50000);
  const [lat, setLat] = useState(-6.2183);
  const [lng, setLng] = useState(106.8022);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function applyPreset(key) {
    const preset = PERMIT_VENUE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setLat(preset.lat);
    setLng(preset.lng);
    if (!locationName) setLocationName(preset.label);
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/events/permits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, location_name: locationName, event_date: eventDate,
          expected_attendance: Number(attendance), lat: Number(lat), lng: Number(lng),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setResult(json);
      onPermitSubmitted?.(json.permit);
    } catch (err) {
      setError(lang === "id" ? "Pengajuan gagal — backend offline atau input tidak valid." : "Submission failed — backend offline or invalid input.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel wide" data-testid="permit-submission-panel">
      <div className="panel-title">
        <div>
          <h2>{lang === "id" ? "Pengajuan Izin Acara Keramaian" : "Event Permit Intake"}</h2>
          <p>{lang === "id" ? "Ajukan izin acara publik — sistem langsung mengestimasi volume sampah, kebutuhan armada, dan distrik terdampak." : "Submit an event permit — the system estimates waste generation, resources, and affected districts instantly."}</p>
        </div>
        <div className="panel-header-icon-wrap">
          <Calendar size={18} />
        </div>
      </div>

      <form className="permit-form" onSubmit={submit}>
        <label>{lang === "id" ? "Nama Acara" : "Event name"}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} placeholder={lang === "id" ? "misal: Konser Musik GBK" : "e.g. Konser Musik GBK"} />
        </label>
        <label>{lang === "id" ? "Pilihan Lokasi Populer" : "Venue preset"}
          <select defaultValue="gbk" onChange={(e) => applyPreset(e.target.value)} aria-label="Venue preset">
            {PERMIT_VENUE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label>{lang === "id" ? "Nama Lokasi / Area" : "Location"}
          <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} required minLength={3} placeholder={lang === "id" ? "Nama venue / area acara" : "Venue / area name"} />
        </label>
        <label>{lang === "id" ? "Tanggal Acara" : "Event date"}
          <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </label>
        <label>{lang === "id" ? "Estimasi Jumlah Penonton:" : "Expected attendance:"} <b>{Number(attendance).toLocaleString(lang === "id" ? "id-ID" : "en-US")} {lang === "id" ? "orang" : "people"}</b>
          <input type="range" min="1000" max="200000" step="1000" value={attendance} onChange={(e) => setAttendanceLocal(e.target.value)} />
        </label>
        <div className="permit-coords">
          <label>Lat <input type="number" step="0.0001" value={lat} onChange={(e) => setLat(e.target.value)} required /></label>
          <label>Lng <input type="number" step="0.0001" value={lng} onChange={(e) => setLng(e.target.value)} required /></label>
        </div>
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? (lang === "id" ? "Mengirim..." : "Submitting…") : (lang === "id" ? "Kirim Izin & Hitung Dampak Sampah" : "Submit permit & estimate impact")}
        </button>
        {error && <p className="permit-error">{error}</p>}
      </form>

      {result && (
        <div className="permit-impact" data-testid="permit-impact">
          <h3>{lang === "id" ? "Estimasi Dampak Sampah —" : "Estimated impact —"} {result.permit.name}</h3>
          <div className="facility-summary">
            <div><b>{result.impact.predicted_waste_tons} t</b><span>{lang === "id" ? "prediksi sampah" : "predicted waste"}</span></div>
            <div><b>{result.impact.backup_trucks_required}</b><span>{lang === "id" ? "truk cadangan" : "backup trucks"}</span></div>
            <div><b>{result.impact.crews_required}</b><span>{lang === "id" ? "kru lapangan" : "field crews"}</span></div>
            <div><b>{result.impact.man_hours_required}</b><span>{lang === "id" ? "jam-kerja kru" : "man-hours"}</span></div>
            <div><b>{result.impact.large_bins_required}</b><span>{lang === "id" ? "tong sampah besar" : "large bins"}</span></div>
          </div>
          <p className="permit-affected">
            {lang === "id" ? "Kecamatan terdampak:" : "Affected districts:"} {result.affected_kecamatan.map((a) => a.kecamatan).join(", ") || "nearest district assigned"}.
          </p>
          <p className="kec-note">{result.permit.data_note} Basis: {result.impact.resource_basis}.</p>
        </div>
      )}
    </section>
  );
}
