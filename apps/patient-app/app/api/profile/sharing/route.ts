import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const patientId = (url.searchParams.get('patientId') || '').trim();

    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 });
    }

    const pref = await prisma.patientDataSharingPreference.findUnique({
      where: { patientId },
    });

    return NextResponse.json({
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
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const patientId = String(body?.patientId || '').trim();

    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 });
    }

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

    return NextResponse.json({ ok: true, sharingPreference: updated });
  } catch (err: any) {
    console.error('profile sharing PATCH error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}