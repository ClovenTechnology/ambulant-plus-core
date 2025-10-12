'use client';
import dynamic from 'next/dynamic';

const DeviceSettings = dynamic(() => import('@ambulant/rtc').then(m => m.DeviceSettings), { ssr: false });

export default function RTCSettingsPage() {
  return (
    <main className="p-4">
      <h1 className="text-lg font-semibold mb-3">Device Settings</h1>
      <DeviceSettings />
    </main>
  );
}
