// apps/patient-app/app/api/encounters/[id]/rating/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/src/lib/prisma';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clampScore(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i as 1 | 2 | 3 | 4 | 5;
}

/** Basic auth extraction from headers: returns { ok, uid, role, reason } */
function extractAuthFromHeaders(
  headers: Headers | Record<string, string> | undefined,
) {
  const get = (k: string) => {
    if (!headers) return null;
    if ((headers as Headers).get) return (headers as Headers).get!(k);
    return (
      (headers as Record<string, string>)[k.toLowerCase()] ??
      (headers as Record<string, string>)[k]
    );
  };
  const uid = get('x-uid') ?? get('x-user') ?? get('x-user-id');
  const role = (get('x-role') ?? 'patient') as string | null;
  if (!uid) return { ok: false, reason: 'unauthenticated' };
  return { ok: true, uid: String(uid), role: role ? String(role) : 'patient' };
}

/** Authorize action on an encounter for a given actor */
function authorizeForEncounter(
  actor: { uid: string; role: string },
  enc: { patientId?: string; clinicianId?: string } | null,
) {
  if (!actor || !actor.uid) return { ok: false, reason: 'unauthenticated' };
  if (actor.role === 'admin') return { ok: true };
  if (!enc) return { ok: false, reason: 'encounter_not_found' };
  if (
    actor.role === 'patient' &&
    enc.patientId &&
    actor.uid === enc.patientId
  )
    return { ok: true };
  if (
    actor.role === 'clinician' &&
    enc.clinicianId &&
    actor.uid === enc.clinicianId
  )
    return { ok: true };
  return { ok: false, reason: 'forbidden' };
}

/* ------------ clinician flagging helpers (discipline / archive) ------------ */

const LOW_RATING_THRESHOLD = 2; // <=2 is considered "low"
const LOW_RATING_MIN_COUNT = 5; // at least 5 low ratings
const RATING_WINDOW_DAYS = 7; // within 7 days
const MIN_SESSIONS_IN_WINDOW = 10; // only if 10+ rated sessions in window

function getGatewayBase() {
  return (
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.APIGW_BASE ??
    process.env.NEXT_PUBLIC_GATEWAY_BASE ??
    'http://localhost:4000'
  );
}

function getAdminKey() {
  return process.env.ADMIN_API_KEY ?? '';
}

async function markClinicianDisciplinary(clinicianId: string) {
  const gatewayBase = getGatewayBase();
  const adminKey = getAdminKey();
  const url = `${gatewayBase}/api/clinicians`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ id: clinicianId, status: 'disciplinary' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(
        '[rating] clinician disciplinary PATCH failed',
        res.status,
        text,
      );
    }
  } catch (err) {
    console.error('[rating] clinician disciplinary error', err);
  }
}

async function archiveClinician(clinicianId: string) {
  const gatewayBase = getGatewayBase();
  const adminKey = getAdminKey();
  const url = `${gatewayBase}/api/clinicians`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ id: clinicianId }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      console.warn(
        '[rating] clinician archive DELETE failed',
        res.status,
        text,
      );
    }
  } catch (err) {
    console.error('[rating] clinician archive error', err);
  }
}

/**
 * Best-effort discipline logic:
 * - If score === 1 → immediately mark disciplinary + archive.
 * - Else, compute recent low ratings for this clinician in last 7 days;
 *   if >= MIN_SESSIONS_IN_WINDOW total rated and >= LOW_RATING_MIN_COUNT low ratings (<=2),
 *   mark disciplinary.
 */
