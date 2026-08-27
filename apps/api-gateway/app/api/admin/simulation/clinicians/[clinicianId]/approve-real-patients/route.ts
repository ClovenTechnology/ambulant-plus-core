import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { verifyAdminRequest } from '../../../../utils/auth';
import { resolveClinicianOnboardingEntitlements } from '@/src/clinicians/onboarding/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}
function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}
function clean(value: unknown, max = 240) { return String(value ?? '').trim().slice(0, max); }
function sessionNumber(meta: unknown, reason?: string | null): number | null {
  const m = record(meta); const direct = Number(m.sessionNumber);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 99) return direct;
  const text = clean(reason || m.reason, 500);
  const match = text.match(/(?:session|consultation)\s+(\d+)(?:\s*(?:of|\/)\s*3)?/i) || text.match(/\b(\d+)\s*\/\s*3\b/);
  const n = match ? Number(match[1]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
}
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }

export async function POST(req: NextRequest, { params }: { params: { clinicianId: string } }) {
  try {
    const admin = await verifyAdminRequest(req as any);
    if (!admin.ok) return admin.response;

    const clinicianId = clean(params.clinicianId, 160);
    if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);
    const body = await req.json().catch(() => ({} as any));
    const note = clean(body?.note, 700);
    const actor = clean(req.headers.get('x-uid'), 160) || 'admin';

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: {
        id: true, displayName: true, email: true, status: true, trainingCompleted: true,
        disabled: true, archived: true, meta: true,
      },
    });
    if (!clinician) return json({ ok: false, error: 'clinician_not_found' }, 404);
    if (!clinician.trainingCompleted) return json({ ok: false, error: 'training_not_completed' }, 409);

    const onboarding = await prisma.clinicianOnboarding.findUnique({ where: { clinicianId } });
    const entitlements = await resolveClinicianOnboardingEntitlements(prisma, clinicianId, onboarding);
    if (!entitlements.practiceActivation) {
      return json({
        ok: false,
        error: 'commercial_practice_activation_not_granted',
        message: 'The effective Admin-configured onboarding pathway does not grant practice activation.',
        entitlements: {
          pathwayKey: entitlements.pathwayKey,
          privileges: entitlements.privileges,
          paymentState: entitlements.paymentState,
        },
      }, 409);
    }

    const rows = await prisma.appointment.findMany({
      where: { clinicianId, bookingSource: 'admin_simulation' },
      select: { id: true, reason: true, status: true, meta: true },
    });
    const passed = new Set<number>();
    for (const row of rows) {
      const meta = record(row.meta);
      const assessment = record(meta.simulationAssessment);
      if (assessment.status !== 'finalized' || assessment.outcome !== 'PASS') continue;
      const n = sessionNumber(meta, row.reason); if (n) passed.add(n);
    }
    if (passed.size < 3) {
      return json({
        ok: false,
        error: 'three_distinct_finalized_passes_required',
        requiredSessions: 3,
        passedCount: passed.size,
        passedSessionNumbers: [...passed].sort((a, b) => a - b),
      }, 409);
    }

    const now = new Date().toISOString();
    const currentMeta = record(clinician.meta);
    const currentApproval = record(currentMeta.realPatientApproval);
    const passedSessionNumbers = [...passed].sort((a, b) => a - b);
    const nextMeta = {
      ...currentMeta,
      simulationCompleted: true,
      simulationCompletedAt: currentMeta.simulationCompletedAt || now,
      adminFinalApproved: true,
      realPatientApprovedAt: currentMeta.realPatientApprovedAt || now,
      realPatientApproval: {
        ...currentApproval,
        approved: true,
        approvedAt: currentApproval.approvedAt || now,
        approvedByAdminId: currentApproval.approvedByAdminId || actor,
        source: 'simulation_control',
        requiredPasses: 3,
        passedSessionNumbers,
        note: note || currentApproval.note || null,
      },
    };
    const updated = await prisma.clinicianProfile.update({
      where: { id: clinicianId },
      data: { status: 'active', disabled: false, archived: false, trainingCompleted: true, meta: nextMeta },
      select: { id: true, displayName: true, email: true, status: true, trainingCompleted: true, disabled: true, archived: true, meta: true, updatedAt: true },
    });
    return json({
      ok: true,
      clinicianId,
      visibleToPatients: String(updated.status || '').toLowerCase() === 'active' && !updated.disabled && !updated.archived,
      realPatientApprovedAt: nextMeta.realPatientApproval.approvedAt,
      requiredSessions: 3,
      passedCount: passed.size,
      passedSessionNumbers,
      entitlements: { pathwayKey: entitlements.pathwayKey, privileges: entitlements.privileges, paymentState: entitlements.paymentState },
      clinician: updated,
    });
  } catch (error: any) {
    console.error('[api-gateway][admin][simulation][approve-real-patients]', error);
    return json({ ok: false, error: clean(error?.message, 300) || 'approve_real_patients_failed' }, error?.status || 500);
  }
}
