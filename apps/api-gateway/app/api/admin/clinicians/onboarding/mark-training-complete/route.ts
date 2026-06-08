import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';
import { computeClinicianActivationState } from '@/src/lib/clinician-activation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function safeParseJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function pushUniqueQualification(list: any[], nextItem: any) {
  const rows = Array.isArray(list) ? [...list] : [];
  const fingerprint = JSON.stringify({
    degree: nextItem?.degree ?? '',
    institution: nextItem?.institution ?? '',
    yearOfCompletion: nextItem?.yearOfCompletion ?? '',
  });

  const exists = rows.some(
    (row) =>
      JSON.stringify({
        degree: row?.degree ?? '',
        institution: row?.institution ?? '',
        yearOfCompletion: row?.yearOfCompletion ?? '',
      }) === fingerprint,
  );

  if (!exists) rows.push(nextItem);
  return rows;
}

async function persistRawProfileJson(db: any, clinicianId: string, clinician: any, profileJson: any) {
  const rawProfileJson = JSON.stringify(profileJson);

  try {
    const nextMeta =
      clinician?.meta && typeof clinician.meta === 'object'
        ? {
            ...(clinician.meta || {}),
            rawProfile: profileJson,
            rawProfileJson,
          }
        : {
            rawProfile: profileJson,
            rawProfileJson,
          };

    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: { meta: nextMeta },
    });
    return true;
  } catch {}

  try {
    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        metadata: clinician?.metadata
          ? { update: { rawProfileJson, rawProfile: profileJson } }
          : { create: { rawProfileJson, rawProfile: profileJson } },
      },
    });
    return true;
  } catch {}

  try {
    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: { rawProfileJson },
    });
    return true;
  } catch {}

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (isAdmin.ok === false) {
      return isAdmin.response;
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 120);
    const onboardingId = cleanStr(body.onboardingId, 120);
    const trainingSlotId = cleanStr(body.trainingSlotId, 120);
    const certificateNumber =
      cleanStr(body.certificateNumber, 120) ||
      `AMB-TRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(
        clinicianId || '',
      ).slice(-6).toUpperCase()}`;

    if (!clinicianId || !onboardingId || !trainingSlotId) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId, onboardingId, trainingSlotId required' },
        { status: 400 },
      );
    }

    const db: any = prisma;

    const clinician = await db.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });
    if (!clinician) {
      return NextResponse.json(
        { ok: false, error: 'clinician_not_found' },
        { status: 404 },
      );
    }

    const onboarding = await db.clinicianOnboarding.findUnique({
      where: { id: onboardingId },
    });
    if (!onboarding || String(onboarding.clinicianId) !== clinicianId) {
      return NextResponse.json(
        { ok: false, error: 'onboarding_not_found' },
        { status: 404 },
      );
    }

    if (String(onboarding.trainingSlotId || '') !== trainingSlotId) {
      return NextResponse.json(
        { ok: false, error: 'training_slot_mismatch' },
        { status: 409 },
      );
    }

    const slot = await db.clinicianTrainingSlot.findUnique({
      where: { id: trainingSlotId },
    });
    if (!slot) {
      return NextResponse.json(
        { ok: false, error: 'training_slot_not_found' },
        { status: 404 },
      );
    }

    // ✅ FIX: do NOT write status to DB (schema does not support it)
    const completedSlot = slot;

    const completedOnboarding = await db.clinicianOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: 'training_completed',
        trainingNotes: [
          cleanStr(onboarding.trainingNotes, 2000),
          `Training completed ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        trainingCompleted: true,
      },
    });

    const rawBase =
      safeParseJson((clinician as any)?.meta?.rawProfile) ||
      safeParseJson((clinician as any)?.meta?.rawProfileJson) ||
      safeParseJson((clinician as any)?.metadata?.rawProfile) ||
      safeParseJson((clinician as any)?.metadata?.rawProfileJson);

    const issueDateIso = new Date().toISOString();
    const qualificationRow = {
      degree: 'Ambulant+ Mandatory Clinician Training',
      institution: 'Ambulant+ / Cloven Technology',
      yearOfCompletion: String(new Date().getFullYear()),
      certificateNumber,
      completedAt: issueDateIso,
      trainingSlotId,
    };

    const merged = {
      ...rawBase,
      onboarding: {
        ...(rawBase?.onboarding || {}),
        stage: 'training_completed',
      },
      training: {
        ...(rawBase?.training || {}),
        status: 'completed',
        completedAt: issueDateIso,
        certificateNumber,
        startAt: completedSlot.startsAt
          ? new Date(completedSlot.startsAt).toISOString()
          : rawBase?.training?.startAt ?? null,
        endAt: completedSlot.endsAt
          ? new Date(completedSlot.endsAt).toISOString()
          : rawBase?.training?.endAt ?? null,
        mode: completedSlot.mode ?? rawBase?.training?.mode ?? null,
        joinUrl: completedSlot.meetingUrl ?? rawBase?.training?.joinUrl ?? null,
      },
      compliance: {
        ...(rawBase?.compliance || {}),
        training: {
          ...((rawBase?.compliance || {})?.training || {}),
          status: 'completed',
          completedAt: issueDateIso,
          certificateNumber,
        },
      },
      additionalQualifications: pushUniqueQualification(
        Array.isArray(rawBase?.additionalQualifications)
          ? rawBase.additionalQualifications
          : [],
        qualificationRow,
      ),
    };

    await persistRawProfileJson(db, clinicianId, clinician, merged);

    const dispatch = await db.clinicianDispatch.findFirst({
      where: { clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    const activation = computeClinicianActivationState({
      clinician: {
        ...clinician,
        trainingCompleted: true,
        meta: {
          ...(clinician?.meta || {}),
          rawProfile: merged,
          rawProfileJson: JSON.stringify(merged),
        },
      },
      onboarding: completedOnboarding,
      trainingSlot: completedSlot,
      dispatch,
    });

    return NextResponse.json(
      {
        ok: true,
        clinicianId,
        trainingCompleted: true,
        certificate: {
          certificateNumber,
          issuedAt: issueDateIso,
        },
        onboarding: {
          id: String(completedOnboarding.id),
          stage: 'training_completed',
          notes: cleanStr(completedOnboarding.trainingNotes, 2000),
        },
        trainingSlot: {
          id: String(completedSlot.id),
          startAt: completedSlot.startsAt
            ? new Date(completedSlot.startsAt).toISOString()
            : null,
          endAt: completedSlot.endsAt
            ? new Date(completedSlot.endsAt).toISOString()
            : null,
          mode:
            String(completedSlot.mode || '').trim().toLowerCase() === 'in_person'
              ? 'in_person'
              : 'virtual',
          status: 'completed',
          joinUrl: cleanStr(completedSlot.meetingUrl, 1000),
        },
        activation,
      },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][admin][clinicians][onboarding][mark-training-complete] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'mark_training_complete_failed') },
      { status: 500 },
    );
  }
}