// apps/patient-app/components/ToastProvider.tsx
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: string; message: string; type?: 'success' | 'error' | 'info'; timeout?: number };
type ToastContextValue = { showToast: (message: string, opts?: Partial<Toast>) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, opts?: Partial<Toast>) => {
    const id = (Math.random() + 1).toString(36).slice(2, 9);
    const toast: Toast = {
      id,
      message,
      type: opts?.type ?? 'info',
      timeout: opts?.timeout ?? 3000,
    };
    setToasts((s) => [...s, toast]);
    // auto remove
    setTimeout(() => {
      setToasts((s) => s.filter((t) => t.id !== id));
    }, toast.timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed right-4 bottom-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          className={`max-w-sm px-4 py-2 rounded shadow text-sm ${
            t.type === 'success' ? 'bg-emerald-600 text-white' : t.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
