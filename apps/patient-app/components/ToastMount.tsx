// apps/patient-app/components/ToastMount.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Kind = 'info' | 'success' | 'error';
type ToastItem = { id: string; kind: Kind; text: string; ttl: number };

type Ctx = {
  push: (text: string, kind?: Kind, ttlMs?: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

// --- module-level bridge so `toast()` works anywhere (what Televisit expects)
let latestPush: ((t: string, k?: Kind, ttl?: number) => void) | null = null;

export function toast(text: string, kind: Kind = 'info', ttlMs = 3500) {
  // fall back to alert if provider not mounted (shouldn't happen in app)
  if (latestPush) latestPush(text, kind, ttlMs);
  else try { alert(text); } catch {}
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  return useMemo(() => {
    const fn = (text: string, kind: Kind = 'info', ttlMs = 3500) => ctx?.push(text, kind, ttlMs);
    return Object.assign(fn, {
      info:    (t: string, ttl?: number) => ctx?.push(t, 'info', ttl ?? 3500),
      success: (t: string, ttl?: number) => ctx?.push(t, 'success', ttl ?? 3500),
      error:   (t: string, ttl?: number) => ctx?.push(t, 'error', ttl ?? 4500),
    });
  }, [ctx]);
}

// --- Provider + UI
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, any>>({});

  const push = (text: string, kind: Kind = 'info', ttlMs = 3500) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const item: ToastItem = { id, kind, text, ttl: ttlMs };
    setItems((prev) => [...prev, item]);
    // auto dismiss
    timers.current[id] = setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      delete timers.current[id];
    }, ttlMs);
  };

  // expose to module-level `toast()`
  useEffect(() => {
    latestPush = push;
    return () => { if (latestPush === push) latestPush = null; };
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <Toaster items={items} dismiss={(id) => setItems((prev) => prev.filter((x) => x.id !== id))} />
    </ToastCtx.Provider>
  );
}

function tone(kind: Kind) {
  switch (kind) {
    case 'success': return {
      wrap: 'bg-emerald-600 text-white shadow-lg shadow-emerald-800/10',
      bar:  'bg-emerald-400',
      icon: '✓',
    };
    case 'error': return {
      wrap: 'bg-rose-600 text-white shadow-lg shadow-rose-800/10',
      bar:  'bg-rose-400',
      icon: '!',
    };
    default: return {
      wrap: 'bg-indigo-600 text-white shadow-lg shadow-indigo-800/10',
      bar:  'bg-indigo-400',
      icon: 'i',
    };
  }
}

function Toaster({ items, dismiss }: { items: ToastItem[]; dismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const tTone = tone(t.kind);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className={`pointer-events-auto w-80 overflow-hidden rounded-xl ${tTone.wrap}`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[11px]">{tTone.icon}</div>
                <div className="text-sm leading-5">{t.text}</div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="ml-auto rounded-md px-2 py-1 text-xs/5 hover:bg-white/10"
                >
                  Close
                </button>
              </div>
              <div className={`h-1 w-full ${tTone.bar}`} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
