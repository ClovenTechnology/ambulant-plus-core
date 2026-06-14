// apps/clinician-app/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function clinicianTrainingCompleted(clinician: any) {
  const meta = parseObject(clinician?.metadata ?? clinician?.meta ?? null);
  const rawProfile = parseObject(meta.rawProfile ?? meta.rawProfileJson ?? null);

  const training = parseObject(rawProfile.training);
  const trainingCertificate = parseObject(rawProfile.trainingCertificate ?? meta.trainingCertificate);
  const onboarding = parseObject(rawProfile.onboarding);

  const additionalQualifications = Array.isArray(rawProfile.additionalQualifications)
    ? rawProfile.additionalQualifications
    : [];

  const hasTrainingQualification = additionalQualifications.some(
    (q: any) =>
      String(q?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training' &&
      Boolean(q?.certificateNumber || q?.completedAt),
  );

  return (
    clinician?.trainingCompleted === true ||
    String(onboarding?.stage || '').toLowerCase() === 'training_completed' ||
    String(training?.status || '').toLowerCase() === 'completed' ||
    Boolean(training?.certificateNumber && training?.completedAt) ||
    Boolean(trainingCertificate?.certificateNumber && (trainingCertificate?.completedAt || trainingCertificate?.issuedAt)) ||
    hasTrainingQualification
  );
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireClinicianAuth(req, {
      allowAdmin: true,
      allowAdminStaff: true,
    });

    if (!auth.ok) {
      return authErrorResponse(auth);
    }

    const clinician = auth.clinician as any;
    const status = String(clinician.status || 'pending').toLowerCase();

    const trainingCompleted = clinicianTrainingCompleted(clinician);
    const visibleToPatients = status === 'active';
    const simulationMode = trainingCompleted && !visibleToPatients;

    const canPractice =
      auth.role === 'admin' ||
      auth.role === 'admin_staff' ||
      visibleToPatients ||
      simulationMode;

    return json({
      ok: true,
      role: auth.role,
      clinicianId: auth.clinicianId,
      name: clinician.displayName ?? auth.session.name ?? 'Clinician',
      status,
      trainingCompleted,
      simulationMode,
      canPractice,
      visibleToPatients,
      clinician,
    });
  } catch (err: any) {
    console.error('/api/me error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'Unable to resolve clinician profile.',
      },
      500,
    );
  }
}
