'use client';

import { useMemo, useState } from 'react';
import { Card, Tabs, Collapse, Skeleton } from '@/components/ui';
import HealthMonitorPanel from '@/components/HealthMonitorPanel';
import StethoscopePanel from '@/components/StethoscopePanel';
import OtoscopePanel from '@/components/OtoscopePanel';
import DeviceDock from '@/components/DeviceDock';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

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

  // simple status pill from DeviceDock (reuses its connection context)
  const status = useMemo(() => {
    // Placeholder text — real status can be hoisted from your dock context if available
    return 'Checking devices…';
  }, []);

  return (
    <Card
      title="Integrated IoMTs"
      dense={!!dense}
      gradient
      toolbar={
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 hidden md:inline">{status}</span>
          <CollapseBtn open={open} onClick={() => setOpen((v) => !v)} />
        </div>
      }
    >
      <Collapse open={open}>
        {/* Tabs (moved ABOVE dock) */}
        <div className="mb-2">
          <Tabs<IoTab>
            active={tab}
            onChange={setTab}
            items={[
              { key: 'health', label: 'Health Monitor' },
              { key: 'steth', label: 'Stethoscope' },
              { key: 'oto', label: 'Otoscope' },
            ]}
          />
        </div>

        {/* Panels */}
        <div className="min-h-[96px] mb-3">
          {tab === 'health' && (
            <div className="space-y-2">
              <HealthMonitorPanel roomId={roomId} />
            </div>
          )}
          {tab === 'steth' && (
            <div className="space-y-2">
              <StethoscopePanel roomId={roomId} />
            </div>
          )}
          {tab === 'oto' && (
            <div className="space-y-2">
              <OtoscopePanel roomId={roomId} />
            </div>
          )}
        </div>

        {/* Device Dock (moved BELOW tabs/panels) */}
        <div className="rounded border bg-white p-2">
          <div className="text-xs text-gray-600 mb-1">Device Dock</div>
          <DeviceDock patientId={patientId} roomId={roomId} />
        </div>
      </Collapse>
    </Card>
  );
}
