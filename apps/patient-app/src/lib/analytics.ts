// apps/patient-app/src/lib/analytics.ts
type Props = Record<string, any>;

export function track(event: string, props: Props = {}) {
  try {
    if (typeof window === 'undefined') return; // SSR no-op

    const body = JSON.stringify({
      event,
      props,
      ts: Date.now(),
      path: window.location.pathname,
      ref: document.referrer || null,
      ua: navigator.userAgent,
    });

    // Prefer sendBeacon; fallback to fetch
    const blob = new Blob([body], { type: 'application/json' });
    const ok =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon('/api/analytics', blob);

    if (!ok) {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => void 0);
    }
  } catch {
    // swallow — telemetry must never break UX
  }
}
