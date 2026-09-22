import React, { Fragment, useState, useEffect, useCallback } from "react";
import { API_URL } from "../config.js";

export function SpjCreateForm({ onCreated }) {
  const [fleet, setFleet] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState({
    truck_code: "", destination: "TPST Bantargebang",
    weigh_on_site: false, priority: "normal", note: "",
  });
  const [stops, setStops] = useState([]);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/fleet`).then((r) => r.json()).then(setFleet).catch(() => {});
    fetch(`${API_URL}/geo/tps-coordinates`).then((r) => r.json())
      .then((body) => setSites(
        (body.features || []).map((f) => ({
          name: f.properties?.name || "",
          kecamatan: f.properties?.kecamatan || "",
          address: f.properties?.name || "",
          lat: f.geometry?.coordinates?.[1],
          lng: f.geometry?.coordinates?.[0],
        })).filter((s) => s.name && s.lat != null && s.lng != null)
      )).catch(() => {});
  }, []);

  const trucks = Array.isArray(fleet) ? fleet : fleet.trucks || [];

  const addStop = () => {
    const site = sites.find((s) => s.name === pick);
    if (!site) return;
    setStops((prev) => [...prev, {
      name: site.name, kecamatan: site.kecamatan || "",
      address: site.address || site.name, lat: site.lat, lng: site.lng,
    }]);
    setPick("");
  };

  const save = () => {
    if (!form.truck_code || !stops.length) return;
    setSaving(true);
    setError("");
    const truck = trucks.find((t) => t.truck_code === form.truck_code) || {};
    fetch(`${API_URL}/spj`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driver_name: truck.driver_name || "Driver",
        truck_code: form.truck_code,
        destination: form.destination,
        weigh_on_site: form.weigh_on_site,
        priority: form.priority, note: form.note,
      }),
    }).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.spj_id) {
        throw new Error(body.detail || body.message || `Gagal membuat SPJ (HTTP ${r.status})`);
      }
      return body;
    })
      .then((spj) => Promise.all(stops.map((s) =>
        fetch(`${API_URL}/spj/${spj.spj_id}/stops`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s),
        }))).then(() => spj))
      .then(() => {
        setStops([]); setPick("");
        setForm({ truck_code: "", destination: "TPST Bantargebang",
                  weigh_on_site: false, priority: "normal", note: "" });
        onCreated();
      })
      .catch((err) => setError(err.message || "Gagal menyimpan SPJ"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="spj-form">
      <h4>Buat SPJ Baru</h4>
      <div className="spj-form-grid">
        <select value={form.truck_code} aria-label="Kendaraan"
          onChange={(e) => setForm({ ...form, truck_code: e.target.value })}>
          <option value="">Pilih kendaraan…</option>
          {trucks.map((t) => (
            <option key={t.truck_code} value={t.truck_code}>
              {t.truck_code} — {t.driver_name}
            </option>
          ))}
        </select>
        <select value={form.destination} aria-label="Tujuan pembuangan"
          onChange={(e) => setForm({ ...form, destination: e.target.value })}>
          {["TPST Bantargebang", "JRC Pesanggrahan", "RDF Plant Jakarta"]
            .map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={form.priority} aria-label="Prioritas"
          onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="normal">Normal</option>
          <option value="vip">VIP (permintaan khusus)</option>
        </select>
        <label className="spj-weigh">
          <input type="checkbox" checked={form.weigh_on_site}
            onChange={(e) => setForm({ ...form, weigh_on_site: e.target.checked })} />
          Timbang di lokasi
        </label>
        <input type="text" placeholder="Keterangan" value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="spj-stop-picker">
        <input list="spj-sites" placeholder="Cari lokasi TPS…" value={pick}
          onChange={(e) => setPick(e.target.value)} />
        <datalist id="spj-sites">
          {sites.map((s, i) => <option key={i} value={s.name} />)}
        </datalist>
        <button type="button" className="compact-enforce-btn" onClick={addStop}>
          Tambah Titik
        </button>
      </div>
      {stops.length > 0 && (
        <ul className="spj-stop-list">
          {stops.map((s, i) => (
            <li key={i}>
              {i + 1}. {s.name} ({s.kecamatan})
              <button type="button"
                onClick={() => setStops(stops.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="spj-form-error" role="alert">{error}</p>}
      <button type="button" className="compact-enforce-btn" disabled={saving}
        onClick={save}>
        {saving ? "Menyimpan…" : "Simpan Draft"}
      </button>
    </div>
  );
}

export function SpjPanel() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(null);
  const [evidence, setEvidence] = useState(null);

  const load = useCallback(() => {
    fetch(`${API_URL}/spj`).then((r) => r.json())
      .then((body) => setItems(body.spj || [])).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const toggleOpen = (spjId) => {
    if (open === spjId) {
      setOpen(null);
      setEvidence(null);
      return;
    }
    setOpen(spjId);
    setEvidence(null);
    fetch(`${API_URL}/spj/${spjId}/evidence-summary`)
      .then((r) => r.json())
      .then(setEvidence)
      .catch(() => {});
  };

  const act = (url) => fetch(url, { method: "POST" }).then(load).catch(() => {});

  const statusPill = {
    draft: "pill",
    aktif: "pill success",
    selesai: "pill live",
    batal: "pill danger",
  };

  return (
    <div className="panel-card spj-panel">
      <div className="panel-head">
        <h3>Surat Perintah Jalan</h3>
        <span className="pill">{items.length} SPJ</span>
      </div>
      <SpjCreateForm onCreated={load} />
      <table className="spj-table">
        <thead>
          <tr>
            <th>Nomor</th><th>Driver</th><th>Truk</th><th>Tujuan</th>
            <th>Progres</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const done = s.stops.filter((x) => x.status === "completed").length;
            return (
              <Fragment key={s.spj_id}>
                <tr onClick={() => toggleOpen(s.spj_id)}
                  className="spj-row">
                  <td>{s.spj_number}{s.priority === "vip" ? " ★VIP" : ""}</td>
                  <td>{s.driver_name}</td>
                  <td>{s.truck_code}</td>
                  <td>{s.destination}</td>
                  <td>{done}/{s.stops.length}</td>
                  <td><span className={statusPill[s.status] || "pill"}>
                    {s.status}</span></td>
                </tr>
                {open === s.spj_id && (
                  <tr className="spj-detail">
                    <td colSpan={6}>
                      <ol>
                        {s.stops.map((stop, i) => (
                          <li key={i}>
                            {stop.name} — {stop.kecamatan}
                            {stop.status === "completed" ? " ✓" : (
                              s.status === "aktif" && (
                                <button className="compact-enforce-btn"
                                  onClick={() => act(
                                    `${API_URL}/spj/${s.spj_id}/stops/${i}/complete`)}>
                                  Tandai selesai
                                </button>
                              )
                            )}
                          </li>
                        ))}
                      </ol>
                      {evidence && evidence.stops.some((st) => st.has_arrival || st.weighing_count > 0) && (
                        <ul className="spj-evidence">
                          {evidence.stops.map((st) => (
                            (st.has_arrival || st.weighing_count > 0 || st.officer_name) && (
                              <li key={st.index}>
                                <strong>{st.name}:</strong>{" "}
                                {st.has_arrival && "✓ Kedatangan (geotag) "}
                                {st.weighing_count > 0 &&
                                  `· ✓ Timbang ${st.weighing_count} foto — ${st.total_weight_kg} kg (${Object.entries(st.fractions || {}).map(([f, kg]) => `${f} ${kg}kg`).join(", ")}) `}
                                {st.officer_name && `· ✓ Petugas: ${st.officer_name}`}
                              </li>
                            )
                          ))}
                        </ul>
                      )}
                      {s.status === "draft" && (
                        <button className="compact-enforce-btn"
                          onClick={() => act(`${API_URL}/spj/${s.spj_id}/activate`)}>
                          Rubah ke Aktif
                        </button>
                      )}
                      {s.status === "aktif" && (
                        <button className="compact-enforce-btn"
                          onClick={() => act(`${API_URL}/spj/${s.spj_id}/complete`)}>
                          Selesaikan SPJ
                        </button>
                      )}
                      {["draft", "aktif"].includes(s.status) && (
                        <button className="compact-enforce-btn"
                          onClick={() => act(`${API_URL}/spj/${s.spj_id}/cancel`)}>
                          Batalkan
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
