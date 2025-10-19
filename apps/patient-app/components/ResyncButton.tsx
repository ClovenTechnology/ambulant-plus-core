// components/ResyncButton.tsx
'use client';

import React, { useState } from 'react';
import { useToast } from './ToastProvider';

export default function ResyncButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const doResync = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/devices/list', { cache: 'no-store' });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `HTTP ${r.status}`);
      }
      await r.json().catch(() => ({}));
      toast.showToast('Resync complete', { type: 'success', timeout: 2000 });

      // Broadcast a global message so other tabs/components (e.g., devices page) can reload.
      try {
        const bc = new BroadcastChannel('ambulant:devices');
        bc.postMessage({ type: 'devices:resync' });
        bc.close();
      } catch (e) {
        // BroadcastChannel may not be supported — fallback to window.postMessage (same-origin)
        try {
          window.postMessage({ channel: 'ambulant:devices', type: 'devices:resync' }, window.location.origin);
        } catch {}
      }
    } catch (e: any) {
      toast.showToast(`Resync failed: ${e?.message || e}`, { type: 'error', timeout: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={doResync}
      disabled={loading}
      className={`${className} flex items-center justify-center disabled:opacity-60`}
    >
      {loading ? 'Resyncing…' : 'Resync'}
    </button>
  );
}
