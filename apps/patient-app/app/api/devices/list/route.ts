// apps/patient-app/app/api/devices/list/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type DeviceCatalogItem = {
  id: string;
  slug: string;
  vendor: string;
  name: string;
  model: string;
  category: 'iomt' | 'wearable';
  kind: 'monitor' | 'stethoscope' | 'otoscope' | 'ring';
  summary: string;
  href: string;
  status: 'supported';
  capabilities: string[];
};

const CATALOG: DeviceCatalogItem[] = [
  {
    id: 'duecare-health-monitor',
    slug: 'health-monitor',
    vendor: 'DueCare',
    name: 'Health Monitor',
    model: 'Health Monitor',
    category: 'iomt',
    kind: 'monitor',
    summary:
      'Multi-parameter health monitor for body temperature, blood oxygen, blood pressure, blood glucose, heart rate and ECG workflows.',
    href: '/myCare/devices/health-monitor',
    status: 'supported',
    capabilities: [
      'Body temperature',
      'Blood oxygen',
      'Blood pressure',
      'Blood glucose',
      'Heart rate',
      'ECG',
    ],
  },
  {
    id: 'duecare-stethoscope',
    slug: 'digital-stethoscope',
    vendor: 'DueCare',
    name: 'Digital Stethoscope',
    model: 'Stethoscope',
    category: 'iomt',
    kind: 'stethoscope',
    summary:
      'Digital auscultation workflow for heart and lung sounds, playback, session review and clinician sharing.',
    href: '/myCare/devices/stethoscope',
    status: 'supported',
    capabilities: [
      'Heart auscultation',
      'Lung auscultation',
      'Audio playback',
      'Session history',
    ],
  },
  {
    id: 'duecare-otoscope',
    slug: 'hd-otoscope',
    vendor: 'DueCare',
    name: 'HD Otoscope',
    model: 'HD Otoscope',
    category: 'iomt',
    kind: 'otoscope',
    summary:
      'High-definition otoscope workflow for ear imaging, capture review and care-team sharing.',
    href: '/myCare/devices/otoscope',
    status: 'supported',
    capabilities: [
      'HD ear imaging',
      'Image capture',
      'Review workflow',
      'Care-team sharing',
    ],
  },
  {
    id: 'duecare-nexring',
    slug: 'nexring',
    vendor: 'DueCare',
    name: 'NexRing',
    model: 'NexRing',
    category: 'wearable',
    kind: 'ring',
    summary:
      'NexRing wearable insights for pulse, SpO₂, HRV, sleep, recovery and longitudinal wellness signals.',
    href: '/myCare/devices/nexring',
    status: 'supported',
    capabilities: [
      'Pulse',
      'SpO₂',
      'HRV',
      'Sleep insights',
      'Recovery trends',
      'Wearable analytics',
    ],
  },
];

function getPairedIds(): Set<string> {
  /**
   * Production-safe default:
   * this endpoint exposes the supported device catalogue.
   * Pairing state should be attached later from authenticated patient/device persistence.
   */
  return new Set<string>();
}

export async function GET() {
  const paired = getPairedIds();

  const devices = CATALOG.map((device) => ({
    ...device,
    connected: paired.has(device.id),
    paired: paired.has(device.id),
    lastSeenAt: paired.has(device.id) ? new Date().toISOString() : null,
    lastSeenHuman: paired.has(device.id) ? 'Recently synced' : null,
    battery: null,
    recent: [],
  }));

  return NextResponse.json(
    { devices },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}