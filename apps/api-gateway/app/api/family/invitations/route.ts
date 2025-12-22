// apps/api-gateway/app/api/family/invitations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const ALLOWED_RELATION_TYPES = [
  'SELF',
  'SPOUSE',
  'PARTNER',
  'PARENT',
  'CHILD',
  'GUARDIAN',
  'DEPENDANT',
  'FRIEND',
  'CARE_ALLY',
  'OTHER',
] as const;

const ALLOWED_DIRECTIONS = ['HOST_TO_SUBJECT', 'MUTUAL'] as const;

export async function POST(req: NextRequest) {
  try {
    const hostUserId = req.headers.get('x-uid');
    if (!hostUserId) return jsonError('Missing x-uid header', 401);

    const body = await req.json().catch(() => ({} as any));

    const relationType = String(body.relationType || '').toUpperCase();
    const direction = (String(body.direction || 'HOST_TO_SUBJECT') as string).toUpperCase();

    if (!ALLOWED_RELATION_TYPES.includes(relationType as any)) {
      return jsonError('Invalid relationType', 400);
    }
    if (!ALLOWED_DIRECTIONS.includes(direction as any)) {
      return jsonError('Invalid direction', 400);
    }

    const subjectPatientId = body.subjectPatientId ? String(body.subjectPatientId) : null;
    const invitedEmail =
      body.invitedEmail != null ? String(body.invitedEmail).trim().toLowerCase() : null;
    const invitedPhone = body.invitedPhone != null ? String(body.invitedPhone).trim() : null;

    const subjectName = body.subjectName ? String(body.subjectName).trim() : null;
    const subjectDob =
      body.subjectDob != null ? new Date(String(body.subjectDob)) : null;
    const subjectCategory = body.subjectCategory ? String(body.subjectCategory) : null;

    if (!subjectPatientId && !subjectName) {
      return jsonError(
        'Either subjectPatientId (existing profile) or subjectName (new dependant) is required',
        400,
      );
    }

    if (!invitedEmail && !invitedPhone) {
      return jsonError('invitedEmail or invitedPhone is required', 400);
    }

    // optional: ensure subjectPatientId exists if provided
    if (subjectPatientId) {
      const subject = await prisma.patientProfile.findUnique({
        where: { id: subjectPatientId },
        select: { id: true },
      });
      if (!subject) return jsonError('Subject patient not found', 404);
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const invitation = await prisma.familyInvitation.create({
      data: {
        token,
        hostUserId,
        relationType: relationType as any,
        direction: direction as any,
        subjectPatientId: subjectPatientId || undefined,
        subjectName: subjectName || undefined,
        subjectDob: subjectDob || undefined,
        subjectCategory: subjectCategory || undefined,
        invitedEmail: invitedEmail || undefined,
        invitedPhone: invitedPhone || undefined,
        status: 'PENDING',
        expiresAt,
      },
    });

    // TODO: send email/SMS with token or magic link

    return NextResponse.json({
      ok: true,
      invitation: {
        id: invitation.id,
        token: invitation.token,
        relationType: invitation.relationType,
        direction: invitation.direction,
        subjectPatientId: invitation.subjectPatientId,
        subjectName: invitation.subjectName,
        invitedEmail: invitation.invitedEmail,
        invitedPhone: invitation.invitedPhone,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[family/invitations] POST error', err);
    return jsonError(err?.message || 'Failed to create invitation', 500);
  }
}
