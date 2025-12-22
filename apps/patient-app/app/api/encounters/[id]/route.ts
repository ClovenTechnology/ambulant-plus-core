// apps/patient-app/app/api/encounters/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

let prisma: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  prisma = require('@/src/lib/prisma').prisma;
} catch (e) {
  prisma = null;
}

function nowIso() {
  return new Date().toISOString();
}

function clampScore(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i;
}

function extractRating(e: any) {
  const r = e?.rating ?? e?.patientRating ?? null;
  if (r && typeof r === 'object') {
    const s = clampScore((r as any).score);
    if (s) {
      return {
        score: s,
        comment: (r as any).comment ?? null,
        createdAt: String(
          (r as any).createdAt ??
            e?.ratingCreatedAt ??
            e?.updatedAt ??
            e?.stop ??
            e?.start ??
            nowIso(),
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
    null;

  const createdAt =
    e?.ratingCreatedAt ??
    e?.rating_created_at ??
    e?.ratedAt ??
    e?.rated_at ??
    e?.updatedAt ??
    e?.stop ??
    e?.start ??
    nowIso();

  return { score: s, comment, createdAt: String(createdAt) };
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

function makeInMemoryNote({
  encounterId,
  text,
  source,
  visitId,
  authorId,
  authorRole,
}: {
  encounterId: string;
  text: string;
  source?: string;
  visitId?: string;
  authorId?: string;
  authorRole?: string;
}) {
  return {
    id: crypto.randomUUID(),
    encounterId,
    text,
    source: source ?? null,
    visitId: visitId ?? null,
    authorId: authorId ?? null,
    authorRole: authorRole ?? null,
    createdAt: nowIso(),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;

  try {
    if (prisma && prisma.encounter) {
      const enc = await prisma.encounter
        .findUnique({
          where: { id },
          include: { notes: true },
        })
        .catch(() => null);

      if (enc) {
        const inferred = extractRating(enc);
        return NextResponse.json({
          ...enc,
          rating: (enc as any).rating ?? inferred ?? null,
        });
      }
    }
  } catch (err) {
    console.warn(
      'prisma encounter GET failed - falling back to store',
      (err as any)?.message ?? err,
    );
  }

  const enc = store.encounters.get(id);
  if (!enc) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const inferred = extractRating(enc);
  return NextResponse.json({
    ...enc,
    rating: (enc as any).rating ?? inferred ?? null,
  });
}

/* ---------- POST handler - create note ---------- */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encId = params.id;

  const auth = extractAuthFromHeaders(req.headers);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: 'unauthenticated' },
      { status: 401 },
    );
  }
  const actor = { uid: auth.uid!, role: auth.role ?? 'patient' };

  const body = await req.json().catch(() => ({}));
  const text = (body?.text ?? '').toString().trim();
  const source = body?.source ? String(body.source) : undefined;
  const visitId = body?.visitId ? String(body.visitId) : undefined;

  if (!text)
    return NextResponse.json(
      { ok: false, error: 'text required' },
      { status: 400 },
    );

  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

  if (prisma && prisma.note && typeof prisma.note.create === 'function') {
    try {
      const enc = await prisma.encounter.findUnique({ where: { id: encId } });
      if (!enc)
        return NextResponse.json(
          { ok: false, error: 'encounter_not_found' },
          { status: 404 },
        );

      const authz = authorizeForEncounter(actor, {
        patientId: enc.patientId,
        clinicianId: enc.clinicianId,
      });
      if (!authz.ok)
        return NextResponse.json(
          { ok: false, error: authz.reason ?? 'forbidden' },
          { status: 403 },
        );

      const dup = await prisma.note
        .findFirst({
          where: {
            encounterId: encId,
            text,
            createdAt: { gte: twoMinAgo },
          },
        })
        .catch(() => null);

      if (dup)
        return NextResponse.json(
          { ok: false, error: 'duplicate_recent', note: dup },
          { status: 409 },
        );

      const created = await prisma.note.create({
        data: {
          encounterId: encId,
          text,
          source: source ?? null,
          visitId: visitId ?? null,
          authorId: actor.uid,
          authorRole: actor.role,
        },
      });

      try {
        const localEnc = store.encounters.get(encId);
        if (localEnc) {
          (localEnc as any).notes = (localEnc as any).notes ?? [];
          (localEnc as any).notes.unshift(created);
          store.encounters.set(encId, localEnc as any);
        }
      } catch {}

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/events/emit`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-uid': actor.uid,
              'x-role': actor.role,
            },
            body: JSON.stringify({
              kind: 'note_created',
              encounterId: encId,
              note: created,
              actor: { id: actor.uid, role: actor.role },
            }),
          },
        ).catch(() => {});
      } catch {}

      return NextResponse.json({ ok: true, note: created }, { status: 201 });
    } catch (prErr: any) {
      console.warn(
        'prisma note create failed, will fallback to in-memory store',
        prErr?.message ?? prErr,
      );
    }
  }

  try {
    const enc = store.encounters.get(encId) as any;
    if (!enc)
      return NextResponse.json(
        { ok: false, error: 'encounter_not_found' },
        { status: 404 },
      );

    const authz = authorizeForEncounter(actor, {
      patientId: enc.patientId,
      clinicianId: enc.clinicianId,
    });
    if (!authz.ok)
      return NextResponse.json(
        { ok: false, error: authz.reason ?? 'forbidden' },
        { status: 403 },
      );

    const recentDup = (enc.notes ?? []).find((n: any) => {
      if (!n?.text || !n?.createdAt) return false;
      return (
        n.text.trim() === text &&
        new Date(n.createdAt).getTime() >= twoMinAgo.getTime()
      );
    });
    if (recentDup)
      return NextResponse.json(
        { ok: false, error: 'duplicate_recent', note: recentDup },
        { status: 409 },
      );

    const note = makeInMemoryNote({
      encounterId: encId,
      text,
      source,
      visitId,
      authorId: actor.uid,
      authorRole: actor.role,
    });
    enc.notes = enc.notes ?? [];
    enc.notes.unshift(note);
    store.encounters.set(encId, enc);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/events/emit`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-uid': actor.uid,
            'x-role': actor.role,
          },
          body: JSON.stringify({
            kind: 'note_created',
            encounterId: encId,
            note,
            actor: { id: actor.uid, role: actor.role },
          }),
        },
      ).catch(() => {});
    } catch {}

    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (err: any) {
    console.error('note POST error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 },
    );
  }
}
