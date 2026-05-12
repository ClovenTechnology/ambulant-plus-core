// apps/api-gateway/app/api/events/emit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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

function corsJson(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
    },
  });
}

function jsonPayload(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  // JSON fields can store objects, arrays, strings, numbers, and booleans.
  // If something non-serialisable comes in, normalise it through JSON.
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return String(value) as Prisma.InputJsonValue;
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const orgId = req.headers.get('x-org') || b.orgId || 'org-default';

    const kind = String(b.kind || '').trim();

    if (!kind) {
      return corsJson({ error: 'missing_kind' }, 400);
    }

    const row = await prisma.runtimeEvent.create({
      data: {
        ts: BigInt(Date.now()),
        kind,
        encounterId: b.encounterId ? String(b.encounterId) : null,
        patientId: b.patientId ? String(b.patientId) : null,
        clinicianId: b.clinicianId ? String(b.clinicianId) : null,
        payload: jsonPayload(b.payload),
        targetPatientId: b.targets?.patientId ? String(b.targets.patientId) : null,
        targetClinicianId: b.targets?.clinicianId ? String(b.targets.clinicianId) : null,
        targetAdmin: Boolean(b.targets?.admin),
        orgId: String(orgId),
      },
    });

    return corsJson({
      ok: true,
      event: {
        id: row.id,
        kind: row.kind,
        ts: row.ts.toString(),
      },
    });
  } catch (err: any) {
    return corsJson(
      {
        error: 'event_emit_failed',
        detail: err?.message || String(err),
      },
      400,
    );
  }
}