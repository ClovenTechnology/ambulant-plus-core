// apps/patient-app/app/api/televisit/consent/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { TelevisitRole } from '@prisma/client';
import { ipFromReq, safeUA, sha256Hex } from '@/src/lib/televisit/security';
import { TELEVISIT_CONSENT_VERSION, televisitConsentDocHash } from '@/src/lib/televisit/consent';

function mustUid(req: Request) {
  const uid = req.headers.get('x-uid') || '';
  if (!uid.trim()) throw new Error('Missing x-uid');
  return uid.trim();
}
function mustRole(req: Request) {
  const r = (req.headers.get('x-role') || 'patient').trim();
  if (!['patient', 'clinician', 'staff', 'observer', 'admin'].includes(r)) throw new Error('Invalid x-role');
  return r as TelevisitRole;
}

export async function POST(req: Request) {
  try {
    const uid = mustUid(req);
    const role = mustRole(req);

    const body = await req.json().catch(() => ({}));
    const visitId = String(body.visitId || '').trim();
    const roomId = String(body.roomId || '').trim();
    const scopes = body.scopes ?? null;
    const consentVersion = String(body.consentVersion || TELEVISIT_CONSENT_VERSION).trim();

    if (!visitId && !roomId) return NextResponse.json({ ok: false, error: 'visitId or roomId required' }, { status: 400 });

    const visit =
      (visitId ? await prisma.televisit.findUnique({ where: { id: visitId } }) : null) ||
      (roomId ? await prisma.televisit.findUnique({ where: { roomId } }) : null);

    if (!visit) return NextResponse.json({ ok: false, error: 'Televisit not found' }, { status: 404 });

    const ip = ipFromReq(req);
    const ua = safeUA(req);

    const row = await prisma.televisitConsent.upsert({
      where: { visitId_uid_role_consentVersion: { visitId: visit.id, uid, role, consentVersion } },
      update: {
        scopes: scopes ?? undefined,
        locale: body.locale ? String(body.locale) : undefined,
        ipHash: ip ? sha256Hex(ip) : undefined,
        userAgent: ua ?? undefined,
      },
      create: {
        visitId: visit.id,
        uid,
        role,
        consentVersion,
        consentDocHash: televisitConsentDocHash(),
        scopes: scopes ?? {},
        locale: body.locale ? String(body.locale) : null,
        ipHash: ip ? sha256Hex(ip) : null,
        userAgent: ua,
      },
      select: { id: true, acceptedAt: true, consentVersion: true },
    });

    return NextResponse.json({ ok: true, consent: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 400 });
  }
}
