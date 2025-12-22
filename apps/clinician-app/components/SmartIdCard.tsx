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
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: 'smart-id-reprint',
              name: 'Ambulant+ Smart ID (replacement)',
              unitAmountZar: 120, // adjust in sync with your product catalog
              quantity: 1,
            },
          ],
          successUrl: `${origin}/settings/profile?smartId=reordered`,
          cancelUrl: `${origin}/settings/profile`,
          metadata: {
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
      setError(err?.message || 'Smart ID reorder failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border rounded-lg bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Ambulant+ Smart ID</div>
          <div className="text-xs text-gray-500">
            {hasActiveSmartId ? 'You have an active Smart ID on file.' : 'No Smart ID on file.'}
          </div>
        </div>
        <span className="text-[11px] text-gray-500 font-mono">#{clinicianId}</span>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}

      <button
        type="button"
        onClick={handleReorder}
        disabled={busy}
        className="mt-1 inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : 'Re-order Smart ID'}
      </button>
    </div>
  );
}
