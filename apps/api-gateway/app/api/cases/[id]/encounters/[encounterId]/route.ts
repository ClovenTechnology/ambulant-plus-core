import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canonical(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function canRead(actor: any) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set(
    [...(actor?.roles || []), ...(actor?.scopes || [])]
      .map(canonical)
      .filter(Boolean),
  );
  return (
    values.has('superadmin') ||
    values.has('adminall') ||
    values.has('*') ||
    ['clinical:read', 'clinical:write', 'patients:read', 'patients:manage', 'admin:read']
      .some((value) => values.has(canonical(value)))
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; encounterId: string } },
) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canRead(actor)) return json({ ok: false, error: 'case_read_forbidden' }, 403);

    const encounter = await prisma.encounter.findFirst({
      where: { id: params.encounterId, caseId: params.id },
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: 100 },
        erxOrders: { orderBy: { createdAt: 'desc' }, take: 100 },
        labOrders: { orderBy: { createdAt: 'desc' }, take: 100 },
        payments: { orderBy: { createdAt: 'desc' }, take: 100 },
        documents: { orderBy: { createdAt: 'desc' }, take: 100 },
        diagnoses: { orderBy: { createdAt: 'desc' }, take: 100 },
        labResults: { orderBy: { createdAt: 'desc' }, take: 100 },
        clinicalFindings: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!encounter) return json({ ok: false, error: 'encounter_not_found' }, 404);

    const [patient, clinician] = await Promise.all([
      prisma.patientProfile.findUnique({
        where: { id: encounter.patientId },
        select: { id: true, name: true, mrn: true, dob: true, gender: true },
      }),
      encounter.clinicianId
        ? prisma.clinicianProfile.findUnique({
            where: { id: encounter.clinicianId },
            select: { id: true, displayName: true, specialty: true },
          })
        : Promise.resolve(null),
    ]);

    return json({
      ok: true,
      source: 'clinical-case.encounter',
      caseId: params.id,
      patient,
      clinician,
      encounter,
    });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    return json(
      { ok: false, error: String(error?.message || 'encounter_load_failed') },
      Number(error?.status) || 500,
    );
  }
}
