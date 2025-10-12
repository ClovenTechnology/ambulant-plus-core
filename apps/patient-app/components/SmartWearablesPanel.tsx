'use client';

import { useState } from 'react';
import NexRingPanel from '@/components/NexRingPanel';

type WTab = 'wearables' | 'pillow';

export default function SmartWearablesPanel({
  roomId,
  dense,
  defaultOpen = true,
}: {
  roomId: string;
  dense?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [tab, setTab] = useState<WTab>('wearables');

  return (
    <section className={`border rounded bg-white ${dense ? '' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">Smart Wearables</div>
        <button className="text-xs px-2 py-1 border rounded" onClick={() => setOpen(v=>!v)}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {open && (
        <div className="p-2 space-y-3">
          <div className="flex gap-2 text-xs">
            {([
              { key: 'wearables', label: 'Watches / Rings / Bands' },
              { key: 'pillow',    label: 'Smart Pillows' },
            ] as {key:WTab;label:string}[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2 py-1 rounded border ${tab===t.key ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}
              >{t.label}</button>
            ))}
          </div>

          {tab === 'wearables' && (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">Device: NexRing — <span className="text-emerald-700">Connected</span></div>
              <NexRingPanel roomId={roomId} />
            </div>
          )}

          {tab === 'pillow' && (
            <div className="text-sm text-gray-600">Coming soon: Smart pillow integrations (sleep posture, snore index, breath rate).</div>
          )}
        </div>
      )}
    </section>
  );
}
