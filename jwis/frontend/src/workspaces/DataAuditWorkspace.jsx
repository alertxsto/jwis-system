import React, { useEffect, useState } from "react";
import { CheckCircle2, Database, ExternalLink, ShieldCheck, Truck } from "lucide-react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";

const COPY = {
  id: {
    loading: "Memuat registri data…",
    error: "Data audit tidak dapat dimuat. Periksa koneksi lalu coba lagi.",
    retry: "Coba lagi",
    kicker: "Transparansi keputusan",
    title: "Audit data & model",
    description: "Periksa asal, tahun data, keterbatasan, dan kelayakan data yang digunakan dalam keputusan JWIS.",
    datasets: "Dataset terdaftar",
    documented: "sumber terdokumentasi",
    real: "Dataset berlabel riil",
    realHint: "menurut klasifikasi sumber",
    fresh: "Terkini atau baru",
    freshHint: "berdasarkan tahun data",
    fleetUnits: "Unit armada",
    census: "sensus kendaraan 2023",
    sourceRegistry: "Registri sumber",
    provenance: "Asal dan keterbatasan data",
    dataset: "Dataset",
    datasetCount: (count) => `${count.toLocaleString("id-ID")} dataset`,
    unmapped: "Tidak dipetakan",
    status: "Status",
    rows: "Baris",
    granularity: "Resolusi",
    classification: "Klasifikasi",
    source: "Sumber",
    openSource: (name) => `Buka sumber ${name}`,
    internal: "Tautan tidak tersedia",
    emptyRegistry: "Belum ada dataset yang tercatat.",
    modelSuitability: "Kelayakan model",
    supportedResolution: "Resolusi yang didukung",
    emptyResolutions: "Belum ada penilaian resolusi.",
    modelNote: "Catatan model",
    unavailable: "Belum tersedia.",
    originalNote: "Catatan sumber (teks asli)",
    fleetComposition: "Komposisi armada",
    vehicleCensus: "Sensus kendaraan 2023",
    emptyFleet: "Data komposisi armada belum tersedia.",
    sourcePrefix: "Sumber",
    freshness: { current: "Terkini", recent: "Baru", stale: "Lama", unknown: "Tidak diketahui" },
    classes: { real: "Riil", proxy: "Proksi", derived: "Turunan", calibrated_synthetic: "Sintetis terkalibrasi" },
    suitability: { high: "Tinggi", reliable: "Andal", low: "Rendah", not_supported: "Tidak didukung" },
    granularities: {
      "city-year": "kota/tahun", "landfill-month": "TPA/bulan", "fleet-census": "sensus armada",
      "tps-location": "lokasi TPS", "kecamatan-year": "kecamatan/tahun",
      "kelurahan-age-gender": "kelurahan/usia/jenis kelamin", event: "acara",
      "national-holiday": "libur nasional", "kelurahan-polygon": "poligon kelurahan",
      "wr-location": "lokasi wajib retribusi",
    },
    resolutions: {
      hotspot_rank: "Peringkat titik rawan", city_day: "Kota/hari", district_month: "Kecamatan/bulan",
      district_week: "Kecamatan/minggu", district_day: "Kecamatan/hari",
    },
    vehicleTypes: {
      "Arm Roll Besar": "Arm roll besar", "Arm Roll Kecil": "Arm roll kecil",
      "Compactor Besar": "Pemadat besar", "Compactor Kecil": "Pemadat kecil",
      "Dump Truck Besar": "Truk bak besar", "Dump Truck Kecil": "Truk bak kecil",
      "Gerobak Motor": "Gerobak motor", "Tronton": "Tronton",
      "Truk Arm Roll Besar": "Truk arm roll besar", "Truk Arm Roll Kecil": "Truk arm roll kecil",
      "Truk Compactor Besar": "Truk pemadat besar", "Truk Compactor Kecil": "Truk pemadat kecil",
      "Truk Compactor Listrik Besar": "Truk pemadat listrik besar", "Truk Compactor Listrik Kecil": "Truk pemadat listrik kecil",
      "Truk Dump Truk Besar": "Truk bak besar", "Truk Dump Truk Kecil": "Truk bak kecil",
      "Truk Tronton": "Truk tronton",
    },
    fleetSource: "Sensus truk DKI 2023 (data.go.id)",
    modelSourceNote: "Resolusi harian per kecamatan menggunakan data sintetis terkalibrasi dan tidak boleh disajikan sebagai akurasi teramati.",
  },
  en: {
    loading: "Loading data registry…",
    error: "Audit data could not be loaded. Check your connection and try again.",
    retry: "Try again",
    kicker: "Decision transparency",
    title: "Data & model audit",
    description: "Review the origin, data year, limitations, and suitability of data used in JWIS decisions.",
    datasets: "Registered datasets",
    documented: "documented sources",
    real: "Datasets labeled real",
    realHint: "per source classification",
    fresh: "Current or recent",
    freshHint: "based on data year",
    fleetUnits: "Fleet units",
    census: "2023 vehicle census",
    sourceRegistry: "Source registry",
    provenance: "Data origins and limitations",
    dataset: "Dataset",
    datasetCount: (count) => `${count.toLocaleString("en-US")} ${count === 1 ? "dataset" : "datasets"}`,
    unmapped: "Unmapped",
    status: "Status",
    rows: "Rows",
    granularity: "Resolution",
    classification: "Classification",
    source: "Source",
    openSource: (name) => `Open source for ${name}`,
    internal: "Link unavailable",
    emptyRegistry: "No datasets recorded yet.",
    modelSuitability: "Model suitability",
    supportedResolution: "Supported resolutions",
    emptyResolutions: "No resolution assessments available yet.",
    modelNote: "Model note",
    unavailable: "Not available yet.",
    originalNote: "Source note (original wording)",
    fleetComposition: "Fleet composition",
    vehicleCensus: "2023 vehicle census",
    emptyFleet: "Fleet composition data is not available yet.",
    sourcePrefix: "Source",
    freshness: { current: "Current", recent: "Recent", stale: "Stale", unknown: "Unknown" },
    classes: { real: "Real", proxy: "Proxy", derived: "Derived", calibrated_synthetic: "Calibrated synthetic" },
    suitability: { high: "High", reliable: "Reliable", low: "Low", not_supported: "Not supported" },
    granularities: {
      "city-year": "city/year", "landfill-month": "landfill/month", "fleet-census": "fleet census",
      "tps-location": "TPS location", "kecamatan-year": "district/year",
      "kelurahan-age-gender": "village/age/gender", event: "event",
      "national-holiday": "national holiday", "kelurahan-polygon": "village polygon",
      "wr-location": "retribution payer location",
    },
    resolutions: {
      hotspot_rank: "Hotspot ranking", city_day: "City/day", district_month: "District/month",
      district_week: "District/week", district_day: "District/day",
    },
    vehicleTypes: {
      "Arm Roll Besar": "Large arm roll", "Arm Roll Kecil": "Small arm roll",
      "Compactor Besar": "Large compactor", "Compactor Kecil": "Small compactor",
      "Dump Truck Besar": "Large dump truck", "Dump Truck Kecil": "Small dump truck",
      "Gerobak Motor": "Motorized cart", "Tronton": "Heavy truck",
      "Truk Arm Roll Besar": "Large arm-roll truck", "Truk Arm Roll Kecil": "Small arm-roll truck",
      "Truk Compactor Besar": "Large compactor truck", "Truk Compactor Kecil": "Small compactor truck",
      "Truk Compactor Listrik Besar": "Large electric compactor truck", "Truk Compactor Listrik Kecil": "Small electric compactor truck",
      "Truk Dump Truk Besar": "Large dump truck", "Truk Dump Truk Kecil": "Small dump truck",
      "Truk Tronton": "Heavy truck",
    },
    fleetSource: "DKI truck census 2023 (data.go.id)",
    modelSourceNote: "Daily per-district resolution is calibrated-synthetic and must not be presented as observed accuracy.",
  },
};

