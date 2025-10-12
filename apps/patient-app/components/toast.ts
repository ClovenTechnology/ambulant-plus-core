'use client';

import { createRoot } from 'react-dom/client';
import { nanoid } from 'nanoid';
import React, { useEffect, useState } from 'react';

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

      // auto-remove after 3.5s
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
 * Ensures there is a single toast root mounted in the DOM.
 */
export function mountToasts() {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
    const r = createRoot(root);
    r.render(<ToastContainer />);
  }
}

/**
 * Programmatic toast trigger.
 */
export function toast(msg: string, opts?: ToastOptions) {
  pushToast(msg, opts);
}
