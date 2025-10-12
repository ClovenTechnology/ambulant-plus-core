import { NextRequest, NextResponse } from 'next/server';
import { listUserDevices, upsertCatalog } from '@/src/lib/devices';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const uid = req.headers.get('x-uid') || 'pt-za-001';
  // snippet from file - update seed list (only show modified entries)
await upsertCatalog([
  { slug: 'duecare.stethoscope', label: 'DueCare Stethoscope', vendor: 'DueCare', modality:'stethoscope', transport:'ble' },
  { slug: 'duecare.otoscope', label: 'DueCare HD Otoscope', vendor: 'DueCare', modality:'otoscope', transport:'usb' },
  { slug: 'duecare.health-monitor', label: 'DueCare Health Monitor', vendor: 'DueCare', modality:'monitor', transport:'ble' },
  { slug: 'duecare.nexring', label: 'DueCare NexRing', vendor: 'DueCare', modality:'ring', transport:'ble' },
  { slug: 'duecare.nexring-ecg', label: 'DueCare NexRing ECG', vendor: 'DueCare', modality:'ring_ecg', transport:'ble' },
  { slug: 'duecare.vitals-360', label: 'Vitals 360', vendor: 'DueCare', modality:'monitor', transport:'ble' },
]);

