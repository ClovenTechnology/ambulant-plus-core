import { NextResponse } from 'next/server';
import type { DeviceInfo } from '@/src/devices/types';

export const dynamic = 'force-dynamic';

function devicesForDemo(): DeviceInfo[] {
  const now = new Date().toISOString();

  return [
    // --- IoMT (active exam) ---
    {
      id: 'duecare-health-monitor',
      vendor: 'DueCare',
      model: 'Vitals360 Health Monitor',
      category: 'iomt',
      modalities: ['bp', 'spo2', 'temp', 'hr', 'ecg'],
      transport: ['ble'],
      paired: false,
      lastSeen: null,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=duecare-health-monitor', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=duecare-health-monitor', method: 'POST', hint: 'ECG/SpO₂/BP session' },
      },
      tags: ['session-based', 'clinical'],
    },
    {
      id: 'duecare-stethoscope',
      vendor: 'DueCare',
      model: 'Digital Stethoscope (HC21)',
      category: 'iomt',
      modalities: ['audio'],
      transport: ['ble'],
      paired: false,
      lastSeen: null,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=duecare-stethoscope', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=duecare-stethoscope', method: 'POST', hint: 'Live auscultation' },
      },
      tags: ['PCM', 'waveform'],
    },
    {
      id: 'duecare-otoscope',
      vendor: 'DueCare',
      model: 'HD Otoscope',
      category: 'iomt',
      modalities: ['video', 'photo'], // NOTE: photo supported
      transport: ['ble', 'usb'],
      paired: false,
      lastSeen: null,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=duecare-otoscope', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=duecare-otoscope', method: 'POST', hint: 'Live video / stills' },
      },
      tags: ['ENT', 'derm'],
    },
    {
      id: 'duecare-smart-scale',
      vendor: 'DueCare',
      model: 'Body Composition Scale (8-electrode)',
      category: 'iomt',
      modalities: ['weight', 'bmi', 'bodyfat'],
      transport: ['ble', 'wifi'],
      paired: false,
      lastSeen: null,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=duecare-smart-scale', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=duecare-smart-scale', method: 'POST', hint: 'Weigh-in session' },
      },
      tags: ['episodic'],
    },

    // --- Wearables (continuous) ---
    {
      id: 'duecare-nexring-ecg',
      vendor: 'DueCare',
      model: 'NexRing ECG',
      category: 'wearable',
      modalities: ['ppg', 'ecg', 'spo2', 'hr', 'temp'],
      transport: ['ble'],
      paired: true,
      batteryPct: 78,
      lastSeen: now,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=duecare-nexring-ecg', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=duecare-nexring-ecg', method: 'POST', hint: 'PPG/ECG spot check' },
      },
      tags: ['continuous'],
    },
    {
      id: 'apple-watch-series-10',
      vendor: 'Apple',
      model: 'Watch Series 10',
      category: 'wearable',
      modalities: ['ppg', 'hr', 'spo2', 'temp'],
      transport: ['ble', 'wifi'],
      paired: false,
      lastSeen: null,
      actions: {
        pair:   { href: '/api/devices/pair?deviceId=apple-watch-series-10', method: 'POST' },
        stream: { href: '/api/devices/stream?deviceId=apple-watch-series-10', method: 'POST', hint: 'spot sync' },
      },
      tags: ['continuous'],
    },
  ];
}

export async function GET() {
  const list = devicesForDemo();
  return NextResponse.json({ devices: list }, {
    headers: { 'access-control-allow-origin': '*' }
  });
}
