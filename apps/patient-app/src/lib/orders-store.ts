// apps/patient-app/src/lib/orders-store.ts
export type OrderRx = { id: string; drug: string; sig: string; ts?: string };

function lsKey(encId: string) { return `ambulant.orders.${encId}`; }

export function getOrdersFromLocal(encId: string): OrderRx[] {
  try {
    const raw = localStorage.getItem(lsKey(encId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

export function saveOrdersToLocal(encId: string, items: OrderRx[]) {
  try { localStorage.setItem(lsKey(encId), JSON.stringify(items)); } catch {}
}

export async function fetchOrdersFromApi(encId: string): Promise<OrderRx[]> {
  try {
    const r = await fetch(`/api/orders?encounterId=${encodeURIComponent(encId)}`, { cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

export async function getLastRx(encId: string): Promise<OrderRx | null> {
  const local = getOrdersFromLocal(encId);
  if (local.length > 0) return local[local.length - 1] ?? null;
  const api = await fetchOrdersFromApi(encId);
  if (api.length > 0) return api[api.length - 1] ?? null;
  return null;
}
