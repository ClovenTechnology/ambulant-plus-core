import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';
import { externalTrainingPrincipalKey } from '@/src/clinicians/onboarding/training-admission';
import {
  clinicianTrainingInvitationUrl,
  deliverTrainingParticipationEmail,
  externalObserverInvitationUrl,
  hashTrainingInvitationToken,
  normaliseTrainingInvitationEmail,
  randomTrainingInvitationToken,
  recordTrainingParticipationAudit,
  validTrainingInvitationEmail,
} from '@/src/clinicians/onboarding/training-invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 1200): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

function metadataObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function activeStatus(value: unknown) {
  return ['assigned', 'invited', 'accepted'].includes(
    String(value || '').trim().toLowerCase(),
  );
}

function slotUnavailable(slot: any) {
  return (
    !slot ||
    String(slot.status || '').trim().toLowerCase() === 'cancelled' ||
    Boolean(slot.cancelledAt) ||
    new Date(slot.endsAt).getTime() <= Date.now()
  );
}

function invitationExpiry(slot: any) {
  return new Date(new Date(slot.endsAt).getTime() + 60 * 60 * 1000);
}

async function publicSlotParticipants(db: any, trainingSlotId: string) {
  const [slot, assignments, mandatoryOnboardings] = await Promise.all([
    db.clinicianTrainingSlot.findUnique({
      where: { id: trainingSlotId },
    }),
    db.clinicianTrainingParticipantAssignment.findMany({
      where: { trainingSlotId },
      orderBy: [{ assignedAt: 'asc' }, { createdAt: 'asc' }],
    }),
    db.clinicianOnboarding.findMany({
      where: { trainingSlotId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!slot) return null;

  const onboardingByClinician = new Map<string, any>();
  for (const onboarding of mandatoryOnboardings) {
    const clinicianId = String(onboarding.clinicianId || '');
    if (clinicianId && !onboardingByClinician.has(clinicianId)) {
      onboardingByClinician.set(clinicianId, onboarding);
    }
  }

  const now = Date.now();

  return {
    trainingSlot: {
      id: String(slot.id),
      title: slot.title || 'Ambulant+ Training',
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      timezone: slot.timezone || 'Africa/Johannesburg',
      mode: slot.mode || 'virtual',
      status: String(slot.status || ''),
      cancelledAt: slot.cancelledAt?.toISOString?.() || null,
      meetingUrl: clean(slot.meetingUrl, 1600),
      capacity: Number(slot.capacity || 0),
      usedCount: Number(slot.usedCount || 0),
    },
    participants: assignments.map((assignment: any) => {
      const metadata = metadataObject(assignment.metadata);
      const clinicianId =
        assignment.principalType === 'clinician'
          ? clean(assignment.principalId, 240)
          : null;
      const mandatoryOnboarding =
        clinicianId && onboardingByClinician.has(clinicianId)
          ? onboardingByClinician.get(clinicianId)
          : null;
      const onboardingId =
        clean(metadata.onboardingId, 240) ||
        (mandatoryOnboarding ? String(mandatoryOnboarding.id) : null);
      const mandatoryQualification =
        metadata.qualificationTraining === true ||
        Boolean(
          mandatoryOnboarding &&
            String(mandatoryOnboarding.trainingSlotId || '') ===
              trainingSlotId,
        );
      const rawStatus = String(assignment.status || '').trim().toLowerCase();
      const effectiveStatus =
        !assignment.revokedAt &&
        assignment.expiresAt &&
        new Date(assignment.expiresAt).getTime() <= now &&
        activeStatus(rawStatus)
          ? 'expired'
          : rawStatus;

      return {
        assignmentId: String(assignment.id),
        trainingSlotId: String(assignment.trainingSlotId),
        sessionKey: String(assignment.sessionKey || 'slot'),
        principalType: String(assignment.principalType || ''),
        principalId: clean(assignment.principalId, 240),
        email: clean(assignment.email, 320),
        name: String(assignment.name || 'Participant'),
        organisation: clean(assignment.organisation, 240),
        department: clean(assignment.department, 240),
        designation: clean(assignment.designation, 240),
        role: String(assignment.role || ''),
        status: rawStatus,
        effectiveStatus,
        permissions: Array.isArray(assignment.permissions)
          ? assignment.permissions
          : [],
        mandatoryQualification,
        onboardingId,
        invitedAt: assignment.invitedAt?.toISOString?.() || null,
        acceptedAt: assignment.acceptedAt?.toISOString?.() || null,
        revokedAt: assignment.revokedAt?.toISOString?.() || null,
        expiresAt: assignment.expiresAt?.toISOString?.() || null,
        lastNotifiedAt: assignment.lastNotifiedAt?.toISOString?.() || null,
        canCopyCommonRoom:
          assignment.principalType === 'clinician' &&
          !assignment.revokedAt &&
          ['assigned', 'accepted'].includes(rawStatus),
        invitationKind:
          assignment.principalType === 'external_guest'
            ? 'external_secure'
            : assignment.principalType === 'clinician' &&
                rawStatus === 'invited'
              ? 'clinician_authenticated'
              : null,
      };
    }),
  };
}

async function reserveClinicianSeat(tx: any, trainingSlotId: string) {
  const rows: any[] = await tx.$queryRaw`
    UPDATE "ClinicianTrainingSlot"
    SET
      "usedCount" = "usedCount" + 1,
      "updatedAt" = NOW()
    WHERE
      "id" = ${trainingSlotId}
      AND "cancelledAt" IS NULL
      AND lower("status") <> 'cancelled'
      AND "usedCount" < "capacity"
    RETURNING "id", "usedCount", "capacity"
  `;

  if (!rows.length) {
    throw new Error('training_slot_full_or_unavailable');
  }
}

async function releaseClinicianSeat(tx: any, trainingSlotId: string) {
  await tx.$executeRaw`
    UPDATE "ClinicianTrainingSlot"
    SET
      "usedCount" = GREATEST(0, "usedCount" - 1),
      "updatedAt" = NOW()
    WHERE "id" = ${trainingSlotId}
  `;
}

async function latestClinicianOnboarding(db: any, clinicianId: string) {
  return db.clinicianOnboarding.findFirst({
    where: { clinicianId },
    orderBy: { createdAt: 'desc' },
  });
}

async function markLastNotified(assignmentId: string) {
  await (prisma as any).clinicianTrainingParticipantAssignment
    .update({
      where: { id: assignmentId },
      data: { lastNotifiedAt: new Date() },
    })
    .catch(() => {});
}

async function inviteClinician(
  admin: any,
  body: any,
  slot: any,
) {
  const clinicianId = clean(body?.clinicianId, 240);
  if (!clinicianId) {
    return json({ ok: false, error: 'clinicianId_required' }, 400);
  }

  const db: any = prisma;
  const [clinician, onboarding] = await Promise.all([
    db.clinicianProfile.findUnique({ where: { id: clinicianId } }),
    latestClinicianOnboarding(db, clinicianId),
  ]);

  if (!clinician) {
    return json({ ok: false, error: 'clinician_not_found' }, 404);
  }

  const trainingCompleted =
    clinician.trainingCompleted === true ||
    String(onboarding?.status || '').trim().toLowerCase() ===
      'training_completed';

  if (!trainingCompleted) {
    return json(
      {
        ok: false,
        error: 'optional_invitation_requires_qualified_clinician',
      },
      409,
    );
  }

  const principalKey = `clinician:${clinicianId}`;
  const now = new Date();
  const existing =
    await db.clinicianTrainingParticipantAssignment.findUnique({
      where: {
        trainingSlotId_sessionKey_principalKey: {
          trainingSlotId: String(slot.id),
          sessionKey: 'slot',
          principalKey,
        },
      },
    });

  if (
    existing &&
    !existing.revokedAt &&
    activeStatus(existing.status) &&
    (!existing.expiresAt ||
      new Date(existing.expiresAt).getTime() > Date.now())
  ) {
    return json(
      {
        ok: false,
        error: 'clinician_already_participating_in_training',
        assignmentId: String(existing.id),
        status: String(existing.status),
      },
      409,
    );
  }

  let assignment: any;

  try {
    assignment = await db.$transaction(async (tx: any) => {
      await reserveClinicianSeat(tx, String(slot.id));

      const data = {
        email: clean(clinician.email, 320),
        name:
          clean(
            clinician.displayName ||
              clinician.fullName ||
              clinician.name ||
              clinician.email,
            240,
          ) || 'Clinician',
        role: 'clinician',
        permissions: [
          'training:join',
          'training:attendance:self',
        ],
        status: 'invited',
        assignedByUserId: admin.uid,
        assignedAt: now,
        invitedAt: now,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: invitationExpiry(slot),
        invitationTokenHash: null,
        metadata: {
          source: 'admin_optional_invitation',
          qualificationTraining: false,
          onboardingId: onboarding?.id
            ? String(onboarding.id)
            : null,
        },
      };

      if (existing) {
        return tx.clinicianTrainingParticipantAssignment.update({
          where: { id: existing.id },
          data,
        });
      }

      return tx.clinicianTrainingParticipantAssignment.create({
        data: {
          trainingSlotId: String(slot.id),
          sessionKey: 'slot',
          principalType: 'clinician',
          principalKey,
          principalId: clinicianId,
          ...data,
        },
      });
    });
  } catch (error: any) {
    if (
      String(error?.message || '') ===
      'training_slot_full_or_unavailable'
    ) {
      return json(
        { ok: false, error: 'training_slot_full_or_unavailable' },
        409,
      );
    }
    throw error;
  }

  const link = clinicianTrainingInvitationUrl(String(assignment.id));
  const notification = await deliverTrainingParticipationEmail({
    kind: 'invitation',
    recipientEmail: assignment.email,
    recipientUserId:
      clinician.userId || clinician.email || clinician.id,
    recipientName: assignment.name,
    recipientRole: 'clinician',
    assignmentId: String(assignment.id),
    trainingSlotId: String(slot.id),
    title: slot.title,
    startsAt: new Date(slot.startsAt),
    endsAt: new Date(slot.endsAt),
    timezone: slot.timezone,
    link,
  });

  await markLastNotified(String(assignment.id));
  await recordTrainingParticipationAudit(
    'training.participation.invite_clinician',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      assignmentId: String(assignment.id),
      trainingSlotId: String(slot.id),
      description: 'Optional clinician training invitation created.',
      meta: { clinicianId, notificationStatus: notification.status },
    },
  );

  return json({
    ok: true,
    assignmentId: String(assignment.id),
    status: 'invited',
    invitation: {
      kind: 'clinician_authenticated',
      link,
    },
    notification,
  });
}

async function inviteObserver(
  admin: any,
  body: any,
  slot: any,
) {
  const email = normaliseTrainingInvitationEmail(body?.email);
  const name = clean(body?.name, 240) || email;
  const organisation = clean(body?.organisation, 240);
  const department = clean(body?.department, 240);
  const designation = clean(body?.designation, 240);

  if (!validTrainingInvitationEmail(email)) {
    return json({ ok: false, error: 'observer_email_required' }, 400);
  }

  const principalKey = externalTrainingPrincipalKey(email);
  const db: any = prisma;
  const existing =
    await db.clinicianTrainingParticipantAssignment.findUnique({
      where: {
        trainingSlotId_sessionKey_principalKey: {
          trainingSlotId: String(slot.id),
          sessionKey: 'slot',
          principalKey,
        },
      },
    });

  if (
    existing &&
    !existing.revokedAt &&
    activeStatus(existing.status) &&
    (!existing.expiresAt ||
      new Date(existing.expiresAt).getTime() > Date.now())
  ) {
    return json(
      {
        ok: false,
        error: 'observer_already_participating_in_training',
        assignmentId: String(existing.id),
        status: String(existing.status),
      },
      409,
    );
  }

  const now = new Date();
  const rawToken = randomTrainingInvitationToken();
  const invitationTokenHash =
    hashTrainingInvitationToken(rawToken);
  const data = {
    email,
    name: name || 'External observer',
    organisation,
    department,
    designation,
    role: 'observer',
    permissions: ['training:join', 'training:observe'],
    status: 'invited',
    assignedByUserId: admin.uid,
    assignedAt: now,
    invitedAt: now,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: invitationExpiry(slot),
    invitationTokenHash,
    metadata: {
      source: 'admin_external_observer_invitation',
      qualificationTraining: false,
    },
  };

  const assignment = existing
    ? await db.clinicianTrainingParticipantAssignment.update({
        where: { id: existing.id },
        data,
      })
    : await db.clinicianTrainingParticipantAssignment.create({
        data: {
          trainingSlotId: String(slot.id),
          sessionKey: 'slot',
          principalType: 'external_guest',
          principalKey,
          principalId: null,
          ...data,
        },
      });

  const link = externalObserverInvitationUrl(rawToken);
  const notification = body?.sendEmail === false
    ? { ok: true, status: 'skipped', error: null }
    : await deliverTrainingParticipationEmail({
        kind: 'invitation',
        recipientEmail: email,
        recipientName: assignment.name,
        recipientRole: 'observer',
        assignmentId: String(assignment.id),
        trainingSlotId: String(slot.id),
        title: slot.title,
        startsAt: new Date(slot.startsAt),
        endsAt: new Date(slot.endsAt),
        timezone: slot.timezone,
        link,
      });

  if (body?.sendEmail !== false) {
    await markLastNotified(String(assignment.id));
  }

  await recordTrainingParticipationAudit(
    'training.participation.invite_external_observer',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      assignmentId: String(assignment.id),
      trainingSlotId: String(slot.id),
      description: 'External observer training invitation created.',
      meta: { notificationStatus: notification.status },
    },
  );

  return json({
    ok: true,
    assignmentId: String(assignment.id),
    status: 'invited',
    oneTime: {
      kind: 'external_secure',
      link,
    },
    notification,
  });
}

async function issueCopyLink(
  admin: any,
  body: any,
) {
  const assignmentId = clean(body?.assignmentId, 240);
  if (!assignmentId) {
    return json({ ok: false, error: 'assignmentId_required' }, 400);
  }

  const db: any = prisma;
  const assignment =
    await db.clinicianTrainingParticipantAssignment.findUnique({
      where: { id: assignmentId },
      include: { trainingSlot: true },
    });

  if (!assignment) {
    return json({ ok: false, error: 'training_assignment_not_found' }, 404);
  }

  if (
    assignment.revokedAt ||
    ['revoked', 'expired'].includes(
      String(assignment.status || '').toLowerCase(),
    )
  ) {
    return json({ ok: false, error: 'training_assignment_inactive' }, 409);
  }

  if (slotUnavailable(assignment.trainingSlot)) {
    return json({ ok: false, error: 'training_slot_unavailable' }, 409);
  }

  let link: string;
  let kind: string;

  if (
    assignment.principalType === 'external_guest' &&
    assignment.role === 'observer'
  ) {
    const rawToken = randomTrainingInvitationToken();
    await db.clinicianTrainingParticipantAssignment.update({
      where: { id: assignmentId },
      data: {
        invitationTokenHash: hashTrainingInvitationToken(rawToken),
        expiresAt: invitationExpiry(assignment.trainingSlot),
      },
    });
    link = externalObserverInvitationUrl(rawToken);
    kind = 'external_secure';
  } else if (
    assignment.principalType === 'clinician' &&
    String(assignment.status).toLowerCase() === 'invited'
  ) {
    link = clinicianTrainingInvitationUrl(assignmentId);
    kind = 'clinician_authenticated';
  } else {
    return json(
      {
        ok: false,
        error: 'copy_invitation_link_not_available_for_assignment',
      },
      409,
    );
  }

  await recordTrainingParticipationAudit(
    'training.participation.issue_copy_link',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      assignmentId,
      trainingSlotId: String(assignment.trainingSlotId),
      description: 'Training invitation link issued for manual delivery.',
      meta: { kind },
    },
  );

  return json({
    ok: true,
    assignmentId,
    oneTime: { kind, link },
  });
}

async function resendInvitation(
  admin: any,
  body: any,
) {
  const assignmentId = clean(body?.assignmentId, 240);
  if (!assignmentId) {
    return json({ ok: false, error: 'assignmentId_required' }, 400);
  }

  const db: any = prisma;
  const assignment =
    await db.clinicianTrainingParticipantAssignment.findUnique({
      where: { id: assignmentId },
      include: { trainingSlot: true },
    });

  if (!assignment) {
    return json({ ok: false, error: 'training_assignment_not_found' }, 404);
  }

  if (
    assignment.revokedAt ||
    ['revoked', 'expired'].includes(
      String(assignment.status || '').toLowerCase(),
    ) ||
    slotUnavailable(assignment.trainingSlot)
  ) {
    return json({ ok: false, error: 'training_assignment_inactive' }, 409);
  }

  let link: string;
  let kind: 'clinician_authenticated' | 'external_secure';

  if (
    assignment.principalType === 'external_guest' &&
    assignment.role === 'observer'
  ) {
    const rawToken = randomTrainingInvitationToken();
    await db.clinicianTrainingParticipantAssignment.update({
      where: { id: assignmentId },
      data: {
        invitationTokenHash: hashTrainingInvitationToken(rawToken),
        expiresAt: invitationExpiry(assignment.trainingSlot),
      },
    });
    link = externalObserverInvitationUrl(rawToken);
    kind = 'external_secure';
  } else if (assignment.principalType === 'clinician') {
    if (String(assignment.status).toLowerCase() !== 'invited') {
      return json(
        { ok: false, error: 'clinician_invitation_is_not_pending' },
        409,
      );
    }
    link = clinicianTrainingInvitationUrl(assignmentId);
    kind = 'clinician_authenticated';
  } else {
    return json(
      { ok: false, error: 'training_invitation_not_resendable' },
      409,
    );
  }

  const notification = await deliverTrainingParticipationEmail({
    kind: 'invitation',
    recipientEmail: assignment.email,
    recipientUserId:
      assignment.principalType === 'clinician'
        ? assignment.principalId
        : null,
    recipientName: assignment.name,
    recipientRole:
      assignment.role === 'observer' ? 'observer' : 'clinician',
    assignmentId,
    trainingSlotId: String(assignment.trainingSlotId),
    title: assignment.trainingSlot.title,
    startsAt: new Date(assignment.trainingSlot.startsAt),
    endsAt: new Date(assignment.trainingSlot.endsAt),
    timezone: assignment.trainingSlot.timezone,
    link,
  });

  await markLastNotified(assignmentId);
  await recordTrainingParticipationAudit(
    'training.participation.resend_invitation',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      assignmentId,
      trainingSlotId: String(assignment.trainingSlotId),
      description: 'Training invitation resent.',
      meta: { kind, notificationStatus: notification.status },
    },
  );

  return json({
    ok: true,
    assignmentId,
    oneTime: { kind, link },
    notification,
  });
}

