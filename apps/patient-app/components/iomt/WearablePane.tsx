// apps/patient-app/components/iomt/WearablePane.tsx
'use client';

import NexRingPanel from '@/components/NexRingPanel';

type WearablePaneProps = {
  roomId?: string;
  patientId?: string;
  embedded?: boolean;
};

export default function WearablePane({
  roomId,
  patientId,
  embedded = true,
}: WearablePaneProps) {
  return <NexRingPanel roomId={roomId} patientId={patientId} embedded={embedded} />;
}