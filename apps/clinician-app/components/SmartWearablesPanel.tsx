'use client';

import { useState } from 'react';
import { Card, Tabs, Collapse } from '@/components/ui';
import { CollapseBtn } from '@/components/ui/CollapseBtn';
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
    <Card
      title="Smart Wearables"
      dense={!!dense}
      gradient
      toolbar={<CollapseBtn open={open} onClick={() => setOpen((v) => !v)} />}
    >
      <Collapse open={open}>
        <div className="mb-2">
          <Tabs<WTab>
            active={tab}
            onChange={setTab}
            items={[
              { key: 'wearables', label: 'Watches / Rings / Bands' },
              { key: 'pillow', label: 'Smart Pillows' },
            ]}
          />
        </div>

        {tab === 'wearables' && (
          <div className="space-y-2">
            {/* Show whichever device the patient is transmitting from (mock: NexRing) */}
            <div className="text-xs text-gray-600">Device: NexRing — <span className="text-emerald-700">Connected</span></div>
            <NexRingPanel roomId={roomId} />
          </div>
        )}

        {tab === 'pillow' && (
          <div className="text-sm text-gray-600">
            Coming soon: Smart pillow integrations (sleep posture, snore index, breath rate).
          </div>
        )}
      </Collapse>
    </Card>
  );
}
