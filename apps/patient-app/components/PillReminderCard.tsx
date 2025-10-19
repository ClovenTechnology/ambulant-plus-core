// apps/patient-app/components/PillReminderCard.tsx
'use client';

import React from 'react';

interface PillReminderCardProps {
  med: {
    name: string;
    dose: string;
    time: string;
    status: 'Pending' | 'Taken' | 'Missed';
  };
  onConfirm: () => void;
  onSnooze: () => void;
}

const statusColor = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Taken: 'bg-emerald-100 text-emerald-800',
  Missed: 'bg-red-100 text-red-800',
};

export default function PillReminderCard({ med, onConfirm, onSnooze }: PillReminderCardProps) {
  return (
    <div className="flex justify-between items-center p-3 border rounded-lg bg-white shadow-sm">
      <div>
        <div className="font-medium">{med.name}</div>
        <div className="text-sm text-gray-500">{med.dose} • {med.time}</div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[med.status]}`}>
          {med.status}
        </span>
        {med.status === 'Pending' && (
          <>
            <button
              onClick={onConfirm}
              className="px-2 py-1 rounded bg-emerald-600 text-white text-xs hover:bg-emerald-700"
            >
              ✅ Confirm
            </button>
            <button
              onClick={onSnooze}
              className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs hover:bg-gray-300"
            >
              ⏰Snooze
            </button>
          </>
        )}
      </div>
    </div>
  );
}
