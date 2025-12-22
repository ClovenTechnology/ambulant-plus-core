// apps/clinician-app/components/PracticeShell.tsx
'use client';

import type { ReactNode } from 'react';
import { ClinicianShell } from '@/components/ClinicianShell';

export function PracticeShell({ children }: { children: ReactNode }) {
  return <ClinicianShell>{children}</ClinicianShell>;
}
