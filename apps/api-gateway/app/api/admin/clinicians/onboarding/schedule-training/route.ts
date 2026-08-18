import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';
import {
  deliverClinicianTrainingNotification,
} from '@/src/clinicians/onboarding/training-notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrainingParticipantInput = {
  clinicianId: string;
  onboardingId: string;
};

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

function normaliseParticipants(body: any): TrainingParticipantInput[] {
  const fromArray = Array.isArray(body?.clinicians)
    ? body.clinicians
        .map((x: any) => ({
          clinicianId: cleanStr(x?.clinicianId, 120),
          onboardingId: cleanStr(x?.onboardingId, 120),
        }))
        .filter((x: any) => x.clinicianId && x.onboardingId)
    : [];

  const singleClinicianId = cleanStr(body?.clinicianId, 120);
  const singleOnboardingId = cleanStr(body?.onboardingId, 120);

  if (fromArray.length) {
    const seen = new Set<string>();
    return fromArray.filter((x: any) => {
      const key = `${x.clinicianId}:${x.onboardingId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }) as TrainingParticipantInput[];
  }

  if (singleClinicianId && singleOnboardingId) {
    return [{ clinicianId: singleClinicianId, onboardingId: singleOnboardingId }];
  }

  return [];
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

function clinicianTrainingCompleted(
  clinician: any,
  onboarding: any,
) {
  return (
    clinician?.trainingCompleted === true ||
    String(onboarding?.status || '')
      .trim()
      .toLowerCase() === 'training_completed'
  );
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (isAdmin.ok === false) {
      return isAdmin.response;
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const participants = normaliseParticipants(body);
    const startAt = parseIso(body.startAt);
    const endAt = parseIso(body.endAt);
    const mode = normaliseMode(body.mode);
    const requestedJoinUrl = cleanStr(body.joinUrl, 1000);
    const trainerName = cleanStr(body.trainerName, 240);

    if (!participants.length || !startAt || !endAt) {
      return NextResponse.json(
        { ok: false, error: 'clinicians, startAt, endAt required' },
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

    const clinicianIds = participants.map((p) => p.clinicianId);
    const onboardingIds = participants.map((p) => p.onboardingId);

    const [clinicians, onboardings] = await Promise.all([
      db.clinicianProfile.findMany({
        where: { id: { in: clinicianIds } },
      }),
      db.clinicianOnboarding.findMany({
        where: { id: { in: onboardingIds } },
      }),
    ]);

    const cliniciansById = new Map<string, any>(
      clinicians.map((c: any) => [String(c.id), c]),
    );
    const onboardingsById = new Map<string, any>(
      onboardings.map((o: any) => [String(o.id), o]),
    );

    for (const p of participants) {
      const clinician = cliniciansById.get(p.clinicianId);
      const onboarding = onboardingsById.get(p.onboardingId);

      if (!clinician) {
        return NextResponse.json(
          { ok: false, error: 'clinician_not_found', clinicianId: p.clinicianId },
          { status: 404 },
        );
      }

      if (!onboarding || String(onboarding.clinicianId) !== p.clinicianId) {
        return NextResponse.json(
          {
            ok: false,
            error: 'onboarding_not_found',
            clinicianId: p.clinicianId,
            onboardingId: p.onboardingId,
          },
          { status: 404 },
        );
      }

      const completed = clinicianTrainingCompleted(
        clinician,
        onboarding,
      );

      if (completed) {
        return NextResponse.json(
          {
            ok: false,
            error: 'completed_clinician_requires_training_invitation',
            clinicianId: p.clinicianId,
          },
          { status: 409 },
        );
      }

      if (
        String(onboarding.status || '').toLowerCase() === 'rejected'
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: 'cannot_schedule_training_for_rejected_onboarding',
            clinicianId: p.clinicianId,
          },
          { status: 409 },
        );
      }

      if (onboarding.trainingSlotId) {
        const existing = await db.clinicianTrainingSlot.findUnique({
          where: { id: onboarding.trainingSlotId },
        });

        if (
          existing &&
          String(existing.status || '').toLowerCase() === 'completed'
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: 'completed_training_slot_cannot_be_rescheduled_here',
              clinicianId: p.clinicianId,
              trainingSlotId: existing.id,
            },
            { status: 409 },
          );
        }
      }
    }

    const outcome = await db.$transaction(async (tx: any) => {
      /*
       * Mandatory Admin Calendar scheduling rule:
       * - One shared lightweight slot is created for the selected onboarding cohort.
       * - Every selected clinician receives an ASSIGNED participation with no acceptance step.
       * - ClinicianOnboarding.trainingSlotId remains the primary mandatory qualification pointer.
       * - Already-qualified clinicians must use the separate additional-training invitation path.
       */
      let slot = await tx.clinicianTrainingSlot.create({
        data: {
          title:
            cleanStr(body.title, 240) ||
            'Mandatory Clinician Training',
          summary:
            cleanStr(body.summary, 2000),
          status: 'published',
          startsAt: startAt,
          endsAt: endAt,
          timezone:
            cleanStr(body.timezone, 120) ||
            'Africa/Johannesburg',
          durationDays: 1,
          totalDurationMinutes: Math.max(
            1,
            Math.round(
              (endAt.getTime() - startAt.getTime()) /
                60000,
            ),
          ),
          capacity: Math.max(participants.length, 1),
          usedCount: participants.length,
          mode,
          allowedModes: [mode],
          sessions: [
            {
              id: 'session-1',
              dayNumber: 1,
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              mode,
            },
          ],
          meetingUrl: null,
          trainerName: trainerName || null,
          publishedAt: new Date(),
          publishedByUserId: isAdmin.uid,
        },
      });

      const autoJoinUrl =
        mode === 'virtual'
          ? requestedJoinUrl || buildTrainingJoinUrl(String(slot.id))
          : null;

      if (mode === 'virtual' && autoJoinUrl) {
        slot = await tx.clinicianTrainingSlot.update({
          where: { id: slot.id },
          data: { meetingUrl: autoJoinUrl },
        });
      }

      const updated: any[] = [];
      const changedAt = new Date();

      for (const p of participants) {
        const clinician = cliniciansById.get(p.clinicianId);
        const onboarding = onboardingsById.get(p.onboardingId);
        const qualificationTraining = true;
        const previousSlotId =
          cleanStr(onboarding.trainingSlotId, 120);

        if (
          qualificationTraining &&
          previousSlotId &&
          previousSlotId !== String(slot.id)
        ) {
          const oldAssignments =
            await tx.clinicianTrainingParticipantAssignment.findMany({
              where: {
                trainingSlotId: previousSlotId,
                principalType: 'clinician',
                principalId: p.clinicianId,
                status: {
                  in: ['assigned', 'accepted', 'invited'],
                },
              },
              select: { id: true },
            });
          const oldAssignmentIds = oldAssignments.map(
            (assignment: any) => String(assignment.id),
          );

          if (oldAssignmentIds.length) {
            await tx.clinicianTrainingAdmission.updateMany({
              where: {
                assignmentId: { in: oldAssignmentIds },
                revokedAt: null,
              },
              data: { revokedAt: changedAt },
            });
            await tx.clinicianTrainingParticipantAssignment.updateMany({
              where: { id: { in: oldAssignmentIds } },
              data: {
                status: 'revoked',
                revokedAt: changedAt,
              },
            });
          }

          await tx.$executeRaw`
            UPDATE "ClinicianTrainingSlot"
            SET
              "usedCount" = GREATEST(0, "usedCount" - 1),
              "updatedAt" = NOW()
            WHERE "id" = ${previousSlotId}
          `;
        }

        let updatedOnboarding = onboarding;

        if (qualificationTraining) {
          updatedOnboarding = await tx.clinicianOnboarding.update({
            where: { id: onboarding.id },
            data: {
              status: 'training_scheduled',
              trainingSlotId: slot.id,
              trainingMode: mode,
              trainingNotes: [
                cleanStr(onboarding.trainingNotes, 2000),
                `${previousSlotId ? 'Training reassigned' : 'Training scheduled'} ${changedAt.toISOString()}`,
                participants.length > 1
                  ? `Cohort training slot: ${slot.id}`
                  : null,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          });
        }

        const principalKey = `clinician:${p.clinicianId}`;
        const displayName =
          cleanStr(
            clinician.displayName ||
              clinician.fullName ||
              clinician.name ||
              clinician.email,
            240,
          ) || 'Clinician';

        const assignmentStatus = 'assigned';
        const assignmentSource = previousSlotId
          ? 'admin_reassignment'
          : 'admin_scheduling';

        const assignment =
          await tx.clinicianTrainingParticipantAssignment.upsert({
            where: {
              trainingSlotId_sessionKey_principalKey: {
                trainingSlotId: String(slot.id),
                sessionKey: 'slot',
                principalKey,
              },
            },
            create: {
              trainingSlotId: String(slot.id),
              sessionKey: 'slot',
              principalType: 'clinician',
              principalKey,
              principalId: p.clinicianId,
              email: cleanStr(clinician.email, 320),
              name: displayName,
              role: 'clinician',
              permissions: [
                'training:join',
                'training:attendance:self',
              ],
              status: assignmentStatus,
              assignedByUserId: isAdmin.uid,
              assignedAt: changedAt,
              invitedAt: null,
              acceptedAt: null,
              metadata: {
                source: assignmentSource,
                qualificationTraining,
                onboardingId: String(updatedOnboarding.id),
              },
            },
            update: {
              email: cleanStr(clinician.email, 320),
              name: displayName,
              permissions: [
                'training:join',
                'training:attendance:self',
              ],
              status: assignmentStatus,
              assignedByUserId: isAdmin.uid,
              assignedAt: changedAt,
              invitedAt: null,
              acceptedAt: null,
              revokedAt: null,
              expiresAt: null,
              metadata: {
                source: assignmentSource,
                qualificationTraining,
                onboardingId: String(updatedOnboarding.id),
              },
            },
          });

        updated.push({
          clinicianId: p.clinicianId,
          previousTrainingSlotId: previousSlotId,
          qualificationTraining,
          participation: {
            assignmentId: String(assignment.id),
            status: assignmentStatus,
            trainingSlotId: String(slot.id),
          },
          onboarding: {
            id: String(updatedOnboarding.id),
            stage: String(updatedOnboarding.status),
            notes: cleanStr(updatedOnboarding.trainingNotes, 2000),
          },
        });
      }

      return { slot, autoJoinUrl, updated, changedAt };
    }, { timeout: 30_000 });

    const { slot, autoJoinUrl, updated, changedAt } = outcome;

    // Legacy profile JSON remains a compatibility projection only for the
    // mandatory qualification event. Additional participation must not rewrite
    // a qualified clinician's completion/certificate projection.
    for (const p of participants) {
      const result = updated.find(
        (item: any) => item.clinicianId === p.clinicianId,
      );

      if (!result?.qualificationTraining) {
        continue;
      }

      const clinician = cliniciansById.get(p.clinicianId);
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
        trainingSlotId: slot.id,
        cohortSize: participants.length,
        bookedAt: changedAt.toISOString(),
      });

      await persistRawProfileJson(
        db,
        p.clinicianId,
        clinician,
        merged,
      );
    }

    const notifications: any[] = [];

    for (const p of participants) {
      const clinician = cliniciansById.get(p.clinicianId);
      const result = updated.find(
        (item: any) => item.clinicianId === p.clinicianId,
      );

      const notification =
        await deliverClinicianTrainingNotification({
          action: result?.previousTrainingSlotId
            ? 'rescheduled'
            : 'scheduled',
          recipientEmail: clinician?.email,
          recipientUserId:
            clinician?.userId || clinician?.email || null,
          recipientName:
            clinician?.displayName ||
            clinician?.fullName ||
            clinician?.name ||
            clinician?.email ||
            'Clinician',
          trainingSlotId: String(slot.id),
          title: slot.title,
          startsAt: new Date(slot.startsAt),
          endsAt: new Date(slot.endsAt),
          timezone: slot.timezone,
          mode,
          joinUrl: autoJoinUrl,
        });

      notifications.push({
        clinicianId: p.clinicianId,
        ...notification,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        cohort: participants.length > 1,
        clinicianId: participants[0]?.clinicianId || null,
        participants: updated,
        onboarding: updated[0]?.onboarding || null,
        notifications,
        notificationDeliveryRequired: true,
        trainingSlot: {
          id: String(slot.id),
          startAt: slot.startsAt.toISOString(),
          endAt: slot.endsAt.toISOString(),
          mode,
          status: 'scheduled',
          joinUrl: autoJoinUrl,
          roomId: trainingRoomIdForSlot(String(slot.id)),
          capacity: Math.max(participants.length, 1),
          usedCount: participants.length,
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
    console.error(
      '[api-gateway][admin][clinicians][onboarding][schedule-training] error',
      err,
    );
    return NextResponse.json(
      {
        ok: false,
        error: String(
          err?.message ||
            'schedule_training_failed',
        ),
      },
      { status: 500 },
    );
  }
}
