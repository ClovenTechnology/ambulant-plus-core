// apps/patient-app/app/sfu/[roomId]/page.tsx
'use client';

import PatientSfuShell from '@/components/televisit/PatientSfuShell';

export default function PatientSfuPage({
  params,
}: {
  params: { roomId: string };
}) {
  return <PatientSfuShell params={params} />;
}