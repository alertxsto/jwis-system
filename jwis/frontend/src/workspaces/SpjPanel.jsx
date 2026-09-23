import React, { Fragment, useState, useEffect, useCallback } from "react";
import { API_URL } from "../config.js";
import { useLanguage } from "../i18n.jsx";

const copy = {
  id: {
    title: "Surat Perintah Jalan", create: "Buat SPJ baru", vehicle: "Kendaraan",
    selectVehicle: "Pilih kendaraan…", destination: "Tujuan pembuangan",
    priority: "Prioritas", normal: "Normal", vip: "VIP (permintaan khusus)",
    weighOnSite: "Timbang di lokasi", note: "Keterangan", searchSite: "Cari lokasi TPS…",
    addStop: "Tambah titik", removeStop: "Hapus titik", selectSite: "Pilih lokasi TPS dari daftar untuk menambahkan titik.",
    selectTruckStops: "Pilih kendaraan dan tambahkan setidaknya satu titik.",
    saving: "Menyimpan…", saveDraft: "Simpan draf", number: "Nomor",
    driver: "Pengemudi", truck: "Truk", destinationColumn: "Tujuan",
    progress: "Kemajuan", status: "Status", loading: "Memuat daftar SPJ…",
    loadingVehicles: "Memuat kendaraan…", loadingSites: "Memuat lokasi TPS…",
    empty: "Belum ada SPJ. Buat draf untuk memulai.",
    draft: "Draf", aktif: "Aktif", selesai: "Selesai", batal: "Dibatalkan",
    pending: "Belum selesai", completed: "Selesai", unknown: "Tidak diketahui",
    showDetails: "Tampilkan rincian", hideDetails: "Sembunyikan rincian",
    stopComplete: "Tandai titik selesai", activate: "Ubah ke aktif",
    complete: "Selesaikan SPJ", cancel: "Batalkan SPJ", tableLabel: "Daftar surat perintah jalan",
    evidenceLoading: "Memuat ringkasan bukti…", evidenceEmpty: "Belum ada bukti untuk SPJ ini.",
    arrival: "Kedatangan (geotag)", weighing: "Penimbangan", photos: "foto",
    officer: "Petugas", retry: "Coba lagi", noSession: "Sesi berakhir atau belum masuk. Masuk kembali, lalu coba lagi.",
    forbidden: "Akun ini tidak memiliki izin untuk tindakan SPJ tersebut. Gunakan akun dengan izin pengiriman atau hubungi pengawas.",
    conflict: "Status atau persyaratan SPJ telah berubah. Perbarui daftar dan periksa titiknya.",
    invalid: "Periksa data SPJ lalu coba lagi.", serverFailed: "Layanan sedang bermasalah. Coba lagi nanti.",
    createFailed: "Gagal membuat SPJ", stopFailed: "Gagal menambahkan titik ke SPJ",
    actionFailed: "Gagal memperbarui SPJ", listFailed: "Gagal memuat daftar SPJ",
    fleetFailed: "Gagal memuat kendaraan", sitesFailed: "Gagal memuat lokasi TPS",
    evidenceFailed: "Gagal memuat ringkasan bukti", networkFailed: "Periksa koneksi dan coba lagi.",
    retryStops: "Draf SPJ sudah dibuat. Lanjutkan penambahan titik tanpa membuat draf baru.",
    continueStops: "Lanjutkan penambahan titik", missingDriver: "Kendaraan yang dipilih tidak memiliki pengemudi terdaftar.",
  },
  en: {
    title: "Dispatch orders", create: "Create a dispatch order", vehicle: "Vehicle",
    selectVehicle: "Select a vehicle…", destination: "Disposal destination",
    priority: "Priority", normal: "Normal", vip: "VIP (special request)",
    weighOnSite: "Weigh on site", note: "Notes", searchSite: "Search TPS sites…",
    addStop: "Add stop", removeStop: "Remove stop", selectSite: "Select a TPS site from the list to add a stop.",
    selectTruckStops: "Select a vehicle and add at least one stop.",
    saving: "Saving…", saveDraft: "Save draft", number: "Number",
    driver: "Driver", truck: "Truck", destinationColumn: "Destination",
    progress: "Progress", status: "Status", loading: "Loading dispatch orders…",
    loadingVehicles: "Loading vehicles…", loadingSites: "Loading TPS sites…",
    empty: "No dispatch orders yet. Create a draft to get started.",
    draft: "Draft", aktif: "Active", selesai: "Completed", batal: "Canceled",
    pending: "Pending", completed: "Completed", unknown: "Unknown",
    showDetails: "Show details for", hideDetails: "Hide details for",
    stopComplete: "Mark stop complete", activate: "Change to active",
    complete: "Complete order", cancel: "Cancel order", tableLabel: "Dispatch order list",
    evidenceLoading: "Loading evidence summary…", evidenceEmpty: "No evidence recorded for this order.",
    arrival: "Arrival (geotag)", weighing: "Weighing", photos: "photos",
    officer: "Officer", retry: "Try again", noSession: "Your session has expired or you are not signed in. Sign in again, then retry.",
    forbidden: "This account cannot perform that dispatch action. Use an account with dispatch permission or contact a supervisor.",
    conflict: "The order status or requirements changed. Refresh the list and check its stops.",
    invalid: "Check the order details and try again.", serverFailed: "The service is unavailable. Try again later.",
    createFailed: "Could not create the dispatch order", stopFailed: "Could not add stops to the dispatch order",
    actionFailed: "Could not update the dispatch order", listFailed: "Could not load dispatch orders",
    fleetFailed: "Could not load vehicles", sitesFailed: "Could not load TPS sites",
    evidenceFailed: "Could not load evidence summary", networkFailed: "Check your connection and try again.",
    retryStops: "The draft was created. Continue adding stops without creating another draft.",
    continueStops: "Continue adding stops", missingDriver: "The selected vehicle has no assigned driver.",
  },
};