// Translate only exact notes supplied by the provenance endpoint. Unknown wording remains
// visibly attributed to the source rather than being silently rewritten as a new claim.
const LIMITATIONS_ID = {
  "Yearly per-city daily-average timbulan; no daily or per-kecamatan resolution.": "Rata-rata timbulan harian per kota untuk tiap tahun; tidak tersedia resolusi harian atau per kecamatan.",
  "Monthly landfill intake totals; inconsistent tonase formats normalized on load.": "Total sampah masuk TPA per bulan; format tonase yang tidak konsisten dinormalisasi saat dimuat.",
  "Vehicle counts per wilayah/type; not live telematics.": "Jumlah kendaraan menurut wilayah dan jenis; bukan telemetri langsung.",
  "TPS registry; no operational throughput capacity.": "Registri TPS; tidak memuat kapasitas operasional.",
  "Per-kecamatan generation modeled by SILIKA population formula; lat/lng column labels swapped in source.": "Timbulan per kecamatan dimodelkan dengan rumus populasi SILIKA; label kolom lat/lng tertukar pada sumber.",
  "TPS capacity is a PROXY (not official operational capacity); demand side is real SILIKA.": "Kapasitas TPS adalah PROKSI (bukan kapasitas operasional resmi); sisi kebutuhan berasal dari data riil SILIKA.",
  "2013 census snapshot; used only as relative population weights.": "Cuplikan sensus 2013; hanya digunakan sebagai bobot populasi relatif.",
  "Officially-scraped event calendar; attendance present only where published.": "Kalender acara yang diambil dari sumber resmi; jumlah pengunjung hanya tersedia jika diterbitkan.",
  "2026 holidays; applied by month-day across years for fixed-date approximation.": "Hari libur 2026; tanggal dan bulan diterapkan lintas tahun sebagai pendekatan tanggal tetap.",
  "267 DKI village polygons; administrative boundaries only.": "267 poligon kelurahan DKI; hanya batas administratif.",
  "Official SILIKA TPS location coordinate layer.": "Lapisan koordinat lokasi TPS dari SILIKA resmi.",
  "Official SILIKA Wajib Retribusi commercial waste generator coordinate layer.": "Lapisan koordinat penghasil sampah komersial Wajib Retribusi dari SILIKA resmi.",
};

