// apps/patient-app/app/api/encounters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/src/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clampScore(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;

  const i = Math.round(v);
  if (i < 1 || i > 5) return null;

  return i as 1 | 2 | 3 | 4 | 5;
}

function extractRating(e: any) {
  const r = e?.rating ?? e?.patientRating ?? null;

  if (r && typeof r === 'object') {
    const s = clampScore((r as any).score);

    if (s) {
      return {
        score: s,
        comment: (r as any).comment ?? undefined,
        createdAt: String(
          (r as any).createdAt ??
            e?.ratingCreatedAt ??
            e?.updatedAt ??
            e?.stop ??
            e?.start ??
            new Date().toISOString(),
        ),
      };
    }
  }

  const s =
    clampScore(e?.ratingScore) ??
    clampScore(e?.rating_score) ??
    clampScore(e?.ratingValue) ??
    clampScore(e?.rating_value);

  if (!s) return null;

  const comment =
    (typeof e?.ratingComment === 'string' ? e.ratingComment : null) ??
    (typeof e?.rating_comment === 'string' ? e.rating_comment : null) ??
    (typeof e?.comment === 'string' ? e.comment : null) ??
    undefined;

  const createdAt =
    e?.ratingCreatedAt ??
    e?.rating_created_at ??
    e?.ratedAt ??
    e?.rated_at ??
    e?.updatedAt ??
    e?.stop ??
    e?.start ??
    new Date().toISOString();

  return {
    score: s,
    comment,
    createdAt: String(createdAt),
  };
}

function readPatientId(req: NextRequest) {
  return (
    req.headers.get('x-ambulant-patient-id') ||
    req.headers.get('x-patient-id') ||
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-uid') ||
    ''
  ).trim();
}

function shapeEncounterForClient(e: any, caseId: string) {
  const rating = extractRating(e);

  return {
    id: e.id,
    caseId,
    start: e.start ?? e.startsAt ?? e.createdAt ?? null,
    stop: e.stop ?? e.endsAt ?? e.endedAt ?? null,
    mode: e.mode ?? e.type ?? null,
    status: e.status ?? null,
    clinician: e.clinician
      ? {
          id: e.clinician.id,
          name: e.clinician.name ?? e.clinician.displayName ?? null,
          specialty: e.clinician.specialty ?? null,
        }
      : e.clinicianId
        ? {
            id: e.clinicianId,
            name: e.clinicianName ?? null,
            specialty: e.clinicianSpecialty ?? null,
          }
        : undefined,
    devices: e.devices ?? e.meta?.devices ?? undefined,
    notes: e.notes ?? undefined,
    vitals: e.vitals ?? undefined,
    rating: rating ?? null,
  };
}

function shapeCaseForClient(c: any) {
  const rawEncounters = Array.isArray(c.encounters) ? c.encounters : [];

  const encounters = rawEncounters
    .map((e: any) => shapeEncounterForClient(e, c.id))
    .sort(
      (a: any, b: any) =>
        new Date(b.stop ?? b.start ?? 0).getTime() -
        new Date(a.stop ?? a.start ?? 0).getTime(),
    );

  const latestEncounter = encounters[0] ?? null;

  return {
    id: c.id,
    title: c.title ?? c.name ?? null,
    status: c.status ?? 'Open',
    updatedAt:
      c.updatedAt ??
      latestEncounter?.stop ??
      latestEncounter?.start ??
      new Date().toISOString(),
    encountersCount: encounters.length,
    latestEncounter,
    encounters,
  };
}

function shapeStandaloneEncounterAsCase(e: any) {
  const caseId =
    String(
      e.caseId ??
        e.case_id ??
        e.patientCaseId ??
        e.patient_case_id ??
        e.encounterCaseId ??
        '',
    ).trim() || `encounter-${String(e.id)}`;

  return {
    id: caseId,
    title: e.caseTitle ?? e.reason ?? e.title ?? 'Encounter',
    status: e.caseStatus ?? e.status ?? 'Open',
    updatedAt:
      e.updatedAt ??
      e.stop ??
      e.endsAt ??
      e.start ??
      e.startsAt ??
      e.createdAt ??
      new Date().toISOString(),
    encounters: [e],
  };
}

