'use client';

import { useMemo, useState } from 'react';
import { Card, Tabs, Collapse } from '@/components/ui';
import HealthMonitorPanel from '@/components/HealthMonitorPanel';
import StethoscopePanel from '@/components/StethoscopePanel';
import OtoscopePanel from '@/components/OtoscopePanel';
import DeviceDock from '@/components/DeviceDock';
import { CollapseBtn } from '@/components/ui/CollapseBtn';

type IoTab = 'health' | 'steth' | 'oto';

export default function IntegratedIoMTs({
  roomId,
  patientId,
  encounterId,
  dense,
  defaultOpen = true,
}: {
  roomId: string;
  patientId: string;
  encounterId?: string | null;
  dense?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [tab, setTab] = useState<IoTab>('health');

  const status = useMemo(
    () =>
      encounterId
        ? 'Clinical evidence linked to encounter'
        : 'Encounter context required to save captures',
    [encounterId],
  );

  const canPersistEvidence = Boolean(encounterId && patientId);

  return (
    <Card
      title="Integrated IoMTs"
      dense={!!dense}
      gradient
      toolbar={
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 hidden md:inline">
            {status}
          </span>
          <CollapseBtn
            open={open}
            onClick={() => setOpen((value) => !value)}
          />
        </div>
      }
    >
      <Collapse open={open}>
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

        <div className="min-h-[96px] mb-3">
          {tab === 'health' ? (
            <div className="space-y-2">
              <HealthMonitorPanel roomId={roomId} />
            </div>
          ) : null}

          {tab === 'steth' ? (
            <div className="space-y-2">
              <StethoscopePanel
                roomId={roomId}
                patientId={patientId}
                encounterId={encounterId}
                canSaveToSummary={canPersistEvidence}
              />
            </div>
          ) : null}

          {tab === 'oto' ? (
            <div className="space-y-2">
              <OtoscopePanel
                roomId={roomId}
                patientId={patientId}
                encounterId={encounterId}
                canSaveToSummary={canPersistEvidence}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded border bg-white p-2">
          <div className="text-xs text-gray-600 mb-1">
            Device Dock
          </div>
          <DeviceDock patientId={patientId} roomId={roomId} />
        </div>
      </Collapse>
    </Card>
  );
}
