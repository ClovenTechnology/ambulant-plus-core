// apps/api-gateway/app/api/patients/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, type Identity } from '@/src/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = Identity['role'];

function deny(json: any, status: number) {
  return NextResponse.json({ ok: false, ...json }, { status });
}

/**
 * Resolve which PatientProfile to load based on:
 * - role + uid from identity
 * - optional ?patientId= (PatientProfile.id)
 * - optional ?userId=   (PatientProfile.userId)
 *
 * Rules:
 * - patient role: always locked to their own profile (identity.uid)
 * - clinician/admin: must supply patientId or userId
 */
async function resolvePatientProfile(req: NextRequest, identity: Identity) {
  const url = new URL(req.url);
  const patientIdParam = url.searchParams.get('patientId') || undefined;
  const userIdParam = url.searchParams.get('userId') || undefined;

  let profile: any | null = null;

  if (!identity.role || !identity.uid) {
    throw deny({ error: 'unauthorized' }, 401);
  }

  if (identity.role === 'patient') {
    // Patients can only see their own profile, ignore any foreign patientId/userId
    const userId = identity.uid;
    profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });
  } else if (identity.role === 'clinician' || identity.role === 'admin') {
    if (patientIdParam) {
      profile = await prisma.patientProfile.findUnique({
        where: { id: patientIdParam },
      });
    } else if (userIdParam) {
      profile = await prisma.patientProfile.findUnique({
        where: { userId: userIdParam },
      });
    } else {
      throw deny(
        { error: 'patientId or userId query param is required for clinician/admin' },
        400,
      );
    }
  } else {
    throw deny({ error: 'forbidden' }, 403);
  }

  if (!profile) {
    throw deny({ error: 'Patient profile not found' }, 404);
  }

  return profile;
}

export async function GET(req: NextRequest) {
  const identity = readIdentity(req.headers);

  try {
    const profile = await resolvePatientProfile(req, identity);
    const patientId: string = profile.id;

    // Core longitudinal slices – keep light but useful
    const [
      conditions,
      vaccinations,
      operations,
      medications,
      encounters,
    ] = await Promise.all([
      prisma.condition.findMany({
        where: { patientId },
        orderBy: [{ createdAt: 'desc' }],
        take: 50,
      }),
      prisma.vaccination.findMany({
        where: { patientId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.operation.findMany({
        where: { patientId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
      prisma.medication.findMany({
        where: { patientId },
        orderBy: [{ createdAt: 'desc' }],
        take: 50,
      }),
      prisma.encounter.findMany({
        where: { patientId },
        orderBy: [{ createdAt: 'desc' }],
        take: 10,
      }),
    ]);

    const rawAllergies = (profile as any).allergies;
    const rawChronic = (profile as any).chronicConditions;

    const allergies: string[] = Array.isArray(rawAllergies)
      ? rawAllergies
      : [];

    const chronicConditions: string[] = Array.isArray(rawChronic)
      ? rawChronic
      : (
          conditions
            .filter((c) => c.status === 'Active')
            .map((c) => c.name)
        );

    const dob = (profile as any).dob;
    const dobISO =
      dob instanceof Date
        ? dob.toISOString().slice(0, 10)
        : typeof dob === 'string'
        ? dob
        : null;

    const profilePayload = {
      id: profile.id,
      patientId: profile.id,
      userId: profile.userId,
      name: profile.name,
      email: (profile as any).email ?? null,
      gender: (profile as any).gender ?? null,
      dob: dobISO,
      avatarUrl: (profile as any).avatarUrl ?? null,
      address: (profile as any).address ?? null,
      mobile: (profile as any).mobile ?? null,
      bloodType: (profile as any).bloodType ?? null,
      allergies,
      chronicConditions,
      primaryConditionsText: chronicConditions.length
        ? chronicConditions.join(', ')
        : null,
    };

    const historyCounts = {
      conditions: conditions.length,
      vaccinations: vaccinations.length,
      operations: operations.length,
      medications: medications.length,
      encounters: encounters.length,
    };

    return NextResponse.json(
      {
        ok: true,
        profile: profilePayload,
        conditions,
        vaccinations,
        operations,
        medications,
        encounters,
        historyCounts,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    if (err instanceof NextResponse) {
      // We used throw deny(...)
      return err;
    }
    console.error('[patients/profile] error', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load patient profile' },
      { status: 500 },
    );
  }
}
