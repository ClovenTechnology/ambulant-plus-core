'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const HEARTBEAT_MS = 15_000;

function isAuthPath(pathname: string) {
  return pathname === '/auth/signin' || pathname === '/auth/signup' || pathname.startsWith('/auth/');
}

export function StaffActivityTracker() {
  const pathname = usePathname() || '/';
  const lastTick = useRef(Date.now());
  const currentPath = useRef(pathname);

  useEffect(() => {
    currentPath.current = pathname;
    lastTick.current = Date.now();
    if (isAuthPath(pathname)) return;

    void fetch('/api/admin/staff/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', path: pathname, activeSeconds: 0 }),
      keepalive: true,
    }).catch(() => null);
  }, [pathname]);

  useEffect(() => {
    if (isAuthPath(pathname)) return;

    function activeDelta() {
      const now = Date.now();
      const seconds = document.visibilityState === 'visible' && document.hasFocus()
        ? Math.min(30, Math.max(0, Math.round((now - lastTick.current) / 1000)))
        : 0;
      lastTick.current = now;
      return seconds;
    }

    const timer = window.setInterval(() => {
      void fetch('/api/admin/staff/activity', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'heartbeat', path: currentPath.current, activeSeconds: activeDelta() }),
        keepalive: true,
      }).catch(() => null);
    }, HEARTBEAT_MS);

    const resetClock = () => {
      lastTick.current = Date.now();
    };
    const onVisibility = () => resetClock();
    const onFocus = () => resetClock();
    const onBlur = () => resetClock();

    const onPageHide = () => {
      const body = JSON.stringify({ event: 'leave', path: currentPath.current, activeSeconds: activeDelta() });
      try {
        navigator.sendBeacon('/api/admin/staff/activity', new Blob([body], { type: 'application/json' }));
      } catch {
        // Best-effort telemetry must never block navigation.
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname]);

  return null;
}