async function maybeDisciplineClinician(
  prisma: any,
  clinicianId: string | null | undefined,
  ratingScore: 1 | 2 | 3 | 4 | 5,
) {
  if (!clinicianId || !prisma?.encounter?.findMany) return;

  // 1-star: immediate flag + archive
  if (ratingScore === 1) {
    await markClinicianDisciplinary(clinicianId);
    await archiveClinician(clinicianId);
    return;
  }

  // Otherwise, compute low-rating window
  const now = Date.now();
  const windowStartMs =
    now - RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  try {
    // Pull all encounters for this clinician (we'll filter by rating date in JS).
    // We intentionally don't specify `select` so we don't depend on exact schema shape.
    const encs: any[] = await prisma.encounter.findMany({
      where: { clinicianId },
    });

    let totalRated = 0;
    let lowRated = 0;

    for (const e of encs) {
      let score: number | null = null;

      // Attempt to read rating from JSON field
      if (e.rating && typeof e.rating === 'object') {
        const s = Number((e.rating as any).score);
        if (Number.isFinite(s)) score = s;
      }

      // Fallback scalar columns
      if (score == null && e.ratingScore != null) {
        const s = Number(e.ratingScore);
        if (Number.isFinite(s)) score = s;
      }
      if (score == null && e.rating_score != null) {
        const s = Number(e.rating_score);
        if (Number.isFinite(s)) score = s;
      }

      if (!score) continue;

      // Figure out when rating was created
      let createdAtStr: string | null =
        (e.rating && (e.rating as any).createdAt) ??
        e.ratingCreatedAt ??
        e.rating_created_at ??
        e.ratedAt ??
        e.rated_at ??
        e.updatedAt ??
        e.stop ??
        e.start ??
        null;

      let createdMs: number | null = null;
      if (createdAtStr) {
        const ms = new Date(createdAtStr).getTime();
        if (Number.isFinite(ms)) createdMs = ms;
      }
      if (createdMs == null) continue;

      // Only consider ratings inside the window
      if (createdMs < windowStartMs) continue;

      totalRated += 1;
      if (score <= LOW_RATING_THRESHOLD) lowRated += 1;
    }

    if (
      totalRated >= MIN_SESSIONS_IN_WINDOW &&
      lowRated >= LOW_RATING_MIN_COUNT
    ) {
      await markClinicianDisciplinary(clinicianId);
    }
  } catch (err) {
    console.warn(
      '[rating] maybeDisciplineClinician error (ignored)',
      (err as any)?.message ?? err,
    );
  }
}

/* --------------------------------- handler --------------------------------- */

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encounterId = params.id;

  const auth = extractAuthFromHeaders(req.headers);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401 },
    );
  }
  const actor = { uid: auth.uid!, role: auth.role ?? 'patient' };

  const body = await req.json().catch(() => ({}));
  const score = clampScore(body?.score);
  const commentRaw = body?.comment;
  const comment =
    typeof commentRaw === 'string'
      ? commentRaw.trim() || null
      : commentRaw == null
      ? null
      : String(commentRaw);
  const createdAt =
    typeof body?.createdAt === 'string'
      ? body.createdAt
      : new Date().toISOString();

  if (!score) {
    return NextResponse.json(
      { ok: false, error: 'invalid_score' },
      { status: 400 },
    );
  }

  const rating = { score, comment, createdAt };

  let clinicianId: string | null = null;

  // 1) Try Prisma (best-effort, supports either `rating` JSON or scalar columns)
  try {
    const prisma = (getPrisma() as any) ?? null;
    if (prisma?.encounter?.update) {
      // Ensure encounter exists (nice error)
      const exists = await prisma.encounter
        .findUnique({ where: { id: encounterId } })
        .catch(() => null);
      if (!exists) {
        return NextResponse.json(
          { ok: false, error: 'encounter_not_found' },
          { status: 404 },
        );
      }

      clinicianId = (exists as any).clinicianId ?? null;

      const authz = authorizeForEncounter(actor, {
        patientId: (exists as any).patientId,
        clinicianId,
      });
      if (!authz.ok) {
        return NextResponse.json(
          { ok: false, error: authz.reason ?? 'forbidden' },
          { status: 403 },
        );
      }

      // Attempt A: JSON field named `rating`
      let wroteRating = false;
      try {
        await prisma.encounter.update({
          where: { id: encounterId },
          data: { rating },
        });
        wroteRating = true;
      } catch {
        // Attempt B: scalar fields
        await prisma.encounter.update({
          where: { id: encounterId },
          data: {
            ratingScore: score,
            ratingComment: comment,
            ratingCreatedAt: createdAt,
          },
        });
        wroteRating = true;
      }

      // If we successfully wrote rating and we know the clinician,
      // run best-effort disciplinary logic (doesn't affect response).
      if (wroteRating && clinicianId) {
        // Fire and forget (no await needed for response, but we *do* await so
        // errors can be logged deterministically; failure is swallowed inside helper).
        await maybeDisciplineClinician(prisma, clinicianId, score);
      }
    }
  } catch (e) {
    // swallow: UI already stores locally, and we still update in-memory store below
    console.warn('[rating] prisma write failed', (e as any)?.message ?? e);
  }

  // 2) In-memory store update (best-effort)
  try {
    const enc = store.encounters.get(encounterId) as any;
    if (enc) {
      enc.rating = rating;
      enc.ratingScore = score;
      enc.ratingComment = comment;
      enc.ratingCreatedAt = createdAt;
      store.encounters.set(encounterId, enc);
    }
  } catch {}

  return NextResponse.json(
    { ok: true, encounterId, rating },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
