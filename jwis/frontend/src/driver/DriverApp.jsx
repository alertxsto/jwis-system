import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  PackageCheck,
  Route,
  Scale,
  ShieldCheck,
  Truck,
  User,
  WifiOff,
} from "lucide-react";
import "./driver.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001/api";

const PRETRIP_ITEMS = [
  ["rem", "Rem"],
  ["mesin", "Mesin"],
  ["ban", "Ban dan roda"],
  ["bbm", "BBM"],
  ["oli", "Oli"],
  ["bak_compactor", "Bak/Compactor"],
  ["lampu", "Lampu & Kelistrikan"],
];
const FRACTIONS = ["Residu", "Organik", "Anorganik"];
const BERAT_COMPONENTS = new Set(["rem", "mesin", "ban"]);

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("Foto maksimal 5 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, b64: reader.result });
    reader.onerror = () => reject(new Error("Gagal membaca foto"));
    reader.readAsDataURL(file);
  });
}

function getPosition(stop) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: stop.lat, lng: stop.lng, approx: true });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: stop.lat, lng: stop.lng, approx: true }),
      { timeout: 5000 },
    );
  });
}

async function post(path, data) {
  const token = localStorage.getItem("jwis_token");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Gagal (${res.status})`);
  }
  return res.json();
}

function receiptDoneFor(spjId) {
  try {
    return localStorage.getItem(`jwis_receipt_${spjId}`) === "done";
  } catch {
    return false;
  }
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="driver-toast" role="status">
      <Check size={16} /> {message}
    </div>
  );
}

// ── Pre-trip inspection ───────────────────────────────────────────────────────

function PreTripForm({ driver, done, onDone, say }) {
  const [items, setItems] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const answered = Object.keys(items).length;
  const failures = PRETRIP_ITEMS.filter(([key]) => items[key] === false);
  const canSubmit =
    answered === PRETRIP_ITEMS.length &&
    (failures.length === 0 || note.trim().length > 0);

  const markRestOk = () => {
    setItems((prev) => {
      const next = { ...prev };
      PRETRIP_ITEMS.forEach(([key]) => {
        if (!(key in next)) next[key] = true;
      });
      return next;
    });
  };

  const submit = async () => {
    setBusy(true);
    let pretripSaved = false;
    try {
      await post("/pretrip", {
        truck_code: driver.truck_code,
        driver_name: driver.driver_name,
        items,
        note,
      });
      pretripSaved = true;
      // A TIDAK item auto-creates a damage report (source: pretrip).
      for (const [key, label] of failures) {
        await post("/damage-reports", {
          truck_code: driver.truck_code,
          driver_name: driver.driver_name,
          component: key,
          severity: BERAT_COMPONENTS.has(key) ? "berat" : "ringan",
          note: note.trim() || `TIDAK saat pretrip: ${label}`,
          source: "pretrip",
        });
      }
      onDone();
    } catch (err) {
      if (pretripSaved) {
        onDone();
        say("Inspeksi tersimpan, tetapi laporan kerusakan gagal terkirim — laporkan ke admin.");
      } else {
        say(err.message || "Gagal menyimpan inspeksi");
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="driver-card" data-testid="pretrip-done">
        <div className="driver-card-head">
          <h2>
            <ClipboardCheck size={18} /> Inspeksi pra-jalan
          </h2>
          <span className="driver-badge done">SELESAI</span>
        </div>
        <p className="driver-muted">
          Inspeksi hari ini sudah tercatat. Lanjutkan tugas Anda.
        </p>
      </section>
    );
  }

  return (
    <section className="driver-card" data-testid="pretrip-form">
      <div className="driver-card-head">
        <h2>
          <ClipboardCheck size={18} /> Inspeksi pra-jalan
        </h2>
        <span className="driver-badge">
          {answered}/{PRETRIP_ITEMS.length}
        </span>
      </div>
      <div className="driver-progress" aria-hidden="true">
        <div
          className="driver-progress-fill"
          style={{ width: `${(answered / PRETRIP_ITEMS.length) * 100}%` }}
        />
      </div>
      <ul className="pretrip-list">
        {PRETRIP_ITEMS.map(([key, label]) => (
          <li key={key} className="pretrip-item">
            <span>{label}</span>
            <div className="pretrip-choices">
              <button
                type="button"
                data-testid={`ok-${key}`}
                className={`pretrip-choice ok ${items[key] === true ? "active" : ""}`}
                onClick={() => setItems((p) => ({ ...p, [key]: true }))}
              >
                OK
              </button>
              <button
                type="button"
                data-testid={`tidak-${key}`}
                className={`pretrip-choice tidak ${items[key] === false ? "active" : ""}`}
                onClick={() => setItems((p) => ({ ...p, [key]: false }))}
              >
                TIDAK
              </button>
            </div>
          </li>
        ))}
      </ul>
      {failures.length > 0 && (
        <>
          <label className="driver-label" htmlFor="pretrip-note">
            Catatan (wajib bila ada item TIDAK)
          </label>
          <textarea
            id="pretrip-note"
            className="driver-input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Jelaskan kondisi item yang bermasalah"
          />
        </>
      )}
      <div className="driver-actions">
        <button
          type="button"
          className="driver-btn ghost"
          onClick={markRestOk}
          disabled={answered === PRETRIP_ITEMS.length}
        >
          Tandai Sisanya Baik
        </button>
        <button
          type="button"
          className="driver-btn primary"
          onClick={submit}
          disabled={!canSubmit || busy}
        >
          <Check size={16} /> Simpan Inspeksi
        </button>
      </div>
    </section>
  );
}

// ── Stop evidence (arrival → weighing → officer) ──────────────────────────────

function StopCard({ spj, stop, index, current, locked, onCompleted, say }) {
  const [open, setOpen] = useState(false);
  const [arrival, setArrival] = useState(null);
  const [weighPhoto, setWeighPhoto] = useState(null);
  const [weighing, setWeighing] = useState([]);
  const [fraction, setFraction] = useState(FRACTIONS[0]);
  const [weight, setWeight] = useState("");
  const [officerPhoto, setOfficerPhoto] = useState(null);
  const [officerName, setOfficerName] = useState("");
  const [busy, setBusy] = useState(false);

  const completed = stop.status === "completed";

  const step = useMemo(() => {
    if (!arrival) return 1;
    if (weighing.length === 0) return 2;
    return 3;
  }, [arrival, weighing]);

  const handlePhoto = async (file, setter) => {
    if (!file) return;
    try {
      setter(await readPhoto(file));
    } catch (err) {
      say(err.message);
    }
  };

  const addWeighing = () => {
    const kg = parseFloat(weight);
    if (!weighPhoto) {
      say("Foto timbang belum ada");
      return;
    }
    if (!Number.isFinite(kg) || kg <= 0) {
      say("Isi berat timbangan (kg)");
      return;
    }
    setWeighing((prev) => [
      ...prev,
      { fraction, weight_kg: kg, photo_name: weighPhoto.name, photo_b64: weighPhoto.b64 },
    ]);
    setWeighPhoto(null);
    setWeight("");
  };

  const submit = async () => {
    setBusy(true);
    try {
      const pos = await getPosition(stop);
      const evidence = {
        arrival: {
          photo_name: arrival.name,
          photo_b64: arrival.b64,
          lat: pos.lat,
          lng: pos.lng,
          approx: Boolean(pos.approx),
        },
        weighing,
        officer: { name: officerName.trim(), photo_name: officerPhoto.name, photo_b64: officerPhoto.b64 },
      };
      await post(`/spj/${spj.spj_id}/stops/${index}/complete`, { evidence });
      onCompleted();
    } catch (err) {
      say(err.message || "Gagal menyelesaikan titik");
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    arrival && weighing.length > 0 && officerPhoto && officerName.trim().length > 0;

  return (
    <article
      className={`driver-card stop-card ${completed ? "completed" : ""} ${locked ? "locked" : ""}`}
      data-testid={`stop-${index}`}
    >
      <div className="driver-card-head">
        <h2>
          <MapPin size={18} /> Titik {index + 1}: {stop.name}
        </h2>
        {completed && <span className="driver-badge done">SELESAI</span>}
      </div>
      <p className="driver-muted">
        {stop.kecamatan} — {stop.address}
      </p>

      {completed && (
        <ul className="step-list">
          {["Kedatangan", "Timbang Residu", "Petugas"].map((label) => (
            <li key={label} className="step done">
              <CheckCircle2 size={15} /> {label}
            </li>
          ))}
        </ul>
      )}

      {locked && !completed && (
        <p className="driver-muted">Selesaikan titik sebelumnya dulu.</p>
      )}

      {current && !completed && !open && (
        <div className="driver-actions">
          <button type="button" className="driver-btn primary" onClick={() => setOpen(true)}>
            <Camera size={16} /> Mulai Titik Ini
          </button>
        </div>
      )}

      {current && !completed && open && (
        <div className="stop-form">
          <ol className="step-list">
            {["Kedatangan", "Timbang Residu", "Petugas"].map((label, i) => (
              <li
                key={label}
                className={`step ${step > i + 1 ? "done" : step === i + 1 ? "current" : ""}`}
              >
                {step > i + 1 ? <CheckCircle2 size={15} /> : <span className="step-num">{i + 1}</span>}
                {label}
              </li>
            ))}
          </ol>

          {/* Step 1: arrival photo */}
          <label className="driver-label" htmlFor={`arrival-${index}`}>
            Foto kedatangan di lokasi
          </label>
          <input
            id={`arrival-${index}`}
            data-testid="arrival-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="driver-file"
            onChange={(e) => handlePhoto(e.target.files?.[0], setArrival)}
          />
          {arrival && <p className="driver-muted">Foto terlampir: {arrival.name}</p>}

          {/* Step 2: weighing */}
          {step >= 2 && (
            <>
              <label className="driver-label" htmlFor={`weigh-${index}`}>
                Foto timbang residu
              </label>
              <input
                id={`weigh-${index}`}
                data-testid="weigh-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="driver-file"
                onChange={(e) => handlePhoto(e.target.files?.[0], setWeighPhoto)}
              />
              <div className="driver-row">
                <div>
                  <label className="driver-label" htmlFor={`fraction-${index}`}>
                    Fraksi
                  </label>
                  <select
                    id={`fraction-${index}`}
                    className="driver-input"
                    value={fraction}
                    onChange={(e) => setFraction(e.target.value)}
                  >
                    {FRACTIONS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="driver-label" htmlFor={`weight-${index}`}>
                    Berat (kg)
                  </label>
                  <input
                    id={`weight-${index}`}
                    className="driver-input"
                    type="number"
                    min="0"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="driver-actions">
                <button type="button" className="driver-btn ghost" onClick={addWeighing}>
                  <Scale size={16} /> Tambah Timbangan
                </button>
              </div>
              {weighing.length > 0 && (
                <ul className="weigh-list">
                  {weighing.map((w, i) => (
                    <li key={i}>
                      {w.fraction} — {w.weight_kg} kg
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Step 3: officer */}
          {step >= 3 && (
            <>
              <label className="driver-label" htmlFor={`officer-${index}`}>
                Foto petugas penerima
              </label>
              <input
                id={`officer-${index}`}
                data-testid="officer-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="driver-file"
                onChange={(e) => handlePhoto(e.target.files?.[0], setOfficerPhoto)}
              />
              <label className="driver-label" htmlFor={`officer-name-${index}`}>
                Nama Petugas
              </label>
              <input
                id={`officer-name-${index}`}
                className="driver-input"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="Nama petugas di lokasi"
              />
              <div className="driver-actions">
                <button
                  type="button"
                  className="driver-btn primary"
                  onClick={submit}
                  disabled={!canSubmit || busy}
                >
                  <Check size={16} /> Selesaikan Titik
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

// ── Delivery / receipt ────────────────────────────────────────────────────────

function DeliveryCard({ spj, say, onDone }) {
  const [receipt, setReceipt] = useState(null);
  const [totalWeight, setTotalWeight] = useState("");
  const [busy, setBusy] = useState(false);

  const handlePhoto = async (file) => {
    if (!file) return;
    try {
      setReceipt(await readPhoto(file));
    } catch (err) {
      say(err.message);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const kg = parseFloat(totalWeight);
      await post(`/spj/${spj.spj_id}/receipt`, {
        photo_name: receipt.name,
        photo_b64: receipt.b64,
        total_weight_kg: Number.isFinite(kg) ? kg : null,
      });
      try {
        localStorage.setItem(`jwis_receipt_${spj.spj_id}`, "done");
      } catch { /* flag is best-effort; receipt is already recorded server-side */ }
      onDone();
    } catch (err) {
      say(err.message || "Gagal mengirim struk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="driver-card" data-testid="delivery-card">
      <div className="driver-card-head">
        <h2>
          <PackageCheck size={18} /> Bukti serah terima
        </h2>
      </div>
      <p className="driver-muted">
        Semua titik selesai. Unggah foto struk timbang dari {spj.destination}.
      </p>
      <label className="driver-label" htmlFor="receipt-photo">
        Foto struk
      </label>
      <input
        id="receipt-photo"
        data-testid="receipt-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="driver-file"
        onChange={(e) => handlePhoto(e.target.files?.[0])}
      />
      {receipt && <p className="driver-muted">Struk terlampir: {receipt.name}</p>}
      <label className="driver-label" htmlFor="receipt-weight">
        Total berat (kg, opsional)
      </label>
      <input
        id="receipt-weight"
        className="driver-input"
        type="number"
        min="0"
        step="0.1"
        value={totalWeight}
        onChange={(e) => setTotalWeight(e.target.value)}
        placeholder="0"
      />
      <div className="driver-actions">
        <button
          type="button"
          className="driver-btn primary"
          onClick={submit}
          disabled={!receipt || busy}
        >
          <Check size={16} /> Kirim Struk
        </button>
      </div>
    </section>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function DriverApp() {
  const [driver, setDriver] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("jwis_driver"));
    } catch {
      return null;
    }
  });
  const [fleet, setFleet] = useState([]);
  const [spjAktif, setSpjAktif] = useState(null);
  const [history, setHistory] = useState([]);
  const [pretripDone, setPretripDone] = useState(false);
  const [screen, setScreen] = useState("gate");
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [doneScreen, setDoneScreen] = useState(false);

  const say = (msg, ms = 4000) => {
    setToast(msg);
    setTimeout(() => setToast(""), ms);
  };

  useEffect(() => {
    fetch(`${API_URL}/fleet`)
      .then((r) => r.json())
      .then((body) => setFleet(Array.isArray(body) ? body : body.trucks || []))
      .catch(() => setOnline(false));
  }, []);

  const drivers = useMemo(
    () =>
      [...fleet]
        .map((t) => ({ name: t.driver_name, code: t.truck_code }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [fleet],
  );

  const loadSpj = useCallback(() => {
    if (!driver) return;
    fetch(`${API_URL}/spj?status=aktif`)
      .then((r) => r.json())
      .then((body) => {
        const mine = (body.spj || []).find((s) => s.truck_code === driver.truck_code);
        setSpjAktif(mine || null);
        setOnline(true);
      })
      .catch(() => setOnline(false));
    fetch(`${API_URL}/spj?status=selesai`)
      .then((r) => r.json())
      .then((body) =>
        setHistory((body.spj || []).filter((s) => s.truck_code === driver.truck_code)),
      )
      .catch(() => {});
  }, [driver]);

  useEffect(() => {
    loadSpj();
    const id = setInterval(loadSpj, 8000);
    return () => clearInterval(id);
  }, [loadSpj]);

  useEffect(() => {
    if (!driver) return;
    fetch(`${API_URL}/pretrip/today/${driver.truck_code}`)
      .then((r) => r.json())
      .then((body) => setPretripDone(Boolean(body.done)))
      .catch(() => {});
  }, [driver]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    setScreen(driver ? "home" : "gate");
  }, [driver]);

  const pickDriver = (d) => {
    localStorage.setItem(
      "jwis_driver",
      JSON.stringify({ driver_name: d.name, truck_code: d.code }),
    );
    setDriver({ driver_name: d.name, truck_code: d.code });
  };

  const switchDriver = () => {
    localStorage.removeItem("jwis_driver");
    setDriver(null);
    setSpjAktif(null);
    setHistory([]);
    setDoneScreen(false);
  };

  // ── Gate ──
  if (screen === "gate" || !driver) {
    return (
      <main className="driver-shell" data-testid="driver-app">
        <header className="driver-header">
          <span className="driver-brand">
            <span className="driver-brand-mark">
              <Truck size={19} />
            </span>
            <span>
              <strong>JWIS Driver</strong>
              <small>PWA Sopir</small>
            </span>
          </span>
          {!online && (
            <span className="driver-offline">
              <WifiOff size={14} /> Offline
            </span>
          )}
        </header>
        <section className="driver-card">
          <h2>
            <User size={18} /> Siapa yang bertugas?
          </h2>
          <ul className="driver-pick-list">
            {drivers.map((d) => (
              <li key={d.code} data-testid={`pick-${d.code}`}>
                <button type="button" className="driver-pick" onClick={() => pickDriver(d)}>
                  <span>
                    <strong>{d.name}</strong>
                    <small>{d.code}</small>
                  </span>
                  <Truck size={16} />
                </button>
              </li>
            ))}
            {drivers.length === 0 && (
              <li className="driver-muted">Memuat daftar armada…</li>
            )}
          </ul>
        </section>
        <Toast message={toast} />
      </main>
    );
  }

  const stops = spjAktif?.stops || [];
  const pendingIndex = stops.findIndex((s) => s.status !== "completed");
  const allStopsDone = spjAktif && pendingIndex === -1 && stops.length > 0;

  return (
    <main className="driver-shell" data-testid="driver-app">
      <header className="driver-header">
        <span className="driver-brand">
          <span className="driver-brand-mark">
            <Route size={19} />
          </span>
          <span>
            <strong>JWIS Driver</strong>
            <small>{driver.truck_code}</small>
          </span>
        </span>
        <span className="driver-header-right">
          {!online && (
            <span className="driver-offline">
              <WifiOff size={14} /> Offline
            </span>
          )}
          <button type="button" className="driver-link" onClick={switchDriver}>
            Ganti
          </button>
        </span>
      </header>

      <section className="driver-card driver-identity">
        <p className="driver-kicker">Selamat bertugas</p>
        <h1>{driver.driver_name}</h1>
        <p className="driver-muted">
          {driver.truck_code}
          {spjAktif ? ` — ${spjAktif.spj_number} → ${spjAktif.destination}` : " — belum ada SPJ aktif"}
        </p>
      </section>

      {doneScreen ? (
        <section className="driver-card driver-done" data-testid="done-screen">
          <ShieldCheck size={40} />
          <h1>Tugas selesai</h1>
          <p className="driver-muted">
            Bukti serah terima sudah tercatat. Terima kasih!
          </p>
          <button
            type="button"
            className="driver-btn ghost"
            onClick={() => setDoneScreen(false)}
          >
            <ArrowLeft size={16} /> Kembali
          </button>
        </section>
      ) : (
        <>
          <PreTripForm
            driver={driver}
            done={pretripDone}
            onDone={() => {
              setPretripDone(true);
              say("Inspeksi tersimpan");
            }}
            say={say}
          />

          {spjAktif &&
            stops.map((stop, i) => (
              <StopCard
                key={i}
                spj={spjAktif}
                stop={stop}
                index={i}
                current={i === pendingIndex}
                locked={pendingIndex !== -1 && i > pendingIndex}
                onCompleted={() => {
                  loadSpj();
                  say("Titik diselesaikan");
                }}
                say={say}
              />
            ))}

          {allStopsDone && (
            <DeliveryCard
              spj={spjAktif}
              say={say}
              onDone={() => {
                setDoneScreen(true);
                loadSpj();
              }}
            />
          )}

          {!spjAktif && history[0] && !receiptDoneFor(history[0].spj_id) && (
            <DeliveryCard
              spj={history[0]}
              say={say}
              onDone={() => {
                setDoneScreen(true);
                loadSpj();
              }}
            />
          )}

          {!spjAktif && (
            <section className="driver-card">
              <p className="driver-muted">
                Belum ada SPJ aktif untuk truk Anda. Hubungi pengawas bila sudah ada
                perintah jalan.
              </p>
            </section>
          )}

          {history.length > 0 && !doneScreen && (
            <section className="driver-card" data-testid="history-card">
              <h2>
                <ClipboardCheck size={18} /> Riwayat tugas
              </h2>
              <ul className="history-list">
                {history.slice(0, 5).map((s) => (
                  <li key={s.spj_id}>
                    <span>
                      <strong>{s.spj_number}</strong>
                      <small>
                        {s.date} — {s.destination}
                      </small>
                    </span>
                    <span className="driver-badge done">selesai</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Toast message={toast} />
    </main>
  );
}