/**
 * Query params:
 * - mode=cases/default | sessions
 * - status=Open|Closed|Referred
 * - limit=N
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');
  const status = url.searchParams.get('status') ?? undefined;
  const limitRaw = Number(url.searchParams.get('limit') ?? 0);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const patientId = readPatientId(req);

  try {
    const prisma = getPrisma() as any;

    if (!prisma) {
      return json(
        {
          ok: false,
          error: 'encounter_store_unavailable',
          cases: [],
          encounters: [],
        },
        503,
      );
    }

    /*
     * Preferred shape: Case model with nested encounters.
     * If this model is not available in the current Prisma schema, we fall back
     * to direct Encounter queries below. No mock/in-memory fallback is used.
     */
    if (prisma.case?.findMany) {
      const where: any = {};

      if (status) where.status = status;

      if (patientId) {
        where.OR = [
          { patientId },
          { userId: patientId },
          { patient: { id: patientId } },
        ];
      }

      const cases = await prisma.case.findMany({
        where,
        include: {
          encounters: {
            include: {
              clinician: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      });

      const normalized = Array.isArray(cases)
        ? cases.map((c: any) => {
            const latest = [...(c.encounters ?? [])].sort(
              (a: any, b: any) =>
                new Date(b.stop ?? b.start ?? b.updatedAt ?? 0).getTime() -
                new Date(a.stop ?? a.start ?? a.updatedAt ?? 0).getTime(),
            )[0];

            const updatedAt = latest
              ? latest.stop ?? latest.start ?? latest.updatedAt
              : c.updatedAt ?? new Date().toISOString();

            return { ...c, updatedAt };
          })
        : [];

      if (mode === 'sessions') {
        const encounters = normalized
          .flatMap((c: any) =>
            (c.encounters ?? []).map((e: any) => {
              const rating = extractRating(e);

              return {
                id: e.id,
                caseId: c.id,
                caseTitle: c.title ?? c.name,
                caseStatus: c.status,
                start: e.start ?? e.startsAt ?? e.createdAt ?? null,
                stop: e.stop ?? e.endsAt ?? e.endedAt ?? null,
                mode: e.mode ?? e.type ?? null,
                status: e.status ?? null,
                clinician: e.clinician
                  ? {
                      id: e.clinician.id,
                      name: e.clinician.name ?? e.clinician.displayName ?? null,
                      specialty: e.clinician.specialty ?? null,
                    }
                  : undefined,
                devices: e.devices ?? e.meta?.devices ?? undefined,
                notes: e.notes ?? undefined,
                vitals: e.vitals ?? undefined,
                rating: rating ?? null,
              };
            }),
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.stop ?? b.start ?? 0).getTime() -
              new Date(a.stop ?? a.start ?? 0).getTime(),
          );

        return json({ ok: true, encounters });
      }

      return json({
        ok: true,
        cases: normalized.map(shapeCaseForClient),
      });
    }

    /*
     * Direct Encounter model fallback.
     * This is still production-safe because it uses the real database model,
     * not mock data.
     */
    if (prisma.encounter?.findMany) {
      const where: any = {};

      if (status) where.status = status;

      if (patientId) {
        where.OR = [
          { patientId },
          { userId: patientId },
          { patient: { id: patientId } },
        ];
      }

      const encountersRaw = await prisma.encounter.findMany({
        where,
        include: {
          clinician: true,
        },
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
      });

      const encounters = Array.isArray(encountersRaw) ? encountersRaw : [];

      if (mode === 'sessions') {
        const sessions = encounters
          .map((e: any) => {
            const caseId =
              String(
                e.caseId ??
                  e.case_id ??
                  e.patientCaseId ??
                  e.patient_case_id ??
                  e.encounterCaseId ??
                  '',
              ).trim() || `encounter-${String(e.id)}`;

            return {
              ...shapeEncounterForClient(e, caseId),
              caseTitle: e.caseTitle ?? e.reason ?? e.title ?? 'Encounter',
              caseStatus: e.caseStatus ?? e.status ?? 'Open',
            };
          })
          .sort(
            (a: any, b: any) =>
              new Date(b.stop ?? b.start ?? 0).getTime() -
              new Date(a.stop ?? a.start ?? 0).getTime(),
          );

        return json({ ok: true, encounters: sessions });
      }

      const grouped = new Map<string, any>();

      for (const e of encounters) {
        const c = shapeStandaloneEncounterAsCase(e);
        const existing = grouped.get(c.id);

        if (!existing) {
          grouped.set(c.id, c);
        } else {
          existing.encounters.push(e);
          const existingTime = new Date(existing.updatedAt ?? 0).getTime();
          const currentTime = new Date(c.updatedAt ?? 0).getTime();

          if (currentTime > existingTime) {
            existing.updatedAt = c.updatedAt;
          }
        }
      }

      const cases = Array.from(grouped.values())
        .map(shapeCaseForClient)
        .sort(
          (a: any, b: any) =>
            new Date(b.updatedAt ?? 0).getTime() -
            new Date(a.updatedAt ?? 0).getTime(),
        );

      return json({ ok: true, cases });
    }

    return json(
      {
        ok: false,
        error: 'encounter_store_unavailable',
        cases: [],
        encounters: [],
      },
      503,
    );
  } catch (err: any) {
    console.error('[patient-app/api/encounters] failed', err);

    return json(
      {
        ok: false,
        error: err?.message || 'encounters_unavailable',
        cases: [],
        encounters: [],
      },
      500,
    );
  }
}