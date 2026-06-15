// components/SmartIdCard.tsx
'use client';

import { useState } from 'react';

type SmartIdCardProps = {
  clinicianId: string;
  hasActiveSmartId?: boolean;
};

export function SmartIdCard({ clinicianId, hasActiveSmartId }: SmartIdCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReorder = async () => {
    try {
      setBusy(true);
      setError(null);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await fetch('/api/shop/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-uid': clinicianId,
          'x-role': 'clinician',
        },
        body: JSON.stringify({
          buyerUid: clinicianId,
          items: [
            {
              productId: 'smart-id-reprint',
              name: 'Physical Smart ID replacement (replacement)',
              unitAmountZar: 120, // adjust in sync with your product catalog
              quantity: 1,
            },
          ],
          successUrl: `${origin}/settings/profile?smartId=reordered`,
          cancelUrl: `${origin}/settings/profile`,
          metadata: {
            buyerUid: clinicianId,
            clinicianId,
            kind: 'smart-id',
            variant: 'reprint',
          },
        }),
      });

      const js = await res.json();
      if (!res.ok || !js.checkoutUrl) {
        throw new Error(js.error || 'Could not create checkout session');
      }

      window.location.href = js.checkoutUrl as string;
    } catch (err: any) {
      setError(err?.message || 'Smart ID replacement request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Physical Smart ID replacement</div>
          <div className="text-xs text-gray-500">
            {hasActiveSmartId ? 'Digital Smart ID downloads are available above.' : 'Digital Smart ID becomes available after training completion.'}
          </div>
        </div>
        <span className="text-[11px] text-gray-500 font-mono">#{clinicianId}</span>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button
        type="button"
        onClick={handleReorder}
        disabled={busy}
        className="mt-1 inline-flex items-center px-3 py-1.5 rounded-md text-xs border bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : 'Request paid replacement'}
      </button>
    </div>
  );
}
