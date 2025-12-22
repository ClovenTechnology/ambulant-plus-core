// apps/api-gateway/app/api/family/invitations/accept/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildPermissionsTemplate, ensurePatientProfileForUser, isMinor } from '../../_utils';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    const currentUserId = req.headers.get('x-uid');
    if (!currentUserId) return jsonError('Missing x-uid header', 401);

    const body = await req.json().catch(() => ({} as any));
    const token = String(body.token || '').trim();
    if (!token) return jsonError('token is required', 400);

    const invitation = await prisma.familyInvitation.findUnique({
      where: { token },
    });

    if (!invitation) return jsonError('Invitation not found', 404);
    if (invitation.status !== 'PENDING') return jsonError('Invitation is not pending', 400);
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return jsonError('Invitation has expired', 400);
    }

    // determine subjectPatientId
    let subjectPatientId = invitation.subjectPatientId ?? null;

    // host -> spouse/partner: subject is the accepting user
    const isSpouseLike =
      invitation.relationType === 'SPOUSE' || invitation.relationType === 'PARTNER';

    if (!subjectPatientId && isSpouseLike) {
      const subjectProfile = await ensurePatientProfileForUser(
        currentUserId,
        invitation.subjectName ?? undefined,
      );
      subjectPatientId = subjectProfile.id;

      // patch invitation to link to subjectPatientId for future reference
      await prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { subjectPatientId },
      });
    }

    // child / dependant: subject may be a new dependant profile
    const isDependantLike =
      invitation.relationType === 'CHILD' ||
      invitation.relationType === 'DEPENDANT' ||
      invitation.relationType === 'GUARDIAN';

    if (!subjectPatientId && isDependantLike) {
      // create a dependant profile with no userId
      const dependant = await prisma.patientProfile.create({
        data: {
          userId: null,
          name: invitation.subjectName ?? 'Dependant',
          dob: invitation.subjectDob ?? undefined,
        },
      });
      subjectPatientId = dependant.id;

      await prisma.familyInvitation.update({
        where: { id: invitation.id },
        data: { subjectPatientId },
      });
    }

    if (!subjectPatientId) {
      return jsonError(
        'Could not resolve subject patient from invitation; ensure subjectPatientId or subjectName is set.',
        500,
      );
    }

    // host + subject profiles
    const [hostProfile, subjectProfile] = await Promise.all([
      ensurePatientProfileForUser(invitation.hostUserId),
      prisma.patientProfile.findUnique({
        where: { id: subjectPatientId },
      }),
    ]);

    if (!subjectProfile) {
      return jsonError('Subject patient profile not found', 404);
    }

    const subjectIsMinor = isMinor(subjectProfile.dob ?? undefined);
    const permissions = buildPermissionsTemplate({
      relationType: invitation.relationType,
      direction: invitation.direction,
      subjectIsMinor,
    });

    const now = new Date();

    // Primary relationship: host acts for subject
    const hostRel = await prisma.familyRelationship.create({
      data: {
        hostUserId: invitation.hostUserId,
        subjectPatientId,
        subjectUserId: subjectProfile.userId ?? null,
        relationType: invitation.relationType,
        direction: invitation.direction,
        status: 'ACTIVE',
        permissions,
      },
    });

    const createdRelationshipIds: string[] = [hostRel.id];

    // For MUTUAL relationships (e.g. spouses), create reverse relationship
    if (invitation.direction === 'MUTUAL') {
      // ensure patient profile for accepting user
      const subjectUserProfile = await ensurePatientProfileForUser(currentUserId);

      const reversePermissions = buildPermissionsTemplate({
        relationType: invitation.relationType,
        direction: invitation.direction,
        subjectIsMinor: false, // mutual spouse scenario – treat as adult
      });

      const reverseRel = await prisma.familyRelationship.create({
        data: {
          hostUserId: currentUserId,
          subjectPatientId: hostProfile.id,
          subjectUserId: hostProfile.userId ?? null,
          relationType: invitation.relationType,
          direction: invitation.direction,
          status: 'ACTIVE',
          permissions: reversePermissions,
        },
      });

      createdRelationshipIds.push(reverseRel.id);
    }

    // Mark invitation as accepted
    await prisma.familyInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: now,
        acceptedByUserId: currentUserId,
      },
    });

    return NextResponse.json({
      ok: true,
      relationships: createdRelationshipIds,
      subjectPatientId,
    });
  } catch (err: any) {
    console.error('[family/invitations/accept] POST error', err);
    return jsonError(err?.message || 'Failed to accept invitation', 500);
  }
}
