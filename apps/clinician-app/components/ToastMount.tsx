//apps/clinician-app/components/ToastMount.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type ToastKind = 'info' | 'success' | 'warning' | 'error';

type ToastItem = {
  id: string;
  body: string;
  kind: ToastKind;
};

let externalPush: ((body: string, kind?: ToastKind) => void) | null = null;

/**
 * Imperative helper you can import anywhere:
 *   import { toast } from '@/components/ToastMount';
 *   toast('Saved', 'success');
 */
export function toast(body: string, kind: ToastKind = 'info') {
  if (externalPush) {
    externalPush(body, kind);
  } else if (typeof window !== 'undefined') {
    // Fallback if ToastMount isn't mounted yet
    window.alert(body);
  }
}

/**
 * Mount this once (e.g. in app/layout.tsx) so toasts can render.
 */
export function ToastMount() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((body: string, kind: ToastKind = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, body, kind }]);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }
  }, []);

  useEffect(() => {
    externalPush = push;
    return () => {
      externalPush = null;
    };
  }, [push]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <ToastViewport toasts={toasts} />,
    document.body
  );
}

function ToastViewport({ toasts }: { toasts: ToastItem[] }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastBubble key={t.id} kind={t.kind}>
          {t.body}
        </ToastBubble>
      ))}
    </div>
  );
}

function ToastBubble({
  kind,
  children,
}: {
  kind: ToastKind;
  children: ReactNode;
}) {
  const border =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50'
      : kind === 'warning'
      ? 'border-amber-200 bg-amber-50'
      : kind === 'error'
      ? 'border-rose-200 bg-rose-50'
      : 'border-gray-200 bg-white';

  return (
    <div
      className={[
        'min-w-[220px] max-w-[340px] rounded-lg border shadow-sm px-3 py-2 text-sm text-gray-800',
        border,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
