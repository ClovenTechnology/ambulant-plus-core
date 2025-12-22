// apps/patient-app/components/LabTimelineItem.tsx
'use client';

import React from 'react';
import {
  normalizeToJobStatus,
  getStatusLabel,
  type JobStatus,
} from '../lib/medreachStatus';

export type LabTimelineEntry = {
  status: string;
  at: string;
  note?: string;
};

function statusToLabel(status: string) {
  const upper = status.toUpperCase();

  // 1) Try to coerce into canonical FSM status and use shared labels
  const canonical: JobStatus = normalizeToJobStatus(upper);
  const canonicalLabel = getStatusLabel(canonical);

  // If normalizeToJobStatus handled it, that label is already good enough
  if (canonicalLabel && canonicalLabel !== 'Waiting for lab') {
    // "Waiting for lab" is our generic fallback; avoid using it for everything
    return canonicalLabel;
  }

  // 2) Legacy dispatch / timeline statuses that don't cleanly map
  switch (upper) {
    case 'PHLEB_ASSIGNED':
      return 'Phlebotomist assigned';
    case 'TRAVELING':
      return 'Phlebotomist traveling';
    case 'ARRIVED':
      return 'Arrived at address';
    case 'SAMPLE_COLLECTED':
      return 'Sample collected';
    case 'LAB_RECEIVED':
      return 'Sample received by lab';
    case 'COMPLETE':
      return 'Result complete';

    case 'RESULT_PENDING':
      return 'Result pending';
    case 'RESULT_IN_PROGRESS':
    case 'RESULT_PROCESSING':
      return 'Result in progress';
    case 'RESULT_READY':
      return 'Result ready';
    case 'RESULT_SENT':
      return 'Result sent to clinician';

    default:
      return status
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());
  }
}

function statusToIcon(status: string) {
  const upper = status.toUpperCase();

  // canonical pre-lab statuses
  if (upper === 'WAITING_LAB_SELECTION') return '🧪';
  if (upper === 'WAITING_PHLEB') return '🩺';
  if (
    upper === 'PHLEB_EN_ROUTE_TO_PATIENT' ||
    upper === 'TRAVELING'
  )
    return '🚗';
  if (upper === 'PHLEB_ARRIVED' || upper === 'ARRIVED') return '📍';
  if (upper === 'SAMPLING_IN_PROGRESS') return '💉';
  if (
    upper === 'PHLEB_EN_ROUTE_TO_LAB' ||
    upper === 'SAMPLE_COLLECTED'
  )
    return '🚚';
  if (upper === 'DELIVERED_TO_LAB' || upper === 'LAB_RECEIVED') return '🧬';

  // result-related
  if (upper === 'RESULT_PENDING') return '⌛';
  if (upper === 'RESULT_IN_PROGRESS' || upper === 'RESULT_PROCESSING')
    return '⚙️';
  if (upper === 'RESULT_READY') return '✅';
  if (upper === 'RESULT_SENT' || upper === 'COMPLETE') return '📤';

  return 'ℹ️';
}

export default function LabTimelineItem({ item }: { item: LabTimelineEntry }) {
  const dt = item.at ? new Date(item.at) : null;
  const timeStr = dt
    ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  const label = statusToLabel(item.status);
  const icon = statusToIcon(item.status);

  return (
    <li className="p-3 border rounded-md flex flex-col md:flex-row md:justify-between gap-3 hover:shadow-sm transition bg-white">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center text-sm bg-indigo-50">
          {icon}
        </div>
        <div>
          <div className="text-sm">
            <span className="font-medium">{label}</span>
            <span className="text-gray-500 ml-2">• {timeStr}</span>
          </div>
          {item.note && (
            <div className="text-xs text-gray-500 mt-1">{item.note}</div>
          )}
        </div>
      </div>

      <div className="flex items-center md:flex-col gap-2 md:items-end">
        <div className="text-xs text-gray-500">
          {dt ? dt.toLocaleString() : 'Unknown time'}
        </div>
      </div>
    </li>
  );
}
