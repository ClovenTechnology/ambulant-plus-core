// apps/api-gateway/app/api/events/emit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type,x-uid,x-role,x-org',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const orgId = req.headers.get('x-org') || b.orgId || 'org-default';

    // accepted input shape (flexible)
    // {
    //   kind: string,
    //   encounterId?: string, patientId?: string, clinicianId?: string,
    //   payload?: any,
    //   targets?: { patientId?: string, clinicianId?: string, admin?: boolean }
    // }
    const kind = String(b.kind || '').trim();
    if (!kind) {
      return NextResponse.json({ error: 'missing_kind' }, { status: 400, headers: { 'access-control-allow-origin': '*'} });
    }

    const row = await prisma.runtimeEvent.create({
      data: {
        ts: BigInt(Date.now()),
        kind,
        encounterId: b.encounterId ? String(b.encounterId) : null,
        patientId: b.patientId ? String(b.patientId) : null,
        clinicianId: b.clinicianId ? String(b.clinicianId) : null,
        payload: b.payload ? JSON.stringify(b.payload) : null,
        targetPatientId: b.targets?.patientId ? String(b.targets.patientId) : null,
        targetClinicianId: b.targets?.clinicianId ? String(b.targets.clinicianId) : null,
        targetAdmin: Boolean(b.targets?.admin),
        orgId,
      },
    });

    return NextResponse.json({ ok: true, event: { id: row.id, kind: row.kind, ts: row.ts.toString() } }, {
      headers: { 'access-control-allow-origin': '*' },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'event_emit_failed', detail: err?.message || String(err) },
      { status: 400, headers: { 'access-control-allow-origin': '*' } }
    );
  }
}