async function revokeOptionalParticipation(
  admin: any,
  body: any,
) {
  const assignmentId = clean(body?.assignmentId, 240);
  if (!assignmentId) {
    return json({ ok: false, error: 'assignmentId_required' }, 400);
  }

  const db: any = prisma;
  const assignment =
    await db.clinicianTrainingParticipantAssignment.findUnique({
      where: { id: assignmentId },
      include: { trainingSlot: true },
    });

  if (!assignment) {
    return json({ ok: false, error: 'training_assignment_not_found' }, 404);
  }

  const metadata = metadataObject(assignment.metadata);
  const onboarding =
    assignment.principalType === 'clinician' &&
    assignment.principalId
      ? await latestClinicianOnboarding(
          db,
          String(assignment.principalId),
        )
      : null;

  const mandatoryQualification =
    metadata.qualificationTraining === true ||
    Boolean(
      onboarding?.trainingSlotId &&
        String(onboarding.trainingSlotId) ===
          String(assignment.trainingSlotId) &&
        String(onboarding.status || '').toLowerCase() !==
          'training_completed',
    );

  if (mandatoryQualification) {
    return json(
      {
        ok: false,
        error: 'mandatory_training_requires_clinician_cancel_route',
      },
      409,
    );
  }

  if (
    assignment.revokedAt ||
    ['revoked', 'expired'].includes(
      String(assignment.status || '').toLowerCase(),
    )
  ) {
    return json({ ok: true, assignmentId, status: 'revoked' });
  }

  const now = new Date();

  await db.$transaction(async (tx: any) => {
    await tx.clinicianTrainingAdmission.updateMany({
      where: { assignmentId, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.clinicianTrainingParticipantAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'revoked',
        revokedAt: now,
        invitationTokenHash: null,
      },
    });

    if (assignment.principalType === 'clinician') {
      await releaseClinicianSeat(
        tx,
        String(assignment.trainingSlotId),
      );
    }
  });

  const notification = assignment.email
    ? await deliverTrainingParticipationEmail({
        kind: 'cancelled',
        recipientEmail: assignment.email,
        recipientUserId:
          assignment.principalType === 'clinician'
            ? assignment.principalId
            : null,
        recipientName: assignment.name,
        recipientRole:
          assignment.role === 'observer' ? 'observer' : 'clinician',
        assignmentId,
        trainingSlotId: String(assignment.trainingSlotId),
        title: assignment.trainingSlot?.title,
        startsAt: new Date(assignment.trainingSlot?.startsAt),
        endsAt: new Date(assignment.trainingSlot?.endsAt),
        timezone: assignment.trainingSlot?.timezone,
      })
    : { ok: true, status: 'skipped', error: null };

  await recordTrainingParticipationAudit(
    'training.participation.revoke',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      assignmentId,
      trainingSlotId: String(assignment.trainingSlotId),
      description: 'Optional training participation revoked.',
      meta: {
        principalType: assignment.principalType,
        role: assignment.role,
        notificationStatus: notification.status,
      },
    },
  );

  return json({
    ok: true,
    assignmentId,
    status: 'revoked',
    revokedAt: now.toISOString(),
    notification,
  });
}

