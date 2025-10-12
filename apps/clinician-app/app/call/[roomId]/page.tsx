'use client';
import dynamic from 'next/dynamic';

const MonitorPanel = dynamic(() => import('@ambulant/rtc').then(m => m.MonitorPanel), { ssr: false });

export default function CallMonitorPage({ params }: { params: { roomId: string } }) {
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold mb-3">Call Monitor — {params.roomId}</h1>
      <MonitorPanel />
    </main>
  );
}
