import { NextResponse } from 'next/server';

// Single source-of-truth list (expand freely). You can later read from DB.
const CATALOG = [
  // IoMT (DueCare)
  { id: 'duecare-health-monitor', vendor: 'DueCare', name: 'Health Monitor', model: 'Vitals360', category: 'iomt', modality: 'vitals' },
  { id: 'duecare-stethoscope', vendor: 'DueCare', name: 'Digital Stethoscope', model: 'HC21', category: 'iomt', modality: 'stethoscope' },
  { id: 'duecare-otoscope', vendor: 'DueCare', name: 'HD Otoscope', model: 'HD-Pro', category: 'iomt', modality: 'otoscope' },
  { id: 'duecare-scale', vendor: 'DueCare', name: 'Body Composition Scale', model: 'BF-28', category: 'iomt', modality: 'scale' },

  // Wearables
  { id: 'duecare-nexring', vendor: 'DueCare', name: 'NexRing', model: 'PPG/ECG', category: 'wearable', modality: 'ring' },
  { id: 'duecare-smart-band', vendor: 'DueCare', name: 'Smart Band', model: 'NexBand', category: 'wearable', modality: 'ring' }, // reuse PPG panel
] as const;

function getPairedIds(): Set<string> {
  // For demo: read cookie storing paired IDs (comma list)
  // Replace with real persistence later.
  return new Set<string>();
}

export async function GET() {
  const paired = getPairedIds();
  const devices = CATALOG.map(d => ({
    ...d,
    paired: paired.has(d.id),
    lastSeenAt: paired.has(d.id) ? new Date().toISOString() : null,
  }));
  return NextResponse.json({ devices });
}
