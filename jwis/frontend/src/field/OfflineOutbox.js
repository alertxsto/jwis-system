// OfflineOutbox: queues field confirmations in localStorage when offline and
// replays them when connectivity returns. Keeps the field workflow auditable
// even without a live connection (Task 7 offline requirement).
const KEY = "jwis_field_outbox";

export function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function writeOutbox(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueue(entry) {
  const items = readOutbox();
  items.push({ ...entry, queued_at: new Date().toISOString() });
  writeOutbox(items);
  return items.length;
}

export async function flushOutbox(apiUrl) {
  const items = readOutbox();
  if (items.length === 0) return { flushed: 0, remaining: 0 };
  const remaining = [];
  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(`${apiUrl}/dispatch/${item.dispatchId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: item.status, note: item.note }),
      });
      if (!res.ok) throw new Error("send failed");
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }
  writeOutbox(remaining);
  return { flushed, remaining: remaining.length };
}
