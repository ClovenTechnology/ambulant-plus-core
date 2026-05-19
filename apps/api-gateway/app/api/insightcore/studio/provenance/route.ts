import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const patientId = req.nextUrl.searchParams.get('patientId') || 'pt-za-001';

  return NextResponse.json({
    patientId,
    items: [
      {
        sourceType: 'device_auto',
        deviceClass: 'nexring',
        sourcePriority: 70,
        signalQuality: 0.82,
        knownBiasFlags: [],
      },
      {
        sourceType: 'clinician_measured',
        deviceClass: 'health_monitor',
        sourcePriority: 95,
        signalQuality: 0.94,
        knownBiasFlags: [],
      },
    ],
  });
}