// apps/api-gateway/app/api/patient/plan-entitlement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import { readPatientPlanEntitlement } from '@/src/lib/patient-plan-entitlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

async function resolveAuthenticatedPatientId(args: {
  actorRefId: string | null | undefined;
  uid: string | null | undefined;
}) {
  const actorRefId = clean(args.actorRefId, 180);
  const uid = clean(args.uid, 180);

  if (actorRefId) {
    const byId = await prisma.patientProfile.findUnique({
      where: { id: actorRefId },
      select: { id: true, userId: true },
    });

    if (!byId) return null;

    if (uid && byId.userId && byId.userId !== uid) {
      throw new Error('patient_subject_mismatch');
    }

    return byId.id;
  }

  if (!uid) return null;

  const byUserId = await prisma.patientProfile.findUnique({
    where: { userId: uid },
    select: { id: true },
  });

  return byUserId?.id || null;
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);
  } catch {
    return json(
      { ok: false, error: 'patient_authentication_required' },
      401,
    );
  }

  if (who.role !== 'patient') {
    return json(
      { ok: false, error: 'patient_role_required' },
      403,
    );
  }

  let patientId: string | null = null;

  try {
    patientId = await resolveAuthenticatedPatientId({
      actorRefId: who.actorRefId,
      uid: who.uid,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'patient_subject_mismatch'
    ) {
      return json(
        { ok: false, error: 'patient_subject_mismatch' },
        403,
      );
    }

    throw error;
  }

  if (!patientId) {
    return json(
      { ok: false, error: 'patient_profile_not_found' },
      404,
    );
  }

  try {
    const entitlement =
      await readPatientPlanEntitlement(patientId);

    return json({
      ok: true,
      entitlement,
    });
  } catch {
    return json(
      { ok: false, error: 'entitlement_lookup_failed' },
      500,
    );
  }
}