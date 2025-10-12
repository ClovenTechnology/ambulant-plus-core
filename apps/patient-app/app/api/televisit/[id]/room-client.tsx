'use client';

import Countdown from '../_components/Countdown';
import GettingReady from '../_components/GettingReady';
import { useMemo } from 'react';

export default function RoomClient({ startsAt, endsAt, serverNow }: { startsAt: string; endsAt: string; serverNow: string }) {
  const skewMs = useMemo(() => {
    // positive skew means server is ahead
    return new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  return (
    <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-6">
      <section className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Session Time</h2>
        </div>
        <Countdown startsAt={startsAt} endsAt={endsAt} skewMs={skewMs} />
        <div className="mt-4 text-sm text-gray-600">
          Colour bands: <span className="text-emerald-600 font-medium">0–50%</span>, <span className="text-amber-600 font-medium">50–80%</span>, <span className="text-rose-600 font-medium">80–100%</span>, then <span className="font-medium">Overtime</span>.
        </div>
      </section>

      <section className="border rounded-lg p-4 bg-white">
        <h2 className="font-semibold mb-3">Getting Ready</h2>
        <GettingReady />
      </section>
    </div>
  );
}
