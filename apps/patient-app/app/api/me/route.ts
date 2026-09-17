import { NextResponse } from 'next/server';
import { resolvePatientAppSession } from '@/app/api/_session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = resolvePatientAppSession();
  if (!session || session.role !== 'patient') {
    return NextResponse.json({ ok: false, error: 'patient_identity_not_available' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    id: session.actorRefId || session.userId,
    userId: session.userId,
    email: session.email,
    name: session.name,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
