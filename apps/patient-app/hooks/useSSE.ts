// apps/patient-app/hooks/useSSE.ts
import { useEffect, useRef, useState } from 'react';

export function useSSE(url = '/api/careport/track/stream') {
  const esRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // small event registry
  const handlersRef = useRef<Record<string, (ev:any)=>void>>({});

  useEffect(() => {
    let backoff = 500;
    let reconnectTimer: number | null = null;
    let mounted = true;

    function attach(es: EventSource) {
      es.onopen = () => {
        if (!mounted) return;
        backoff = 500;
        setConnected(true);
        setError(null);
      };
      es.onerror = () => {
        if (!mounted) return;
        setConnected(false);
        setError('SSE error — reconnecting');
        try { es.close(); } catch {}
        esRef.current = null;
        reconnectTimer = window.setTimeout(connect, backoff);
        backoff = Math.min(30_000, Math.round(backoff * 1.8));
      };

      // named events registered from handlersRef
      es.addEventListener('open', () => {});
      for (const name of Object.keys(handlersRef.current)) {
        es.addEventListener(name, handlersRef.current[name] as EventListener);
      }
      es.addEventListener('message', (ev) => {
        // fallback raw message handler if needed
        const handler = handlersRef.current['message'];
        if (handler) handler(ev);
      });
    }

    function connect() {
      try {
        const es = new EventSource(url);
        esRef.current = es;
        attach(es);
      } catch (err) {
        setConnected(false);
        setError(String(err));
        reconnectTimer = window.setTimeout(connect, backoff);
      }
    }

    connect();
    return () => {
      mounted = false;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try { esRef.current?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function on(name: string, handler: (ev:any)=>void) {
    handlersRef.current[name] = handler;
    // if connected now, attach to EventSource
    if (esRef.current) {
      esRef.current.addEventListener(name, handler as EventListener);
    }
    return () => {
      delete handlersRef.current[name];
      if (esRef.current) esRef.current.removeEventListener(name, handler as EventListener);
    };
  }

  return { connected, error, on };
}