function errorMessage(error, label, words) {
  if (error.status === 401) return words.noSession;
  if (error.status === 403) return words.forbidden;
  if (error.status === 409) return `${label} (HTTP 409). ${words.conflict}`;
  if (error.status === 422 || error.status === 400) return `${label} (HTTP ${error.status}). ${words.invalid}`;
  if (error.status >= 500) return `${label} (HTTP ${error.status}). ${words.serverFailed}`;
  if (!error.status) return `${label}. ${words.networkFailed}`;
  return `${label} (HTTP ${error.status}).`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail :
      typeof body.message === "string" ? body.message : "";
    throw Object.assign(new Error(detail), { status: response.status, detail });
  }
  return body;
}

function post(path, payload) {
  const token = localStorage.getItem("jwis_token");
  return request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

const initialForm = {
  truck_code: "", destination: "TPST Bantargebang",
  weigh_on_site: false, priority: "normal", note: "",
};

export function SpjCreateForm({ onCreated }) {
  const { lang } = useLanguage();
  const words = copy[lang] || copy.id;
  const [fleet, setFleet] = useState([]);
  const [sites, setSites] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [stops, setStops] = useState([]);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [fleetError, setFleetError] = useState("");
  const [sitesError, setSitesError] = useState("");
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [loadingSites, setLoadingSites] = useState(true);

  useEffect(() => {
    let active = true;
    request("/fleet").then((body) => { if (active) setFleet(body); })
      .catch((err) => { if (active) setFleetError(err); })
      .finally(() => { if (active) setLoadingFleet(false); });
    request("/geo/tps-coordinates").then((body) => {
      if (active) setSites((body.features || []).map((f) => ({
        name: f.properties?.name || "",
        kecamatan: f.properties?.kecamatan || "",
        address: f.properties?.name || "",
        lat: f.geometry?.coordinates?.[1],
        lng: f.geometry?.coordinates?.[0],
      })).filter((s) => s.name && s.lat != null && s.lng != null));
    }).catch((err) => { if (active) setSitesError(err); })
      .finally(() => { if (active) setLoadingSites(false); });
    return () => { active = false; };
  }, []);

  const trucks = Array.isArray(fleet) ? fleet : fleet.trucks || [];

  const addStop = () => {
    const site = sites.find((s) => s.name === pick);
    if (!site) { setError({ key: "selectSite" }); return; }
    setStops((prev) => [...prev, {
      name: site.name, kecamatan: site.kecamatan || "",
      address: site.address || site.name, lat: site.lat, lng: site.lng,
    }]);
    setPick("");
    setError(null);
  };

  const save = async () => {
    if (saving) return;
    if (!pendingDraft && (!form.truck_code || !stops.length)) {
      setError({ key: "selectTruckStops" });
      return;
    }
    const truck = trucks.find((t) => t.truck_code === form.truck_code);
    if (!pendingDraft && !truck?.driver_name) {
      setError({ key: "missingDriver" });
      return;
    }
    setSaving(true);
    setError(null);
    let draft = pendingDraft;
    let nextStop = pendingDraft?.nextStop || 0;
    try {
      if (!draft) {
        const spj = await post("/spj", {
          driver_name: truck.driver_name,
          truck_code: form.truck_code,
          destination: form.destination,
          weigh_on_site: form.weigh_on_site,
          priority: form.priority,
          note: form.note,
        });
        if (!spj.spj_id) throw new Error("Missing SPJ ID");
        draft = { id: spj.spj_id, stops: [...stops] };
      }
      for (; nextStop < draft.stops.length; nextStop++) {
        await post(`/spj/${encodeURIComponent(draft.id)}/stops`, draft.stops[nextStop]);
      }
      setPendingDraft(null);
      setStops([]);
      setPick("");
      setForm(initialForm);
      onCreated();
    } catch (err) {
      setError({ cause: err, label: draft ? "stopFailed" : "createFailed", created: !!draft });
      if (draft) {
        setPendingDraft({ ...draft, nextStop });
        onCreated();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="spj-form">
      <h4>{words.create}</h4>
      <div className="spj-form-grid">
        <select value={form.truck_code} aria-label={words.vehicle} disabled={!!pendingDraft}
          onChange={(e) => setForm({ ...form, truck_code: e.target.value })}>
          <option value="">{loadingFleet ? words.loadingVehicles : words.selectVehicle}</option>
          {trucks.map((t) => (
            <option key={t.truck_code} value={t.truck_code}>
              {t.truck_code} — {t.driver_name}
            </option>
          ))}
        </select>
        <select value={form.destination} aria-label={words.destination} disabled={!!pendingDraft}
          onChange={(e) => setForm({ ...form, destination: e.target.value })}>
          {["TPST Bantargebang", "JRC Pesanggrahan", "RDF Plant Jakarta"]
            .map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={form.priority} aria-label={words.priority} disabled={!!pendingDraft}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="normal">{words.normal}</option>
          <option value="vip">{words.vip}</option>
        </select>
        <label className="spj-weigh">
          <input type="checkbox" checked={form.weigh_on_site} disabled={!!pendingDraft}
            onChange={(e) => setForm({ ...form, weigh_on_site: e.target.checked })} />
          {words.weighOnSite}
        </label>
        <input type="text" aria-label={words.note} placeholder={words.note} value={form.note} disabled={!!pendingDraft}
          onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      <div className="spj-stop-picker">
        <input list="spj-sites" aria-label={words.searchSite} placeholder={loadingSites ? words.loadingSites : words.searchSite} value={pick} disabled={!!pendingDraft}
          onChange={(e) => setPick(e.target.value)} />
        <datalist id="spj-sites">
          {sites.map((s, i) => <option key={i} value={s.name} />)}
        </datalist>
        <button type="button" className="compact-enforce-btn" onClick={addStop} disabled={loadingSites || !!pendingDraft}>
          {words.addStop}
        </button>
      </div>
      {stops.length > 0 && (
        <ul className="spj-stop-list">
          {stops.map((s, i) => (
            <li key={i}>
              {i + 1}. {s.name} ({s.kecamatan})
              <button type="button" aria-label={`${words.removeStop}: ${s.name}`} disabled={!!pendingDraft}
                onClick={() => setStops(stops.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {fleetError && <p className="spj-form-error" role="alert">{errorMessage(fleetError, words.fleetFailed, words)}</p>}
      {sitesError && <p className="spj-form-error" role="alert">{errorMessage(sitesError, words.sitesFailed, words)}</p>}
      {error && <p className="spj-form-error" role="alert">{error.key ? words[error.key] :
        `${errorMessage(error.cause, words[error.label], words)}${error.created ? ` ${words.retryStops}` : ""}`}</p>}
      <button type="button" className="compact-enforce-btn" disabled={saving}
        onClick={save}>
        {saving ? words.saving : pendingDraft ? words.continueStops : words.saveDraft}
      </button>
    </div>
  );
}

export function SpjPanel() {
  const { lang } = useLanguage();
  const words = copy[lang] || copy.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pendingAction, setPendingAction] = useState("");
  const [open, setOpen] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [evidenceError, setEvidenceError] = useState(null);
  const [evidenceLoading, setEvidenceLoading] = useState(null);

  const load = useCallback(async () => {
    try {
      const body = await request("/spj");
      setItems(body.spj || []);
      setListError(null);
    } catch (err) {
      setListError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  const toggleOpen = (spjId) => {
    if (open === spjId) { setOpen(null); return; }
    setOpen(spjId);
    setEvidence(null);
    setEvidenceError(null);
    setEvidenceLoading(spjId);
    request(`/spj/${encodeURIComponent(spjId)}/evidence-summary`)
      .then((body) => setEvidence({ spjId, body }))
      .catch((err) => setEvidenceError({ spjId, error: err }))
      .finally(() => setEvidenceLoading((current) => current === spjId ? null : current));
  };

  const act = async (path) => {
    if (pendingAction) return;
    setPendingAction(path);
    setActionError(null);
    try {
      await post(path);
    } catch (err) {
      setActionError(err);
      setPendingAction("");
      return;
    }
    await load();
    if (open) {
      try {
        const body = await request(`/spj/${encodeURIComponent(open)}/evidence-summary`);
        setEvidence({ spjId: open, body });
        setEvidenceError(null);
      } catch (err) {
        setEvidenceError({ spjId: open, error: err });
      }
    }
    setPendingAction("");
  };

  const statusPill = {
    draft: "pill", aktif: "pill success", selesai: "pill live", batal: "pill danger",
  };

  return (
    <div className="panel-card spj-panel">
      <div className="panel-head">
        <h3>{words.title}</h3>
        <span className="pill">{items.length} SPJ</span>
      </div>
      <SpjCreateForm onCreated={load} />
      {actionError && <p className="spj-form-error" role="alert">{errorMessage(actionError, words.actionFailed, words)}</p>}
      {listError && <p className="spj-form-error" role="alert">
        {errorMessage(listError, words.listFailed, words)}{" "}
        <button type="button" onClick={load}>{words.retry}</button>
      </p>}
      {loading ? <p role="status">{words.loading}</p> : items.length === 0 && !listError ?
        <p>{words.empty}</p> : (
        <div className="table-wrap" role="region" aria-label={words.tableLabel} tabIndex={0}>
        <table className="spj-table">
          <thead>
            <tr>
              <th>{words.number}</th><th>{words.driver}</th><th>{words.truck}</th><th>{words.destinationColumn}</th>
              <th>{words.progress}</th><th>{words.status}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => {
              const stops = s.stops || [];
              const done = stops.filter((x) => x.status === "completed").length;
              const expanded = open === s.spj_id;
              const base = `/spj/${encodeURIComponent(s.spj_id)}`;
              return (
                <Fragment key={s.spj_id}>
                  <tr className="spj-row">
                    <td>
                      <button type="button" aria-expanded={expanded}
                        aria-controls={`spj-detail-${s.spj_id}`}
                        aria-label={`${expanded ? words.hideDetails : words.showDetails} ${s.spj_number}`}
                        onClick={() => toggleOpen(s.spj_id)}>{s.spj_number}</button>
                      {s.priority === "vip" && <> · {words.vip}</>}
                    </td>
                    <td>{s.driver_name}</td>
                    <td>{s.truck_code}</td>
                    <td>{s.destination}</td>
                    <td>{done}/{stops.length}</td>
                    <td><span className={statusPill[s.status] || "pill"}>
                      {words[s.status] || words.unknown}</span></td>
                  </tr>
                  {expanded && (
                    <tr className="spj-detail" id={`spj-detail-${s.spj_id}`}>
                      <td colSpan={6}>
                        <ol>
                          {stops.map((stop, i) => (
                            <li key={i}>
                              {stop.name} — {stop.kecamatan} · {words[stop.status] || words.unknown}{" "}
                              {stop.status !== "completed" && s.status === "aktif" && (
                                <button type="button" className="compact-enforce-btn"
                                  disabled={!!pendingAction}
                                  onClick={() => act(`${base}/stops/${i}/complete`)}>
                                  {words.stopComplete}
                                </button>
                              )}
                            </li>
                          ))}
                        </ol>
                        {evidenceLoading === s.spj_id && <p role="status">{words.evidenceLoading}</p>}
                        {evidenceError?.spjId === s.spj_id && <p className="spj-form-error" role="alert">
                          {errorMessage(evidenceError.error, words.evidenceFailed, words)}
                        </p>}
                        {evidence?.spjId === s.spj_id && (
                          evidence.body.stops.some((st) => st.has_arrival || st.weighing_count > 0 || st.officer_name) ?
                            <ul className="spj-evidence">
                              {evidence.body.stops.map((st) => (
                                (st.has_arrival || st.weighing_count > 0 || st.officer_name) && (
                                  <li key={st.index}>
                                    <strong>{st.name}:</strong>{" "}
                                    {st.has_arrival && `${words.arrival}; `}
                                    {st.weighing_count > 0 &&
                                      `${words.weighing}: ${st.weighing_count} ${words.photos}, ${st.total_weight_kg} kg (${Object.entries(st.fractions || {}).map(([f, kg]) => `${f} ${kg} kg`).join(", ")}); `}
                                    {st.officer_name && `${words.officer}: ${st.officer_name}`}
                                  </li>
                                )
                              ))}
                            </ul> : <p>{words.evidenceEmpty}</p>
                        )}
                        {s.status === "draft" && (
                          <button type="button" className="compact-enforce-btn" disabled={!!pendingAction}
                            onClick={() => act(`${base}/activate`)}>{words.activate}</button>
                        )}
                        {s.status === "aktif" && (
                          <button type="button" className="compact-enforce-btn" disabled={!!pendingAction}
                            onClick={() => act(`${base}/complete`)}>{words.complete}</button>
                        )}
                        {["draft", "aktif"].includes(s.status) && (
                          <button type="button" className="compact-enforce-btn" disabled={!!pendingAction}
                            onClick={() => act(`${base}/cancel`)}>{words.cancel}</button>
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
      )}
    </div>
  );
}
