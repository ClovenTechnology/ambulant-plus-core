// apps/api-gateway/app/api/patients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-clinician-id,x-ambulant-identity',
      'cache-control': 'no-store',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function unique(values: unknown[]) {
  return Array.from(new Set(values.map((v) => clean(v)).filter(Boolean)));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function GET(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const url = new URL(req.url);

    const clinicianId =
      clean(url.searchParams.get('clinicianId')) ||
      clean(req.headers.get('x-clinician-id')) ||
      (who.role === 'clinician' ? clean(who.actorRefId || who.uid) : '');

    if (!clinicianId && who.role !== 'admin' && who.role !== 'admin_staff') {
      return json({ ok: false, error: 'clinician_identity_required', items: [] }, 401);
    }

    const appointmentWhere: any = {};
    if (clinicianId) appointmentWhere.clinicianId = clinicianId;

    const appointments = await prisma.appointment.findMany({
      where: appointmentWhere,
      orderBy: { startsAt: 'desc' },
      take: 700,
    });

    const patientIds = unique(
      appointments.flatMap((a) => [a.subjectPatientId, a.patientId, a.hostUserId]),
    );

    if (!patientIds.length) {
      return json({ ok: true, items: [], patients: [], total: 0 });
    }

    const profiles = await prisma.patientProfile.findMany({
      where: {
        OR: [
          { id: { in: patientIds } },
          { userId: { in: patientIds } },
        ],
      },
      select: {
        id: true,
        userId: true,
        name: true,
        dob: true,
        gender: true,
        contactEmail: true,
        phone: true,
        city: true,
        photoUrl: true,
        updatedAt: true,
      },
    });

    const profileByKey = new Map<string, any>();
    for (const p of profiles as any[]) {
      profileByKey.set(String(p.id), p);
      if (p.userId) profileByKey.set(String(p.userId), p);
    }

    const grouped = new Map<string, any>();

    for (const a of appointments as any[]) {
      const key = clean(a.subjectPatientId || a.patientId || a.hostUserId);
      if (!key) continue;

      const profile = profileByKey.get(key) || profileByKey.get(String(a.patientId || '')) || null;
      const outId = profile?.id || key;

      const existing = grouped.get(outId) || {
        id: outId,
        patientId: outId,
        userId: profile?.userId || null,
        name:
          profile?.name ||
          (a.meta && typeof a.meta === 'object' ? a.meta.patientDisplayName : null) ||
          'Patient',
        fullName:
          profile?.name ||
          (a.meta && typeof a.meta === 'object' ? a.meta.patientDisplayName : null) ||
          'Patient',
        displayName:
          profile?.name ||
          (a.meta && typeof a.meta === 'object' ? a.meta.patientDisplayName : null) ||
          'Patient',
        dob: profile?.dob instanceof Date ? profile.dob.toISOString() : profile?.dob ?? null,
        gender: profile?.gender || null,
        email: profile?.contactEmail || null,
        phone: profile?.phone || null,
        location: profile?.city || null,
        avatarUrl: profile?.photoUrl || null,
        risk: 'low',
        tags: [],
        timeline: [],
        lastSeen: null,
      };

      const ts =
        a.startsAt instanceof Date
          ? a.startsAt.toISOString()
          : a.startsAt
            ? String(a.startsAt)
            : null;

      if (ts) {
        existing.timeline.push({
          ts,
          type: String(a.status || '').toLowerCase().includes('completed') ? 'completed' : 'appointment',
          note: a.reason || 'Televisit',
          appointmentId: a.id,
          status: a.status,
          roomId: a.roomId,
        });

        if (!existing.lastSeen || Date.parse(ts) > Date.parse(existing.lastSeen)) {
          existing.lastSeen = ts;
        }
      }

      grouped.set(outId, existing);
    }

    const items = Array.from(grouped.values()).sort((a, b) => {
      return Date.parse(b.lastSeen || '1970-01-01') - Date.parse(a.lastSeen || '1970-01-01');
    });

    return json({ ok: true, items, patients: items, total: items.length });
  } catch (e: any) {
    console.error('[api-gateway][patients.GET] error', e);
    return json({ ok: false, error: e?.message || 'patients_load_failed', items: [] }, 500);
  }
}
