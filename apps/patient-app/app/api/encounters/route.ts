// apps/patient-app/app/api/encounters/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/src/lib/prisma';
import * as store from './store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clampScore(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i as 1 | 2 | 3 | 4 | 5;
}

function extractRating(e: any) {
  // rating JSON / object
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

  // scalar fields (common patterns)
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

/**
 * Query params:
 * - mode=cases (default) | sessions (flatten encounters)
 * - status=Open|Closed|Referred
 * - limit=N
 */
function shapeEncounterForClient(e: any, caseId: string) {
  const rating = extractRating(e);

  return {
    id: e.id,
    caseId,
    start: e.start,
    stop: e.stop ?? null,
    mode: e.mode ?? null,
    status: e.status ?? null,
    clinician: e.clinician
      ? {
          id: e.clinician.id,
          name: e.clinician.name,
          specialty: e.clinician.specialty ?? null,
        }
      : undefined,
    devices: e.devices ?? undefined,
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
        new Date(b.start ?? 0).getTime() - new Date(a.start ?? 0).getTime(),
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

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode'); // 'sessions' to flatten
  const status = url.searchParams.get('status') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? 0);

  const useMocks = (process.env.USE_MOCKS ?? '0') === '1';

  // === Try DB first (if Prisma exists) ===
  try {
    if (!useMocks) {
      const prisma = getPrisma();
      if (!prisma) throw new Error('no-prisma');

      const cases = await prisma.case.findMany({
        where: status ? { status } : undefined,
        include: { encounters: { include: { clinician: true } } },
        orderBy: { updatedAt: 'desc' },
        take: limit > 0 ? limit : undefined,
      });

      if (!cases || cases.length === 0) throw new Error('no-cases');

      const normalized = cases.map((c: any) => {
        const latest = [...(c.encounters ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.stop ?? b.start).getTime() -
            new Date(a.stop ?? a.start).getTime(),
        )[0];
        const updatedAt = latest
          ? latest.stop ?? latest.start
          : c.updatedAt ?? new Date().toISOString();
        return { ...c, updatedAt };
      });

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
                start: e.start,
                stop: e.stop,
                mode: e.mode,
                status: e.status,
                clinician: e.clinician
                  ? {
                      id: e.clinician.id,
                      name: e.clinician.name,
                      specialty: e.clinician.specialty,
                    }
                  : undefined,
                devices: e.devices ?? undefined,
                notes: e.notes ?? undefined,
                vitals: e.vitals ?? undefined,
                rating: rating ?? null,
              };
            }),
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.stop ?? b.start).getTime() -
              new Date(a.stop ?? a.start).getTime(),
          );

        return NextResponse.json(
          { encounters },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      const shaped = normalized.map(shapeCaseForClient);
      return NextResponse.json(
        { cases: shaped },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
  } catch (err: any) {
    console.warn(
      '[encounters] prisma read failed or empty, falling back to mock store',
      err?.message ?? err,
    );
  }

  // === Fallback to in-memory/mock store ===
  try {
    const rawCases = store.listCases ? store.listCases() : null;
    if (rawCases && rawCases.length) {
      let cases = rawCases.map((c: any) => ({
        ...c,
        encounters: c.encounters ?? [],
      }));
      if (status) cases = cases.filter((c: any) => c.status === status);
      if (limit > 0) cases = cases.slice(0, limit);

      if (mode === 'sessions') {
        const encounters = cases
          .flatMap((c: any) =>
            (c.encounters ?? []).map((e: any) => {
              const rating = extractRating(e);
              return {
                id: e.id,
                caseId: c.id,
                caseTitle: c.title,
                caseStatus: c.status,
                start: e.start,
                stop: e.stop,
                mode: e.mode,
                status: e.status,
                clinician: e.clinician ?? undefined,
                devices: e.devices ?? undefined,
                notes: e.notes ?? undefined,
                vitals: e.vitals ?? undefined,
                rating: rating ?? null,
              };
            }),
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.stop ?? b.start).getTime() -
              new Date(a.stop ?? a.start).getTime(),
          );
        return NextResponse.json({ encounters });
      }

      const shaped = cases.map(shapeCaseForClient);
      return NextResponse.json({ cases: shaped });
    }

    // Build from encounters-only store
    const encs = store.listEncounters ? store.listEncounters() : [];
    const grouped: Record<string, any> = {};
    for (const e of encs) {
      const caseId = e.caseId ?? e.case ?? 'CASE-UNKNOWN';
      grouped[caseId] =
        grouped[caseId] ??
        {
          id: caseId,
          title: e.caseTitle ?? `Case ${caseId}`,
          status: e.caseStatus ?? 'Open',
          encounters: [],
        };
      grouped[caseId].encounters.push(e);
    }
    let casesArr = Object.values(grouped);
    if (status) casesArr = casesArr.filter((c: any) => c.status === status);
    if (limit > 0) casesArr = casesArr.slice(0, limit);

    if (mode === 'sessions') {
      const encounters = casesArr.flatMap((c: any) =>
        (c.encounters ?? []).map((e: any) => {
          const rating = extractRating(e);
          return {
            ...e,
            caseId: c.id,
            caseTitle: c.title,
            caseStatus: c.status,
            rating: rating ?? null,
          };
        }),
      );
      return NextResponse.json({ encounters });
    }

    const shaped = casesArr.map(shapeCaseForClient);
    return NextResponse.json({ cases: shaped });
  } catch (err: any) {
    console.error('[encounters] fallback store failed', err);
    return NextResponse.json(
      { error: 'encounters_unavailable', detail: String(err?.message ?? err) },
      { status: 502 },
    );
  }
}