const BACKEND_MODEL_NOTE = COPY.en.modelSourceNote;
const BACKEND_FLEET_SOURCE = COPY.en.fleetSource;

function sourceNote(note, lang, copy) {
  if (!note) return copy.unavailable;
  if (lang === "en") return note;
  if (note === BACKEND_MODEL_NOTE) return copy.modelSourceNote;
  return LIMITATIONS_ID[note] || `${copy.originalNote}: ${note}`;
}

export function DataAuditWorkspace() {
  const { lang } = useLanguage();
  const copy = COPY[lang] || COPY.id;
  const locale = lang === "en" ? "en-US" : "id-ID";
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(false);
      try {
        const responses = await Promise.all([
          fetch(`${API_URL}/data/provenance`, { signal: controller.signal }),
          fetch(`${API_URL}/fleet/composition`, { signal: controller.signal }),
          fetch(`${API_URL}/ml/suitability`, { signal: controller.signal }),
        ]);
        if (responses.some((response) => !response.ok)) throw new Error("Audit request failed");
        const [provenance, fleet, suitability] = await Promise.all(responses.map((response) => response.json()));
        if (!Array.isArray(provenance?.records) || !fleet || !suitability?.resolutions) {
          throw new Error("Incomplete audit response");
        }
        if (!controller.signal.aborted) setAudit({ provenance, fleet, suitability });
      } catch (cause) {
        if (!controller.signal.aborted) {
          console.error("Failed to load audit data", cause);
          setError(true);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [retry]);

  if (!audit && !error) return <div className="workspace-loading" role="status"><span />{copy.loading}</div>;
  if (error) return (
    <section className="audit-workspace workspace-page" data-testid="audit-workspace">
      <div className="workspace-loading" role="alert">{copy.error} <button type="button" className="secondary-button" onClick={() => { setAudit(null); setRetry((count) => count + 1); }}>{copy.retry}</button></div>
    </section>
  );

  const { provenance, fleet, suitability } = audit;
  const records = provenance.records;
  const fleetTypes = fleet.by_vehicle_type || {};
  const resolutions = suitability.resolutions;
  const currentRecords = records.filter((record) => record.freshness === "current" || record.freshness === "recent").length;
  const realRecords = records.filter((record) => record.classification === "real").length;
  const number = (value) => value == null ? "—" : Number(value).toLocaleString(locale);

  return (
    <section className="audit-workspace workspace-page" data-testid="audit-workspace">
      <header className="workspace-heading">
        <div>
          <span className="workspace-kicker"><ShieldCheck size={14} /> {copy.kicker}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
      </header>

      <div className="audit-summary-strip">
        <div><span>{copy.datasets}</span><strong>{number(records.length)}</strong><small><Database size={14} /> {copy.documented}</small></div>
        <div><span>{copy.real}</span><strong>{number(realRecords)}</strong><small><CheckCircle2 size={14} /> {copy.realHint}</small></div>
        <div><span>{copy.fresh}</span><strong>{number(currentRecords)}</strong><small>{copy.freshHint}</small></div>
        <div><span>{copy.fleetUnits}</span><strong>{number(fleet.total_units)}</strong><small><Truck size={14} /> {fleet.source === BACKEND_FLEET_SOURCE ? copy.census : fleet.source ? `${copy.sourcePrefix}: ${fleet.source}` : copy.unavailable}</small></div>
      </div>

      <div className="audit-layout">
        <section className="audit-registry-surface">
          <div className="section-intro compact">
            <div><span className="surface-kicker">{copy.sourceRegistry}</span><h2>{copy.provenance}</h2></div>
            <p>{copy.datasetCount(records.length)}</p>
          </div>
          <div className="table-wrap">
            <table className="audit-table" aria-label={copy.sourceRegistry}>
              <thead><tr><th>{copy.dataset}</th><th>{copy.status}</th><th>{copy.rows}</th><th>{copy.granularity}</th><th>{copy.classification}</th><th>{copy.source}</th></tr></thead>
              <tbody>
                {records.length === 0 && <tr><td colSpan={6}>{copy.emptyRegistry}</td></tr>}
                {records.map((record) => (
                  <tr key={record.name}>
                    <td><strong>{record.name}</strong><small>{sourceNote(record.limitations, lang, copy)}</small></td>
                    <td><span className={`freshness-badge ${Object.hasOwn(copy.freshness, record.freshness) ? record.freshness : "unknown"}`}>{copy.freshness[record.freshness] || copy.freshness.unknown}</span></td>
                    <td>{number(record.row_count)}</td>
                    <td><code>{copy.granularities[record.granularity] || copy.unmapped}</code></td>
                    <td><span className={`classification-badge ${Object.hasOwn(copy.classes, record.classification) ? record.classification : "unknown"}`}>{copy.classes[record.classification] || copy.freshness.unknown}</span></td>
                    <td>{String(record.source_url || "").startsWith("https://") ? <a href={record.source_url} target="_blank" rel="noreferrer" aria-label={copy.openSource(record.name)}><ExternalLink size={15} /></a> : <span>{copy.internal}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="audit-evidence-rail">
          <section>
            <span className="surface-kicker">{copy.modelSuitability}</span>
            <h2>{copy.supportedResolution}</h2>
            <div className="suitability-list">
              {Object.keys(resolutions).length === 0 && <p>{copy.emptyResolutions}</p>}
              {Object.entries(resolutions).map(([resolution, status]) => (
                <div key={resolution}><code>{copy.resolutions[resolution] || copy.unmapped}</code><span className={status === "reliable" || status === "high" ? "good" : "limited"}>{copy.suitability[status] || copy.freshness.unknown}</span></div>
              ))}
            </div>
            <p className="model-honesty-note"><strong>{copy.modelNote}</strong>{sourceNote(suitability.note, lang, copy)}</p>
          </section>

          <section>
            <span className="surface-kicker">{copy.fleetComposition}</span>
            <h2>{fleet.source === BACKEND_FLEET_SOURCE ? copy.vehicleCensus : copy.fleetComposition}</h2>
            <div className="fleet-composition-list">
              {Object.keys(fleetTypes).length === 0 && <p>{copy.emptyFleet}</p>}
              {Object.entries(fleetTypes).map(([type, count]) => <div key={type}><span>{copy.vehicleTypes[type] || type}</span><strong>{number(count)}</strong></div>)}
            </div>
            <small className="audit-source">{copy.sourcePrefix}: {fleet.source === BACKEND_FLEET_SOURCE ? copy.fleetSource : fleet.source ? `${copy.originalNote}: ${fleet.source}` : "—"}</small>
          </section>
        </aside>
      </div>
    </section>
  );
}
