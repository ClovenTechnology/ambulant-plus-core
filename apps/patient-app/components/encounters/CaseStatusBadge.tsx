// apps/patient-app/components/encounters/CaseStatusBadge.tsx
'use client';

import React from 'react';
import { caseStatusClasses } from '@/lib/encounters/display';

export default function CaseStatusBadge({
  status,
  className = '',
}: {
  status?: string | null;
  className?: string;
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        caseStatusClasses(status),
        className,
      ].join(' ')}
    >
      {status || 'Unknown'}
    </span>
  );
}