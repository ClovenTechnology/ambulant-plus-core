// apps/patient-app/components/plan/RedeemCodeModal.tsx
'use client';

import React, { useMemo, useState } from 'react';

type RedeemResp =
  | {
      ok: true;
      effect: 'upgraded' | 'credit_saved';
      message: string;
      redeemed?: { code?: string; valueZar?: number; plan?: string };
      allowShopSpend?: boolean;
    }
  | { ok: false; error?: string };

function clientUid() {
  try {
    return localStorage.getItem('ambulant.uid') || localStorage.getItem('x-uid') || 'demo-patient';
  } catch {
    return 'demo-patient';
  }
}

export default function RedeemCodeModal(props: {
  open: boolean;
  onClose: () => void;
  onRedeemed: (r: { effect: 'upgraded' | 'credit_saved'; message: string }) => void;
}) {
  const { open, onClose, onRedeemed } = props;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => !busy && code.trim().length >= 6, [busy, code]);

  async function submit() {
    setErr(null);
    setBusy(true);

    const uid = clientUid();

    const r = await fetch('/api/plan/redeem', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-uid': uid },
      body: JSON.stringify({ code: code.trim() }),
    }).catch(() => null);

    const data = (await r?.json().catch(() => null)) as RedeemResp | null;

    if (!r?.ok || !data || data.ok !== true) {
      setErr((data as any)?.error || 'That code didn’t work. Check it and try again.');
      setBusy(false);
      return;
    }

    onRedeemed({ effect: data.effect, message: data.message });
    setBusy(false);
    setCode('');
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-[0_20px_80px_rgba(2,6,23,0.25)]">
          <div className="p-6">
            <div className="text-lg font-semibold tracking-tight text-slate-900">Redeem a code</div>
            <div className="mt-1 text-sm text-slate-600">
              Redeem a promo/gift code. If it’s plan-intent, we’ll upgrade you (or save credit if you’re already above it).
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold text-slate-600">Code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. AMB-ABCD-EFGH-IJKL"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-300"
                autoFocus
              />
              {err ? <div className="mt-3 text-sm text-rose-700">{err}</div> : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm bg-white hover:bg-slate-50 border border-slate-200 text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="rounded-xl px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Checking…' : 'Redeem'}
              </button>
            </div>

            <div className="mt-4 text-[11px] text-slate-500">
              Tip: wallet credit can be spent on Shop, Plan upgrades, and Appointments (when enabled).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
