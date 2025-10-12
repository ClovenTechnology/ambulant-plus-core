'use client';
import React, { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';
type ToastItem = { id: string; message: string; type?: ToastType; timeout?: number };

let pushToast: ((t: Omit<ToastItem, 'id'>) => void) | null = null;

/** Call from anywhere in client code */
export function toast(message: string, opts?: { type?: ToastType; timeout?: number }) {
  if (pushToast) pushToast({ message, ...opts });
  // no-op if host not mounted yet
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = ({ message, type, timeout }) => {
      const id = Math.random().toString(36).slice(2);
      const item: ToastItem = { id, message, type, timeout: timeout ?? 3000 };
      setToasts((prev) => [...prev, item]);
      if (item.timeout && item.timeout > 0) {
        const t = setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== id));
        }, item.timeout);
        return () => clearTimeout(t);
      }
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div className="fixed right-4 bottom-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'px-3 py-2 rounded-md shadow border text-sm bg-white',
            t.type === 'success' ? 'border-green-300' : '',
            t.type === 'error' ? 'border-red-300' : '',
            (!t.type || t.type === 'info') ? 'border-gray-200' : ''
          ].join(' ')}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
