'use client';

import { useState } from 'react';
import HealthMonitorPanel from '@/components/HealthMonitorPanel';
import StethoscopePanel from '@/components/StethoscopePanel';
import OtoscopePanel from '@/components/OtoscopePanel';
import DeviceDock from '@/components/DeviceDock';

type IoTab = 'health' | 'steth' | 'oto';

export default function IntegratedIoMTs({
  roomId,
  patientId,
  dense,
  defaultOpen = true,
}: {
  roomId: string;
  patientId: string;
  dense?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [tab, setTab] = useState<IoTab>('health');

  return (
    <section className={`border rounded bg-white ${dense ? '' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50 rounded-t">
        <div className="text-sm font-medium">Integrated IoMTs</div>
        <button className="text-xs px-2 py-1 border rounded" onClick={() => setOpen(v=>!v)}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {open && (
        <div className="p-2 space-y-3">
          <div className="rounded border bg-white p-2">
            <div className="text-xs text-gray-600 mb-1">Device Dock</div>
            <DeviceDock patientId={patientId} roomId={roomId} />
          </div>

          <div className="flex gap-2 text-xs">
            {([
              { key: 'health', label: 'Health Monitor' },
              { key: 'steth', label: 'Stethoscope' },
              { key: 'oto',   label: 'Otoscope' },
            ] as {key:IoTab;label:string}[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-2 py-1 rounded border ${tab===t.key ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}
              >{t.label}</button>
            ))}
          </div>

          {tab === 'health' && <HealthMonitorPanel roomId={roomId} />}
          {tab === 'steth'  && <StethoscopePanel roomId={roomId} />}
          {tab === 'oto'    && <OtoscopePanel roomId={roomId} />}
        </div>
      )}
    </section>
  );
}
