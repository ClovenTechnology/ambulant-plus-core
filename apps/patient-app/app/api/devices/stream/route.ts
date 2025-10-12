import { NextRequest, NextResponse } from 'next/server';

// Decides *where* the console/stream should open based on modality.
// In future you can mint SFU rooms or direct to clinician join links here.
const MAP: Record<string, { url: string }> = {
  'duecare-stethoscope': { url: '/myCare/devices/console?deviceId=duecare-stethoscope' }, // PCM page
  'duecare-otoscope': { url: '/myCare/devices/console?deviceId=duecare-otoscope' },       // video + capture
  'duecare-health-monitor': { url: '/myCare/devices/console?deviceId=duecare-health-monitor' }, // vitals spot
  'duecare-nexring': { url: '/myCare/devices/console?deviceId=duecare-nexring' },         // PPG/ECG spot
  'duecare-smart-band': { url: '/myCare/devices/console?deviceId=duecare-smart-band' },   // reuse ring panel
  'duecare-scale': { url: '/myCare/devices/console?deviceId=duecare-scale' },             // body comp reading
};

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const deviceId = String(b?.deviceId || '');
  const url = MAP[deviceId]?.url;
  if (!url) return NextResponse.json({ error: 'unknown_device' }, { status: 404 });

  // If you want to gate against pairing, check your DB/session here.

  return NextResponse.json({ url });
}
