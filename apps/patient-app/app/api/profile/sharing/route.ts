import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

async function requireIdentity(req: NextRequest, body?: any) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return { ok: false as const, response: json({ ok: false, error: 'patient_authentication_required' }, 401) };

  const requested = String(
    body?.patientId || req.nextUrl.searchParams.get('patientId') || '',
  ).trim();
  if (requested && requested !== identity.patientId) {
    return { ok: false as const, response: json({ ok: false, error: 'patient_context_mismatch' }, 403) };
  }
  return { ok: true as const, identity };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireIdentity(req);
    if (!access.ok) return access.response;

    const patientId = access.identity.patientId;
    const pref = await prisma.patientDataSharingPreference.findUnique({ where: { patientId } });

    return json({
      ok: true,
      sharingPreference:
        pref ?? {
          patientId,
          allowClinicianAccess: true,
          allowMedicalAidAdherenceAccess: false,
          allowCorporateSponsorAdherenceAccess: false,
          allowRewardProgramAccess: false,
          allowEvidenceImages: false,
        },
    });
  } catch (err: any) {
    console.error('profile sharing GET error', err);
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const access = await requireIdentity(req, body);
    if (!access.ok) return access.response;

    const patientId = access.identity.patientId;
    const updated = await prisma.patientDataSharingPreference.upsert({
      where: { patientId },
      create: {
        patientId,
        allowClinicianAccess: Boolean(body?.allowClinicianAccess ?? true),
        allowMedicalAidAdherenceAccess: Boolean(body?.allowMedicalAidAdherenceAccess ?? false),
        allowCorporateSponsorAdherenceAccess: Boolean(body?.allowCorporateSponsorAdherenceAccess ?? false),
        allowRewardProgramAccess: Boolean(body?.allowRewardProgramAccess ?? false),
        allowEvidenceImages: Boolean(body?.allowEvidenceImages ?? false),
      },
      update: {
        allowClinicianAccess: Boolean(body?.allowClinicianAccess ?? true),
        allowMedicalAidAdherenceAccess: Boolean(body?.allowMedicalAidAdherenceAccess ?? false),
        allowCorporateSponsorAdherenceAccess: Boolean(body?.allowCorporateSponsorAdherenceAccess ?? false),
        allowRewardProgramAccess: Boolean(body?.allowRewardProgramAccess ?? false),
        allowEvidenceImages: Boolean(body?.allowEvidenceImages ?? false),
      },
    });

    return json({ ok: true, sharingPreference: updated });
  } catch (err: any) {
    console.error('profile sharing PATCH error', err);
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
}
