// apps/api-gateway/app/api/events/inbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readInbox } from '@/src/lib/events';
import { readIdentity } from '@/src/lib/identity';

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers as any);
  const u = new URL(req.url);
  const afterId = u.searchParams.get('afterId') || undefined;

  let patientId = u.searchParams.get('patientId') || undefined;
  let clinicianId = u.searchParams.get('clinicianId') || undefined;
  let admin = u.searchParams.get('admin') === '1' || u.searchParams.get('admin') === 'true';

  if (who.role === 'patient') {
    patientId = who.uid ?? patientId ?? undefined;
    admin = false;
    clinicianId = undefined;
  } else if (who.role === 'clinician') {
    clinicianId = who.uid ?? clinicianId ?? undefined;
    admin = false;
    patientId = undefined;
  } else if (who.role === 'admin') {
    admin = true;
  } else {
    return NextResponse.json({ events: [] }, { headers: { 'access-control-allow-origin': '*' } });
  }

  const data = readInbox({ afterId, patientId, clinicianId, admin });
  return NextResponse.json(data, { headers: { 'access-control-allow-origin': '*' } });
}
export const dynamic = 'force-dynamic';
