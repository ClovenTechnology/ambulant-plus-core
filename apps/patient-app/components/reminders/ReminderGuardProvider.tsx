'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { toast } from '../toast';

type GuardState = {
  open: boolean;
  message: string;
};

type ReminderGuardContextValue = {
  showTooEarlyAlert: (message: string) => void;
  closeTooEarlyAlert: () => void;
};

const ReminderGuardContext = createContext<ReminderGuardContextValue | null>(null);

export function ReminderGuardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>({
    open: false,
    message: '',
  });

  const showTooEarlyAlert = useCallback((message: string) => {
    setState({ open: true, message });
    toast(message, { type: 'info' });
  }, []);

  const closeTooEarlyAlert = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const value = useMemo(
    () => ({
      showTooEarlyAlert,
      closeTooEarlyAlert,
    }),
    [showTooEarlyAlert, closeTooEarlyAlert]
  );

  return (
    <ReminderGuardContext.Provider value={value}>
      {children}

      {state.open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={closeTooEarlyAlert}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Action blocked"
            className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-lg font-black tracking-tight text-slate-950">
                Action blocked
              </div>
              <div className="mt-1 text-xs text-slate-500">
                This reminder cannot be actioned before its scheduled time.
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {state.message}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeTooEarlyAlert}
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ReminderGuardContext.Provider>
  );
}

export function useReminderGuard() {
  const ctx = useContext(ReminderGuardContext);
  if (!ctx) {
    throw new Error('useReminderGuard must be used inside ReminderGuardProvider');
  }
  return ctx;
}