import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function randomDeviceSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function canRotate(role: unknown) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'admin' || r === 'admin_staff' || r === 'system';
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const ident = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, ident);

    if (!ident?.uid || !canRotate(ident.role)) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const deviceId = clean(params.deviceId, 160);
    if (!deviceId) {
      return NextResponse.json({ ok: false, error: 'device_id_required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({} as any));
    const reason = clean(body?.reason, 500) || 'admin_device_secret_rotation';

    const existing = await prisma.device.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        patientId: true,
        roomId: true,
        vendor: true,
        category: true,
        model: true,
        updatedAt: true,
      } as any,
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'device_not_found' }, { status: 404 });
    }

    const secret = randomDeviceSecret();
    const rotatedAt = new Date();

    const updated = await prisma.device.update({
      where: { deviceId },
      data: {
        secret,
        updatedAt: rotatedAt,
      } as any,
      select: {
        deviceId: true,
        patientId: true,
        roomId: true,
        vendor: true,
        category: true,
        model: true,
        updatedAt: true,
      } as any,
    });

    await prisma.auditEvent
      .create({
        data: {
          kind: 'device_secret_rotated',
          actorId: ident.uid,
          actorRole: ident.role,
          subjectId: deviceId,
          meta: jsonSafe({
            reason,
            deviceId,
            patientId: (updated as any).patientId ?? null,
            roomId: (updated as any).roomId ?? null,
            vendor: (updated as any).vendor ?? null,
            category: (updated as any).category ?? null,
            model: (updated as any).model ?? null,
            rotatedAt: rotatedAt.toISOString(),
            // Never store or log the actual secret here.
            secretReturnedOnce: true,
          }) as any,
        },
      })
      .catch(() => null);

    return NextResponse.json(
      {
        ok: true,
        device: updated,
        secret,
        secretReturnedOnce: true,
        warning:
          'Store this secret securely now. It will not be retrievable from safe device info endpoints.',
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (err: any) {
    const msg = String(err?.message || 'device_secret_rotation_failed');

    if (msg === 'unauthorized' || msg === 'Unauthorized') {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    console.error('[admin.devices.rotate-secret] failed', {
      message: msg,
    });

    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}