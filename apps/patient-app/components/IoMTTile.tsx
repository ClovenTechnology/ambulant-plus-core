'use client';
import React from 'react';

type Props = {
  title: string;
  value?: string;
  unit?: string;
  lastSeenAt?: string;
  footer?: React.ReactNode;
};

export default function IoMTTile({
  title, value, unit, lastSeenAt, footer,
}: Props) {
  const online = lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() <= 60_000;

  return (
    <div className="p-4 border rounded-lg bg-white flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] bg-gray-50">
          {online ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              🟢 Online
            </>
          ) : (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
              ⚪ Idle
            </>
          )}
          {lastSeenAt && (
            <span className="ml-1 text-[10px] text-gray-400">
              {new Date(lastSeenAt).toLocaleTimeString()}
            </span>
          )}
        </span>
      </div>
      <div className="text-2xl font-semibold">
        {value ?? '—'} {unit && <span className="text-gray-500 text-base">{unit}</span>}
      </div>
      {footer && <div className="text-xs text-gray-500">{footer}</div>}
    </div>
  );
}
