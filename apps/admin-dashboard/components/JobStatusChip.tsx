// apps/admin-dashboard/components/JobStatusChip.tsx
'use client';

import type { JobStatus } from '@shared/fsm';
import { getStatusLabel, getStatusClasses } from '@shared/fsm';

type Props = {
  status: JobStatus;
  compact?: boolean;
};

export default function JobStatusChip({ status, compact }: Props) {
  return (
    <span
      className={
        (compact ? 'px-1.5 py-0.5' : 'px-2 py-0.5') +
        ' inline-flex items-center rounded-full text-[10px] font-medium border ' +
        getStatusClasses(status)
      }
    >
      {getStatusLabel(status)}
    </span>
  );
}
