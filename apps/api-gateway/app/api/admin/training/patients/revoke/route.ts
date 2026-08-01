import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json().catch(() => ({} as any));
    const assignmentId = clean(body.assignmentId, 240);
    const reason = clean(body.reason || 'revoked_by_admin', 240);

    if (!assignmentId) {
      return json({ ok: false, error: 'assignmentId_required' }, 400);
    }

    const db: any = prisma;
    const current = await db.clinicianTrainingParticipantAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!current || current.principalType !== 'patient' || current.role !== 'patient') {
      return json({ ok: false, error: 'patient_training_assignment_not_found' }, 404);
    }

    const now = new Date();
    const priorMeta = current.metadata && typeof current.metadata === 'object' ? current.metadata : {};

    const assignment = await db.clinicianTrainingParticipantAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'revoked',
        revokedAt: now,
        metadata: {
          ...priorMeta,
          revokedReason: reason,
          revokedByUserId: admin.uid || null,
          revokedAt: now.toISOString(),
        },
      },
    });

    await db.clinicianTrainingAdmission.updateMany({
      where: { assignmentId, revokedAt: null },
      data: { revokedAt: now },
    });

    return json({
      ok: true,
      assignment: {
        id: String(assignment.id),
        status: assignment.status,
        revokedAt: assignment.revokedAt?.toISOString?.() || now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[training-patient-revoke] failed', error);
    return json({ ok: false, error: error?.message || 'training_patient_revoke_failed' }, 500);
  }
}