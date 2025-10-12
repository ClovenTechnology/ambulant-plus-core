'use client';

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { nanoid } from 'nanoid';

type ToastOptions = { type?: 'info' | 'success' | 'error' };

export type ToastMessage = {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
};

let pushToast: (msg: string, opts?: ToastOptions) => void = () => {};

function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    pushToast = (msg: string, opts: ToastOptions = {}) => {
      const t: ToastMessage = {
        id: nanoid(),
        text: msg,
        type: opts.type ?? 'info',
      };
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3500);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded shadow text-white text-sm ${
            t.type === 'success'
              ? 'bg-green-600'
              : t.type === 'error'
              ? 'bg-red-600'
              : 'bg-gray-700'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/**
 * Mount once globally (called by ToastMount).
 */
export function mountToasts(): void {
  const existing = document.getElementById('toast-root');
  if (!existing) {
    const el = document.createElement('div');
    el.id = 'toast-root';
    document.body.appendChild(el);
    const root = createRoot(el);
    root.render(<ToastContainer />);
  }
}

/**
 * Trigger toast programmatically.
 */
export function toast(msg: string, opts?: ToastOptions): void {
  pushToast(msg, opts);
}
