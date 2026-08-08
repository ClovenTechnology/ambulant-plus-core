import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await verifyAdminRequest(req);
  if (!admin.ok) return admin.response;

  const id = decodeURIComponent(String(params.id || '')).trim();
  if (!id) return json({ ok: false, error: 'clinician_id_required' }, 400);

  try {
    const clinician = await prisma.clinicianProfile.findFirst({
      where: { OR: [{ id }, { userId: id }] },
      select: {
        id: true, userId: true, displayName: true, specialty: true, gender: true,
        phone: true, email: true, photoUrl: true, boardCertificateUrl: true,
        boardCertificateNumber: true, boardCertificateIssuer: true,
        boardCertificateExpires: true, idNumber: true, idIssuingCountry: true,
        idExpiry: true, qualification: true, qualificationYear: true,
        qualificationInstitution: true, otherQualifications: true,
        addressLine1: true, addressLine2: true, city: true, postalCode: true,
        country: true, feeCents: true, currency: true, piInsuranceProvider: true,
        piInsurancePolicyName: true, piInsuranceCoverType: true,
        piInsuranceExpiry: true, piInsuranceNumber: true, trainingScheduledAt: true,
        trainingCompleted: true, status: true, disabled: true, archived: true,
        meta: true, createdAt: true, updatedAt: true, lastBookedAt: true,
        lastSeenAt: true, online: true, recentBookedCount: true,
        acceptedSchemes: true, acceptsMedicalAid: true, practiceName: true,
        practiceNumber: true, regulatorBody: true, regulatorRegistration: true,
        ratingAvg: true, ratingCount: true,
        feesV2: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!clinician) return json({ ok: false, error: 'clinician_not_found' }, 404);

    const onboarding = await prisma.clinicianOnboarding.findUnique({
      where: { clinicianId: clinician.id },
      include: {
        trainingSlot: true,
        dispatches: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        payLaterRequests: { orderBy: { requestedAt: 'desc' } },
      },
    });

    return json({ ok: true, clinician: { ...clinician, onboarding } });
  } catch (error: any) {
    console.error('admin clinician detail error', error);
    return json({ ok: false, error: error?.message || 'clinician_detail_load_failed' }, 500);
  }
}
