//apps/clinician-app/app/api/events/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readInbox } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const afterId     = url.searchParams.get('afterId') || undefined;
  const clinicianId = url.searchParams.get('clinicianId') || undefined;
  const patientId   = url.searchParams.get('patientId') || undefined;
  const admin       = url.searchParams.get('admin') === '1';

  const data = readInbox({ afterId, clinicianId, patientId, admin });
  return NextResponse.json(data, { headers: { 'access-control-allow-origin': '*' } });
}

export function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
    },
  });
}
