// ============================================================================
// apps/patient-app/src/analytics/push.ts
// Client helpers to register Service Worker and subscribe to Web Push.
// ============================================================================
export type PushSubscriptionJSON = {
  endpoint: string; keys: { p256dh: string; auth: string };
};

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function registerServiceWorker(path = '/sw.js'): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register(path);
    return reg;
  } catch {
    return null;
  }
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function subscribePush(reg?: ServiceWorkerRegistration): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) return null;
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) { console.warn('VAPID public key missing'); return null; }

  const registration = reg || await registerServiceWorker();
  if (!registration) return null;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing.toJSON() as any;

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid),
  });
  const json = sub.toJSON() as any;
  // send to server (stubbed)
  try {
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: json }) });
  } catch {}
  return json;
}

export async function unsubscribePush(reg?: ServiceWorkerRegistration) {
  if (!isPushSupported()) return;
  const registration = reg || await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  await sub?.unsubscribe();
  try { await fetch('/api/push/subscribe', { method: 'DELETE' }); } catch {}
}
