// apps/api-gateway/app/api/family/relationships/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const uid = req.headers.get('x-uid');
    if (!uid) return jsonError('Missing x-uid header', 401);

    // relationships where I'm the host (I act for others)
    const asHost = await prisma.familyRelationship.findMany({
      where: {
        hostUserId: uid,
        status: 'ACTIVE',
      },
      include: {
        subjectPatient: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // relationships where I'm the subject (others act for me)
    const asSubject = await prisma.familyRelationship.findMany({
      where: {
        subjectUserId: uid,
        status: 'ACTIVE',
      },
      include: {
        subjectPatient: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Optional: you can also infer asSubject by joining on PatientProfile.userId = uid
    // if you don't always set subjectUserId.

    return NextResponse.json({
      ok: true,
      asHost: asHost.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        direction: r.direction,
        subject: {
          patientId: r.subjectPatientId,
          userId: r.subjectUserId,
          name: r.subjectPatient.name,
          dob: r.subjectPatient.dob?.toISOString() ?? null,
          gender: r.subjectPatient.gender,
          city: r.subjectPatient.city,
        },
      })),
      asSubject: asSubject.map((r) => ({
        id: r.id,
        relationType: r.relationType,
        direction: r.direction,
        hostUserId: r.hostUserId,
        subject: {
          patientId: r.subjectPatientId,
          userId: r.subjectUserId,
          name: r.subjectPatient.name,
          dob: r.subjectPatient.dob?.toISOString() ?? null,
          gender: r.subjectPatient.gender,
          city: r.subjectPatient.city,
        },
      })),
    });
  } catch (err: any) {
    console.error('[family/relationships] GET error', err);
    return jsonError(err?.message || 'Failed to load family relationships', 500);
  }
}
