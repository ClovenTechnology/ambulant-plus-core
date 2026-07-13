// apps/patient-app/app/sfu/[roomId]/page.tsx
'use client';

import PatientSfuShell from '@/components/televisit/PatientSfuShell';

export default function PatientSfuPage({
  params,
}: {
  params: { roomId: string };
}) {
  return (
    <div data-p-ui="patient-sfu-page" className="min-h-dvh min-w-0 overflow-x-clip bg-slate-950">
      <PatientSfuShell params={params} />
    </div>
  );
}