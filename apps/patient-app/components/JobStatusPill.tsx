// apps/patient-app/components/JobStatusPill.tsx
'use client';

import type { JobStatus } from '../lib/medreachStatus';
import { getStatusLabel, getStatusClasses } from '../lib/medreachStatus';

type Props = {
  status: JobStatus;
};

export default function JobStatusPill({ status }: Props) {
  return (
    <span
      className={
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ' +
        getStatusClasses(status)
      }
    >
      {getStatusLabel(status)}
    </span>
  );
}
