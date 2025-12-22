// apps/patient-app/app/televisit/[id]/page.tsx
'use client';

// Reuse the SFU room page, but adapt param name: id -> roomId
import SfuPage from '../../sfu/[roomId]/page';

export default function Televisit({ params }: { params: { id: string } }) {
  return <SfuPage params={{ roomId: params.id }} />;
}
