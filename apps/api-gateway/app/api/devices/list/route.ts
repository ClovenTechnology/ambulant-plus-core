import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedAuthenticatedIdentity,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PRIVILEGED_ROLES = new Set([
  'clinician',
  'admin',
  'admin_staff',
  'clinician_staff_medical',
  'clinician_staff_non_medical',
  'system',
]);

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedAuthenticatedIdentity(who);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const requestedPatientId = clean(url.searchParams.get('patient_id'));
  const requestedRoomId = clean(url.searchParams.get('room_id'));

  const uid = clean(who.uid);
  const actorRefId = clean(who.actorRefId);

  let patientId = requestedPatientId || null;
  let roomId = requestedRoomId || null;

  if (who.role === 'patient') {
    const subjectPatientId = actorRefId || uid;

    if (!subjectPatientId) {
      return NextResponse.json(
        { ok: false, error: 'patient_identity_required' },
        { status: 401 },
      );
    }

    if (
      requestedPatientId &&
      requestedPatientId !== subjectPatientId
    ) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    patientId = subjectPatientId;
  } else {
    if (!PRIVILEGED_ROLES.has(who.role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403 },
      );
    }

    if (!patientId && !roomId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'patient_id_or_room_id_required',
        },
        { status: 400 },
      );
    }
  }

  const rows = await prisma.device.findMany({
    where: {
      ...(patientId ? { patientId } : {}),
      ...(roomId ? { roomId } : {}),
    },
    select: {
      id: true,
      deviceId: true,
      patientId: true,
      roomId: true,
      vendor: true,
      category: true,
      model: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  const items = rows.map((row) => ({
    id: row.id,
    deviceId: row.deviceId,
    patientId: row.patientId,
    roomId: row.roomId,
    vendor: row.vendor,
    category: row.category,
    model: row.model,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));

  return NextResponse.json(
    {
      ok: true,
      items,
      devices: items,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
