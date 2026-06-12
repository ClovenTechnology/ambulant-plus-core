import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function parseIso(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function normaliseMode(v: unknown): 'virtual' | 'in_person' {
  return String(v ?? '').trim().toLowerCase() === 'in_person'
    ? 'in_person'
    : 'virtual';
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

function mergeRawProfileTraining(raw: any, patch: Record<string, any>) {
  return {
    ...raw,
    onboarding: {
      ...(raw?.onboarding || {}),
      stage: 'training_scheduled',
    },
    training: {
      ...(raw?.training || {}),
      ...patch,
      status: 'scheduled',
    },
  };
}

function clinicianTrainingBaseUrl() {
  return String(
    process.env.CLINICIAN_APP_URL ||
      process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
      process.env.CLINICIAN_APP_ORIGIN ||
      'https://clinician.ambulantplus.co.za',
  ).replace(/\/+$/, '');
}

function trainingRoomIdForSlot(slotId: string) {
  const clean = String(slotId || '').trim();
  return clean.startsWith('training-slot-') ? clean : `training-slot-${clean}`;
}

function buildTrainingJoinUrl(slotId: string) {
  const roomId = trainingRoomIdForSlot(slotId);
  const url = new URL(`/training/room/${encodeURIComponent(roomId)}`, clinicianTrainingBaseUrl());
  url.searchParams.set('trainingSlotId', slotId);
  return url.toString();
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
    const startAt = parseIso(body.startAt);
    const endAt = parseIso(body.endAt);
    const mode = normaliseMode(body.mode);
    const requestedJoinUrl = cleanStr(body.joinUrl, 1000);
    const trainerName = cleanStr(body.trainerName, 240);

    if (!clinicianId || !onboardingId || !startAt || !endAt) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId, onboardingId, startAt, endAt required' },
        { status: 400 },
      );
    }

    if (endAt.getTime() <= startAt.getTime()) {
      return NextResponse.json(
        { ok: false, error: 'endAt_must_be_after_startAt' },
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

    if (String(onboarding.status || '').toLowerCase() === 'rejected') {
      return NextResponse.json(
        { ok: false, error: 'cannot_schedule_training_for_rejected_onboarding' },
        { status: 409 },
      );
    }

    let slot: any = null;

    if (onboarding.trainingSlotId) {
      const existing = await db.clinicianTrainingSlot.findUnique({
        where: { id: onboarding.trainingSlotId },
      });

      if (existing && String(existing.status || '').toLowerCase() === 'completed') {
        return NextResponse.json(
          { ok: false, error: 'completed_training_slot_cannot_be_rescheduled_here' },
          { status: 409 },
        );
      }

      if (existing) {
        slot = await db.clinicianTrainingSlot.update({
          where: { id: existing.id },
          data: {
            startsAt: startAt,
            endsAt: endAt,
            mode,
            meetingUrl: null,
            trainerName: trainerName || existing.trainerName || null,
          },
        });
      }
    }

    if (!slot) {
      slot = await db.clinicianTrainingSlot.create({
        data: {
          startsAt: startAt,
          endsAt: endAt,
          capacity: 1,
          usedCount: 1,
          mode,
          meetingUrl: null,
          trainerName: trainerName || null,
        },
      });
    }
    const autoJoinUrl =
      mode === 'virtual'
        ? requestedJoinUrl || buildTrainingJoinUrl(String(slot.id))
        : null;

    if (mode === 'virtual' && autoJoinUrl && String(slot?.meetingUrl || '') !== autoJoinUrl) {
      slot = await db.clinicianTrainingSlot.update({
        where: { id: slot.id },
        data: { meetingUrl: autoJoinUrl },
      });
    }

    const updatedOnboarding = await db.clinicianOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: 'training_scheduled',
        trainingSlotId: slot.id,
        trainingNotes: [
          cleanStr(onboarding.trainingNotes, 2000),
          `Training scheduled ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });

    const rawBase =
      safeParseJson((clinician as any)?.meta?.rawProfile) ||
      safeParseJson((clinician as any)?.meta?.rawProfileJson) ||
      safeParseJson((clinician as any)?.metadata?.rawProfile) ||
      safeParseJson((clinician as any)?.metadata?.rawProfileJson);

    const merged = mergeRawProfileTraining(rawBase, {
      startAt: slot.startsAt.toISOString(),
      endAt: slot.endsAt.toISOString(),
      mode,
      joinUrl: autoJoinUrl,
      trainerName: trainerName || null,
      bookedAt: new Date().toISOString(),
    });

    await persistRawProfileJson(db, clinicianId, clinician, merged);

    return NextResponse.json(
      {
        ok: true,
        clinicianId,
        onboarding: {
          id: String(updatedOnboarding.id),
          stage: 'training_scheduled',
          notes: cleanStr(updatedOnboarding.trainingNotes, 2000),
        },
        trainingSlot: {
          id: String(slot.id),
          startAt: slot.startsAt.toISOString(),
          endAt: slot.endsAt.toISOString(),
          mode,
          status: 'scheduled',
          joinUrl: autoJoinUrl,
        },
      },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][admin][clinicians][onboarding][schedule-training] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'schedule_training_failed') },
      { status: 500 },
    );
  }
}