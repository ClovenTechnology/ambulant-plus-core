import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function appBase(req: NextRequest) {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    req.nextUrl.origin;
  return trimSlash(base);
}

function forwardAuthHeaders(req: NextRequest) {
  const headers = new Headers();
  const forwardKeys = ['cookie', 'authorization', 'x-ambulant-identity', 'x-uid', 'x-role'];
  for (const key of forwardKeys) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set('accept', 'application/json');
  if (!headers.get('x-role')) headers.set('x-role', 'patient');
  return headers;
}

async function resolvePatientId(req: NextRequest): Promise<string | null> {
  try {
    const base = appBase(req);
    const url = new URL('/api/profile', base);

    const res = await fetch(url.toString(), {
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    const patientId = String(data?.patientId || data?.id || '').trim();
    return patientId || null;
  } catch {
    return null;
  }
}

type TeamAggregate = {
  clinicianUserId: string;
  latestAt: number;
  encounterCount: number;
  appointmentCount: number;
};

export async function GET(req: NextRequest) {
  try {
    const patientId = await resolvePatientId(req);

    if (!patientId) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const [encounters, appointments] = await Promise.all([
      prisma.encounter.findMany({
        where: { patientId },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        select: {
          clinicianId: true,
          updatedAt: true,
          createdAt: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          OR: [{ patientId }, { subjectPatientId: patientId }],
        },
        orderBy: { startsAt: 'desc' },
        take: 100,
        select: {
          clinicianId: true,
          startsAt: true,
          createdAt: true,
        },
      }),
    ]);

    const bucket = new Map<string, TeamAggregate>();

    for (const row of encounters) {
      const clinicianUserId = String(row.clinicianId || '').trim();
      if (!clinicianUserId) continue;

      const at = new Date(row.updatedAt || row.createdAt || new Date()).getTime();
      const prev = bucket.get(clinicianUserId);

      if (!prev) {
        bucket.set(clinicianUserId, {
          clinicianUserId,
          latestAt: at,
          encounterCount: 1,
          appointmentCount: 0,
        });
      } else {
        prev.latestAt = Math.max(prev.latestAt, at);
        prev.encounterCount += 1;
      }
    }

    for (const row of appointments) {
      const clinicianUserId = String(row.clinicianId || '').trim();
      if (!clinicianUserId) continue;

      const at = new Date(row.startsAt || row.createdAt || new Date()).getTime();
      const prev = bucket.get(clinicianUserId);

      if (!prev) {
        bucket.set(clinicianUserId, {
          clinicianUserId,
          latestAt: at,
          encounterCount: 0,
          appointmentCount: 1,
        });
      } else {
        prev.latestAt = Math.max(prev.latestAt, at);
        prev.appointmentCount += 1;
      }
    }

    const clinicianUserIds = Array.from(bucket.keys());

    if (!clinicianUserIds.length) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const clinicians = await prisma.clinicianProfile.findMany({
      where: { userId: { in: clinicianUserIds } },
      select: {
        id: true,
        userId: true,
        displayName: true,
        specialty: true,
        city: true,
        practiceName: true,
      },
    });

    const items = clinicians
      .map((c) => {
        const stats = bucket.get(String(c.userId || '').trim());
        if (!stats) return null;

        return {
          id: c.id,
          userId: c.userId,
          name: c.displayName || 'Clinician',
          specialty: c.specialty || null,
          location: c.city || c.practiceName || null,
          encounterCount: stats.encounterCount,
          appointmentCount: stats.appointmentCount,
          latestInteractionAt: new Date(stats.latestAt).toISOString(),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const latest =
          new Date(b.latestInteractionAt).getTime() -
          new Date(a.latestInteractionAt).getTime();
        if (latest !== 0) return latest;

        const aCount = (a.encounterCount || 0) + (a.appointmentCount || 0);
        const bCount = (b.encounterCount || 0) + (b.appointmentCount || 0);
        return bCount - aCount;
      })
      .slice(0, 3);

    return NextResponse.json(items, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[care-team] error', err);
    return NextResponse.json(
      { ok: false, error: 'care_team_unavailable' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}