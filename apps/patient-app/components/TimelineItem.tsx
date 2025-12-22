// apps/patient-app/components/TimelineItem.tsx
'use client';

import React from 'react';

type TimelineEntity = 'pharmacy' | 'rider' | 'system' | string;

type TimelineItemData = {
  t?: string | number;
  msg?: string;
  lat?: number;
  lng?: number;
  entity?: TimelineEntity;
  place?: string;
  [key: string]: any;
};

type Props = {
  it: TimelineItemData;
  onCenter?: (lat: number, lng: number) => void;
};

export default function TimelineItem({ it, onCenter }: Props) {
  const timeStr = it?.t
    ? new Date(it.t).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

  const entity: TimelineEntity = it?.entity || 'system';
  const icon =
    entity === 'pharmacy' ? '🏥' : entity === 'rider' ? '🏍️' : 'ℹ️';

  const hasCoords =
    typeof it?.lat === 'number' && typeof it?.lng === 'number';

  return (
    <li className="p-3 border rounded-md flex flex-col md:flex-row md:justify-between gap-3 hover:shadow-sm transition">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-md flex items-center justify-center text-sm bg-gray-50">
          {icon}
        </div>
        <div>
          <div className="text-sm">
            <span className="font-medium">{it?.msg || 'No message'}</span>
            <span className="text-gray-500 ml-2">• {timeStr}</span>
          </div>
          {it?.place ? (
            <div className="text-xs text-gray-500 mt-1">{it.place}</div>
          ) : hasCoords ? (
            <div className="text-xs text-gray-500 mt-1">
              {it.lat!.toFixed(5)}, {it.lng!.toFixed(5)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center md:flex-col gap-2 md:items-end">
        <div className="text-xs text-gray-500">
          {it?.t
            ? new Date(it.t).toLocaleString()
            : 'Unknown time'}
        </div>

        {hasCoords && onCenter ? (
          <button
            className="text-xs px-2 py-1 rounded border bg-white"
            onClick={() => onCenter(it.lat!, it.lng!)}
          >
            Open in Maps
          </button>
        ) : null}
      </div>
    </li>
  );
}
