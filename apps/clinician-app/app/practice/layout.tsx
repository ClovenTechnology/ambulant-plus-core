// apps/clinician-app/app/practice/layout.tsx
import type { ReactNode } from 'react';
import { PracticeShell } from '@/components/PracticeShell';

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return <PracticeShell>{children}</PracticeShell>;
}
