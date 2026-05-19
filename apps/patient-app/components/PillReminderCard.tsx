// apps/patient-app/components/PillReminderCard.tsx
'use client';

import React from 'react';

type VerificationStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'SELF_REPORTED'
  | 'FAILED'
  | 'ABORTED'
  | string
  | null;

type TakenSource =
  | 'NONE'
  | 'CAMERA_VERIFIED'
  | 'SELF_REPORTED'
  | 'MANUAL_CLINICIAN'
  | 'IMPORTED_SYSTEM'
  | string
  | null;

export type PillReminderCardMedication = {
  name: string;
  dose: string;
  time: string;
  status: 'Pending' | 'Taken' | 'Missed';
  verificationRequired?: boolean | null;
  verificationStatus?: VerificationStatus;
  takenSource?: TakenSource;
};

interface PillReminderCardProps {
  med: PillReminderCardMedication;
  onConfirm: () => void;
  onSnooze: () => void;
  onTakenEarlier?: () => void;
}

const statusColor: Record<PillReminderCardMedication['status'], string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Taken: 'bg-emerald-100 text-emerald-800',
  Missed: 'bg-red-100 text-red-800',
};

function evidenceBadge(med: PillReminderCardMedication) {
  const verificationRequired = Boolean(med.verificationRequired);
  const verificationStatus = String(med.verificationStatus || '').toUpperCase();
  const takenSource = String(med.takenSource || '').toUpperCase();

  if (med.status === 'Taken') {
    if (verificationStatus === 'VERIFIED' || takenSource === 'CAMERA_VERIFIED') {
      return (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
          Camera verified
        </span>
      );
    }

    if (
      verificationStatus === 'SELF_REPORTED' ||
      takenSource === 'SELF_REPORTED' ||
      takenSource === 'MANUAL_CLINICIAN'
    ) {
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
          Self reported
        </span>
      );
    }

    return null;
  }

  if (med.status === 'Pending' && verificationRequired) {
    if (verificationStatus === 'IN_PROGRESS') {
      return (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
          Verification in progress
        </span>
      );
    }

    return (
      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
        Camera verification required
      </span>
    );
  }

  if (med.status === 'Missed') {
    return (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800">
        Not taken
      </span>
    );
  }

  return null;
}

export default function PillReminderCard({
  med,
  onConfirm,
  onSnooze,
  onTakenEarlier,
}: PillReminderCardProps) {
  const verificationRequired = Boolean(med.verificationRequired);
  const badge = evidenceBadge(med);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="font-medium text-slate-900">{med.name}</div>
        <div className="text-sm text-gray-500">
          {med.dose}
          {med.dose && med.time ? ' • ' : ''}
          {med.time}
        </div>

        {badge ? <div className="mt-1">{badge}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor[med.status]}`}>
          {med.status}
        </span>

        {med.status === 'Pending' && (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
            >
              {verificationRequired ? '📷 Verify dose' : '✅ Confirm'}
            </button>

            {onTakenEarlier ? (
              <button
                type="button"
                onClick={onTakenEarlier}
                className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-800 hover:bg-sky-200"
              >
                Taken earlier
              </button>
            ) : null}

            <button
              type="button"
              onClick={onSnooze}
              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
            >
              ⏰ Snooze
            </button>
          </>
        )}
      </div>
    </div>
  );
}
