import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const prisma =
  global.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') global.__prisma__ = prisma;

/**
 * POST /api/family/medical-aid/link
 * body: { relationshipId, hostPolicyId, dependentCode? }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      relationshipId?: string;
      hostPolicyId?: string;
      dependentCode?: string | null;
    };

    const relationshipId = String(body.relationshipId || '').trim();
    const hostPolicyId = String(body.hostPolicyId || '').trim();
    const dependentCode = body.dependentCode ?? null;

    if (!relationshipId || !hostPolicyId) {
      return NextResponse.json({ error: 'relationshipId and hostPolicyId are required' }, { status: 400 });
    }

    const userId = req.headers.get('x-uid') || req.headers.get('X-Uid') || '';
    if (!userId) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const rel = await prisma.familyRelationship.findUnique({ where: { id: relationshipId } });
    if (!rel || rel.hostUserId !== userId) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const hostPolicy = await prisma.medicalAidPolicy.findUnique({
      where: { id: hostPolicyId },
      include: { patient: true },
    });
    if (!hostPolicy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const hostPatient = await prisma.patientProfile.findFirst({ where: { userId } });
    if (!hostPatient || hostPatient.id !== hostPolicy.patientId) {
      return NextResponse.json({ error: 'Not your policy' }, { status: 403 });
    }

    const subjectPatientId = rel.subjectPatientId;

    const cloned = await prisma.medicalAidPolicy.create({
      data: {
        patientId: subjectPatientId,
        schemeName: hostPolicy.schemeName,
        planName: hostPolicy.planName,
        membershipNumber: hostPolicy.membershipNumber,
        principalName: hostPolicy.principalName || hostPatient.name || null,
        dependentCode: dependentCode,
        coversTelemedicine: hostPolicy.coversTelemedicine,
        telemedicineCoverType: hostPolicy.telemedicineCoverType,
        coPaymentType: hostPolicy.coPaymentType,
        coPaymentValue: hostPolicy.coPaymentValue,
        notes: hostPolicy.notes,
        isDefault: true,
      },
    });

    const prevPerm = (rel.permissions as any) || {};
    const nextPerm = {
      ...prevPerm,
      medicalAid: {
        ...(prevPerm.medicalAid || {}),
        canUseHostMedicalAid: true,
        hostPolicyId: hostPolicy.id,
        clonedPolicyId: cloned.id,
      },
    };

    const updatedRel = await prisma.familyRelationship.update({
      where: { id: rel.id },
      data: { permissions: nextPerm as any },
    });

    return NextResponse.json({
      dependantPolicy: cloned,
      relationship: updatedRel,
    });
  } catch (err: any) {
    console.error('link medical aid failed', err);
    return NextResponse.json({ error: err?.message || 'Failed to link medical aid' }, { status: 500 });
  }
}