async function cancelEntireSession(
  admin: any,
  body: any,
  slot: any,
) {
  const db: any = prisma;
  const trainingSlotId = String(slot.id);
  const now = new Date();

  const [assignments, incompleteOnboardings] = await Promise.all([
    db.clinicianTrainingParticipantAssignment.findMany({
      where: {
        trainingSlotId,
        revokedAt: null,
        status: { in: ['assigned', 'invited', 'accepted'] },
      },
    }),
    db.clinicianOnboarding.findMany({
      where: {
        trainingSlotId,
        status: { not: 'training_completed' },
      },
    }),
  ]);

  const clinicianIds = incompleteOnboardings
    .map((row: any) => String(row.clinicianId || ''))
    .filter(Boolean);

  await db.$transaction(async (tx: any) => {
    await tx.clinicianTrainingAdmission.updateMany({
      where: { trainingSlotId, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.clinicianTrainingParticipantAssignment.updateMany({
      where: {
        trainingSlotId,
        revokedAt: null,
        status: { in: ['assigned', 'invited', 'accepted'] },
      },
      data: {
        status: 'revoked',
        revokedAt: now,
        invitationTokenHash: null,
      },
    });

    await tx.clinicianTrainingSlot.update({
      where: { id: trainingSlotId },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelledByUserId: admin.uid,
        usedCount: 0,
      },
    });

    if (incompleteOnboardings.length) {
      await tx.clinicianOnboarding.updateMany({
        where: {
          id: {
            in: incompleteOnboardings.map((row: any) =>
              String(row.id),
            ),
          },
        },
        data: {
          status: 'approved',
          trainingSlotId: null,
          trainingMode: null,
        },
      });
    }

    if (clinicianIds.length) {
      await tx.clinicianProfile.updateMany({
        where: { id: { in: clinicianIds } },
        data: { trainingScheduledAt: null },
      });
    }
  });

  const notifications: any[] = [];
  for (const assignment of assignments) {
    if (!assignment.email) continue;

    const notification = await deliverTrainingParticipationEmail({
      kind: 'cancelled',
      recipientEmail: assignment.email,
      recipientUserId:
        assignment.principalType === 'clinician'
          ? assignment.principalId
          : null,
      recipientName: assignment.name,
      recipientRole:
        assignment.role === 'observer'
          ? 'observer'
          : assignment.role === 'patient'
            ? 'patient'
            : 'clinician',
      assignmentId: String(assignment.id),
      trainingSlotId,
      title: slot.title,
      startsAt: new Date(slot.startsAt),
      endsAt: new Date(slot.endsAt),
      timezone: slot.timezone,
    });

    notifications.push({
      assignmentId: String(assignment.id),
      status: notification.status,
    });
  }

  await recordTrainingParticipationAudit(
    'training.session.cancel',
    {
      actorUserId: admin.uid,
      actorType: 'admin',
      trainingSlotId,
      description: 'Entire training session cancelled by Admin.',
      meta: {
        assignmentCount: assignments.length,
        onboardingReleased: incompleteOnboardings.length,
      },
    },
  );

  return json({
    ok: true,
    trainingSlotId,
    status: 'cancelled',
    cancelledAt: now.toISOString(),
    participantAssignmentsRevoked: assignments.length,
    mandatoryOnboardingsReleased: incompleteOnboardings.length,
    notifications,
  });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (admin.ok === false) return admin.response;

  try {
    const trainingSlotId = clean(
      request.nextUrl.searchParams.get('trainingSlotId'),
      240,
    );

    if (!trainingSlotId) {
      return json(
        { ok: false, error: 'trainingSlotId_required' },
        400,
      );
    }

    const payload = await publicSlotParticipants(
      prisma as any,
      trainingSlotId,
    );

    if (!payload) {
      return json({ ok: false, error: 'training_slot_not_found' }, 404);
    }

    return json({ ok: true, ...payload });
  } catch (error: any) {
    console.error('[admin-training-participations][GET] failed', error);
    return json(
      {
        ok: false,
        error:
          clean(error?.message, 1000) ||
          'training_participations_unavailable',
      },
      500,
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (admin.ok === false) return admin.response;

  try {
    const body = await request.json().catch(() => ({} as any));
    const action = String(body?.action || '')
      .trim()
      .toLowerCase();

    if (
      ['issue_copy_link', 'resend_invitation', 'revoke_participation'].includes(
        action,
      )
    ) {
      if (action === 'issue_copy_link') {
        return issueCopyLink(admin, body);
      }
      if (action === 'resend_invitation') {
        return resendInvitation(admin, body);
      }
      return revokeOptionalParticipation(admin, body);
    }

    const trainingSlotId = clean(body?.trainingSlotId, 240);
    if (!trainingSlotId) {
      return json(
        { ok: false, error: 'trainingSlotId_required' },
        400,
      );
    }

    const slot = await (prisma as any).clinicianTrainingSlot.findUnique({
      where: { id: trainingSlotId },
    });

    if (!slot) {
      return json({ ok: false, error: 'training_slot_not_found' }, 404);
    }

    if (action !== 'cancel_session' && slotUnavailable(slot)) {
      return json({ ok: false, error: 'training_slot_unavailable' }, 409);
    }

    if (action === 'invite_clinician') {
      return inviteClinician(admin, body, slot);
    }

    if (action === 'invite_observer') {
      return inviteObserver(admin, body, slot);
    }

    if (action === 'cancel_session') {
      if (
        String(slot.status || '').toLowerCase() === 'cancelled' ||
        slot.cancelledAt
      ) {
        return json({
          ok: true,
          trainingSlotId,
          status: 'cancelled',
          alreadyCancelled: true,
        });
      }

      return cancelEntireSession(admin, body, slot);
    }

    return json(
      {
        ok: false,
        error:
          'action_must_be_invite_clinician_invite_observer_issue_copy_link_resend_invitation_revoke_participation_or_cancel_session',
      },
      400,
    );
  } catch (error: any) {
    console.error('[admin-training-participations][POST] failed', error);

    const message =
      clean(error?.message, 1000) ||
      'training_participation_action_failed';

    return json(
      {
        ok: false,
        error: message,
      },
      message === 'training_slot_full_or_unavailable' ? 409 : 500,
    );
  }
}
