// apps/patient-app/components/shop/WalletPayOption.tsx
'use client';

import React from 'react';
import { useWalletBalance } from './useWalletBalance';

function fmt(n: number) {
  const s = Math.round(n).toString();
  return `R${s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

export default function WalletPayOption(props: {
  totalZar: number;
  paymentMethod: 'card' | 'wallet';
  onChange: (m: 'card' | 'wallet') => void;
}) {
  const { totalZar, paymentMethod, onChange } = props;
  const w = useWalletBalance();

  const enough = (w.availableZar ?? 0) >= totalZar;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name="paymethod"
          checked={paymentMethod === 'wallet'}
          onChange={() => onChange('wallet')}
          disabled={w.loading || !enough}
          className="mt-1"
        />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-900">Pay with wallet credit</div>
          <div className="mt-1 text-xs text-slate-600">
            Available: {w.loading ? '…' : fmt(w.availableZar)} {w.error ? '· wallet unavailable' : ''}
          </div>
          {!w.loading && !enough ? (
            <div className="mt-2 text-xs text-rose-700">
              Not enough credit for this order ({fmt(totalZar)}). Choose card or add credit.
            </div>
          ) : null}
        </div>
        <div className="text-xs text-slate-500">{fmt(totalZar)}</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('card')}
          className={`rounded-xl px-3 py-2 text-xs border ${
            paymentMethod === 'card' ? 'border-slate-900 text-slate-900' : 'border-slate-200 text-slate-600'
          }`}
        >
          Use card
        </button>
        <button
          type="button"
          onClick={() => onChange('wallet')}
          disabled={w.loading || !enough}
          className={`rounded-xl px-3 py-2 text-xs ${
            paymentMethod === 'wallet' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
          } disabled:opacity-50`}
        >
          Use wallet
        </button>
      </div>
    </div>
  );
}
