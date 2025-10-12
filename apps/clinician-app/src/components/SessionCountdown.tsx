'use client';

import { useEffect, useState } from 'react';
import type { Appointment } from '@/lib/types';
import clsx from 'clsx';

export default function SessionCountdown({
  appointment,
  loading,
}: {
  appointment?: Appointment;
  loading?: boolean;
}) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'pre' | 'ongoing' | 'overrun'>('pre');

  useEffect(() => {
    if (!appointment) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const start = new Date(appointment.start).getTime();
      const end = new Date(appointment.end).getTime();

      if (now < start) {
        setStatus('pre');
        setProgress(0);
      } else if (now >= start && now <= end) {
        setStatus('ongoing');
        const pct = ((now - start) / (end - start)) * 100;
        setProgress(Math.min(100, pct));
      } else {
        setStatus('overrun');
        const pct = ((now - end) / (end - start)) * 100;
        setProgress(Math.min(100, pct));
      }
    }, 500);

    return () => clearInterval(interval);
  }, [appointment]);

  const statusColor = {
    pre: 'bg-amber-400',
    ongoing: 'bg-green-500',
    overrun: 'bg-red-500',
  }[status];

  if (!appointment) {
    return (
      <div className="rounded-xl border bg-white/60 backdrop-blur p-6 text-center text-gray-500">
        Select an appointment to see countdown
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white/60 backdrop-blur p-6 text-center animate-pulse h-24" />
    );
  }

  return (
    <div className="rounded-xl border bg-white/60 backdrop-blur p-6 space-y-3">
      <div className="flex justify-between items-center">
        <div className="font-medium text-lg truncate">{appointment.patient.name}</div>
        <div className="text-sm text-gray-600">
          {status === 'pre'
            ? 'Upcoming'
            : status === 'ongoing'
            ? 'Ongoing'
            : 'Overrun'}
        </div>
      </div>

      <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden group" title={`${progress.toFixed(0)}%`}>
        <div
          className={clsx('h-4 rounded-full transition-all')}
          style={{ width: `${progress}%`, backgroundColor: statusColor }}
        />
      </div>

      <div className="text-xs text-gray-500 flex justify-between">
        <span>{new Date(appointment.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>{new Date(appointment.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
