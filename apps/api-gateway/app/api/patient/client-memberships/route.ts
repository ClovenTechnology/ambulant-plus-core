// apps/api-gateway/app/api/patient/client-memberships/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ResolvePatientError = {
  ok: false;
  error: string;
  status: number;
};

type ResolvedPatient =
  | { ok: true; patient: NonNullable<Awaited<ReturnType<typeof findPatientProfile>>> }
  | { ok: false; error: ResolvePatientError };

function clean(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

async function findPatientProfile(uid: string) {
  return prisma.patientProfile.findFirst({
    where: {
      OR: [{ id: uid }, { userId: uid }],
    },
  });
}

async function resolvePatient(req: NextRequest): Promise<ResolvedPatient> {
  const who = readIdentity(req.headers);

  if (!who.uid || who.role !== 'patient') {
    return {
      ok: false,
      error: {
        ok: false,
        error: 'unauthorized',
        status: 401,
      },
    };
  }

  const patient = await findPatientProfile(who.uid);

  if (!patient) {
    return {
      ok: false,
      error: {
        ok: false,
        error: 'patient_not_found',
        status: 404,
      },
    };
  }

  return {
    ok: true,
    patient,
  };
}

export async function GET(req: NextRequest) {
  const resolved = await resolvePatient(req);

  if (!resolved.ok) {
    return NextResponse.json(resolved.error, { status: resolved.error.status });
  }

  const patient = resolved.patient;

  const items = await prisma.clientMember.findMany({
    where: { patientId: patient.id },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      client: {
        select: {
          id: true,
          type: true,
          legalName: true,
          tradingName: true,
          status: true,
          country: true,
          defaultCurrency: true,
          supportsTelevisit: true,
          supportsInPerson: true,
        },
      },
      coveragePlan: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      patientId: patient.id,
      items,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

export async function POST(req: NextRequest) {
  const resolved = await resolvePatient(req);

  if (!resolved.ok) {
    return NextResponse.json(resolved.error, { status: resolved.error.status });
  }

  const patient = resolved.patient;
  const body = await req.json().catch(() => ({} as any));

  const clientId = clean(body.clientId);
  const coveragePlanId = clean(body.coveragePlanId);
  const memberNumber = clean(body.memberNumber, 120);
  const dependentCode = clean(body.dependentCode, 40);
  const principalMemberName = clean(body.principalMemberName, 240);
  const relationship = clean(body.relationship, 80);

  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: 'clientId_required' },
      { status: 400 },
    );
  }

  if (!memberNumber) {
    return NextResponse.json(
      { ok: false, error: 'memberNumber_required' },
      { status: 400 },
    );
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client || client.status !== 'ACTIVE') {
    return NextResponse.json(
      { ok: false, error: 'client_not_active' },
      { status: 400 },
    );
  }

  let plan = null;

  if (coveragePlanId) {
    plan = await prisma.coveragePlan.findFirst({
      where: {
        id: coveragePlanId,
        clientId,
        status: 'ACTIVE',
      },
    });

    if (!plan) {
      return NextResponse.json(
        { ok: false, error: 'coverage_plan_not_active_for_client' },
        { status: 400 },
      );
    }
  }

  const existing = await prisma.clientMember.findFirst({
    where: {
      clientId,
      memberNumber,
      dependentCode,
      patientId: patient.id,
    },
  });

  const data: any = {
    clientId,
    coveragePlanId: plan?.id ?? null,
    patientId: patient.id,
    userId: patient.userId ?? null,
    memberKind: dependentCode && dependentCode !== '00' ? 'DEPENDANT' : 'PRINCIPAL',
    memberStatus: client.eligibilityMode === 'MANUAL' ? 'PENDING' : 'ACTIVE',
    memberNumber,
    dependentCode,
    principalMemberName,
    relationship,
    source: 'PATIENT_SELF_LINK',
    verificationState:
      client.eligibilityMode === 'UPLOAD' || client.eligibilityMode === 'API'
        ? 'PENDING'
        : 'MANUAL_REVIEW',
    televisitEligible: true,
    inPersonEligible: true,
    effectiveFrom: new Date(),
    payerPayload: {
      submittedBy: 'patient',
      clientType: client.type,
      eligibilityMode: client.eligibilityMode,
    },
  };

  const item = existing
    ? await prisma.clientMember.update({
        where: { id: existing.id },
        data,
        include: {
          client: true,
          coveragePlan: true,
        },
      })
    : await prisma.clientMember.create({
        data,
        include: {
          client: true,
          coveragePlan: true,
        },
      });

  return NextResponse.json(
    {
      ok: true,
      patientId: patient.id,
      clientMembership: item,
    },
    {
      status: existing ? 200 : 201,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}