import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction, type Who } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CaptionSegment = {
  id: string;
  type: 'caption.partial' | 'caption.final';
  roomId: string;
  encounterId: string;
  appointmentId?: string | null;
  speakerRole: string;
  speakerIdentity?: string | null;
  speakerName: string;
  speakerDisplay: string;
  text: string;
  final: boolean;
  language?: string | null;
  source: string;
  confidence?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  timestamp: string;
  sequence: number;
  receivedAt: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalString(value: unknown, max = 4000): string | null {
  const out = clean(value, max);
  return out ? out : null;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function parseIso(value: unknown): string {
  const raw = optionalString(value, 80);
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function segmentKey(segment: Pick<CaptionSegment, 'speakerIdentity' | 'speakerDisplay' | 'sequence' | 'timestamp' | 'text'>) {
  return [
    segment.speakerIdentity || segment.speakerDisplay || 'speaker',
    String(segment.sequence ?? ''),
    segment.timestamp || '',
    segment.text || '',
  ].join('|');
}

function normalizeSegment(body: any, encounterId: string): CaptionSegment | null {
  if (!body || typeof body !== 'object') return null;

  const type = body.type === 'caption.partial' ? 'caption.partial' : 'caption.final';
  const text = optionalString(body.text, 6000);
  const roomId = optionalString(body.roomId, 240);
  const speakerDisplay =
    optionalString(body.speakerDisplay, 240) ||
    optionalString(body.speakerName, 240) ||
    'Speaker';

  if (!text || !roomId) return null;

  const timestamp = parseIso(body.timestamp);
  const sequence =
    typeof body.sequence === 'number' && Number.isFinite(body.sequence)
      ? Math.floor(body.sequence)
      : Date.now();

  return {
    id:
      optionalString(body.id, 240) ||
      Buffer.from(segmentKey({
        speakerIdentity: optionalString(body.speakerIdentity, 240),
        speakerDisplay,
        sequence,
        timestamp,
        text,
      })).toString('base64url').slice(0, 64),
    type,
    roomId,
    encounterId,
    appointmentId: optionalString(body.appointmentId, 240),
    speakerRole: optionalString(body.speakerRole, 80) || 'guest',
    speakerIdentity: optionalString(body.speakerIdentity, 240),
    speakerName: optionalString(body.speakerName, 240) || speakerDisplay,
    speakerDisplay,
    text,
    final: body.final === false ? false : type === 'caption.final',
    language: optionalString(body.language, 40),
    source: optionalString(body.source, 120) || 'unknown',
    confidence: numberOrNull(body.confidence),
    startedAt: optionalString(body.startedAt, 80),
    endedAt: optionalString(body.endedAt, 80),
    timestamp,
    sequence,
    receivedAt: new Date().toISOString(),
  };
}

function transcriptFromSummary(summaryPayload: unknown) {
  const summary = asRecord(summaryPayload);
  const transcript = asRecord(summary.captionTranscript);
  const rawSegments = Array.isArray(transcript.segments) ? transcript.segments : [];
  const segments = rawSegments.filter((item) => item && typeof item === 'object') as CaptionSegment[];

  return {
    summary,
    transcript: {
      source: transcript.source || 'caption-worker',
      version: transcript.version || 'caption-transcript-v1',
      updatedAt: transcript.updatedAt || null,
      segments,
    },
  };
}

function sortedCappedSegments(segments: CaptionSegment[]) {
  return segments
    .slice(-1000)
    .sort((a, b) => {
      const at = Date.parse(a.timestamp || a.receivedAt || '');
      const bt = Date.parse(b.timestamp || b.receivedAt || '');
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
      return (a.sequence || 0) - (b.sequence || 0);
    });
}

async function requireEncounter(encounterId: string) {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      appointments: { orderBy: { startsAt: 'desc' }, take: 20 },
      consultationInviteQuotes: { include: { lines: true }, orderBy: { createdAt: 'desc' }, take: 50 },
      collaborativeDrafts: { include: { lines: true }, orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });

  if (!encounter) {
    const err = new Error('encounter_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  return encounter;
}

function clinicianAllowed(encounter: any, uid: string) {
  if (!uid) return false;
  if (encounter.clinicianId === uid) return true;
  if (Array.isArray(encounter.appointments) && encounter.appointments.some((a: any) => a.clinicianId === uid)) return true;

  if (
    Array.isArray(encounter.consultationInviteQuotes) &&
    encounter.consultationInviteQuotes.some((q: any) =>
      q.leadClinicianId === uid ||
      q.requestedByClinicianId === uid ||
      (Array.isArray(q.lines) && q.lines.some((line: any) => line.clinicianId === uid))
    )
  ) {
    return true;
  }

  if (
    Array.isArray(encounter.collaborativeDrafts) &&
    encounter.collaborativeDrafts.some((d: any) =>
      d.leadClinicianId === uid ||
      d.requestedByClinicianId === uid ||
      (Array.isArray(d.lines) && d.lines.some((line: any) => line.clinicianId === uid))
    )
  ) {
    return true;
  }

  return false;
}

function patientAllowed(encounter: any, uid: string, actorRefId?: string | null) {
  return !!uid && (encounter.patientId === uid || encounter.patientId === actorRefId);
}

function assertCanReadTranscript(encounter: any, who: Who) {
  if (!who.uid) {
    const err = new Error('unauthorized') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  if (who.role === 'system' || who.role === 'admin' || who.role === 'admin_staff') return;
  if (who.role === 'clinician' && clinicianAllowed(encounter, who.uid)) return;
  if (who.role === 'patient' && patientAllowed(encounter, who.uid, who.actorRefId)) return;

  const err = new Error('forbidden') as Error & { status?: number };
  err.status = 403;
  throw err;
}

function assertCanWriteTranscript(encounter: any, who: Who) {
  if (!who.uid) {
    const err = new Error('unauthorized') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  if (who.role === 'system' || who.role === 'admin' || who.role === 'admin_staff') return;
  if (who.role === 'clinician' && clinicianAllowed(encounter, who.uid)) return;

  const err = new Error('forbidden') as Error & { status?: number };
  err.status = 403;
  throw err;
}

function requireTrustedInProduction(req: NextRequest, who: Who) {
  try {
    requireTrustedIdentityInProduction(req.headers, who);
  } catch {
    const err = new Error('unauthorized') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedInProduction(req, who);

    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const encounter = await requireEncounter(encounterId);
    assertCanReadTranscript(encounter, who);

    const { transcript } = transcriptFromSummary(encounter.summaryPayload);

    return json({
      ok: true,
      encounterId,
      transcript,
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'transcript_read_failed' }, err?.status || 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedInProduction(req, who);

    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const body = await req.json().catch(() => null);
    const segment = normalizeSegment(body, encounterId);
    if (!segment) return json({ ok: false, error: 'invalid_caption_segment' }, 400);

    const encounter = await requireEncounter(encounterId);
    assertCanWriteTranscript(encounter, who);

    const { summary, transcript } = transcriptFromSummary(encounter.summaryPayload);

    const nextSegments = transcript.segments.filter((existing) => {
      if (!existing || typeof existing !== 'object') return false;

      const sameSpeaker =
        (existing.speakerIdentity || existing.speakerDisplay) ===
        (segment.speakerIdentity || segment.speakerDisplay);

      if (!segment.final && sameSpeaker && existing.final === false) return false;
      if (segment.final && sameSpeaker && existing.final === false) return false;

      return existing.id !== segment.id && segmentKey(existing) !== segmentKey(segment);
    });

    nextSegments.push(segment);

    const nextTranscript = {
      ...transcript,
      updatedAt: new Date().toISOString(),
      lastSegmentAt: segment.timestamp,
      segments: sortedCappedSegments(nextSegments),
    };

    const updated = await prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        summaryPayload: {
          ...summary,
          captionTranscript: nextTranscript,
        } as any,
      },
      select: {
        id: true,
        updatedAt: true,
        summaryPayload: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        kind: 'encounter_caption_segment_persisted',
        actorId: who.uid,
        actorRole: who.role,
        subjectId: encounter.id,
        meta: {
          roomId: segment.roomId,
          speakerRole: segment.speakerRole,
          speakerIdentity: segment.speakerIdentity,
          sequence: segment.sequence,
          final: segment.final,
          source: segment.source,
        },
      },
    }).catch(() => null);

    const { transcript: updatedTranscript } = transcriptFromSummary(updated.summaryPayload);

    return json({
      ok: true,
      encounterId: updated.id,
      segment,
      transcript: {
        source: updatedTranscript.source,
        version: updatedTranscript.version,
        updatedAt: updatedTranscript.updatedAt,
        count: updatedTranscript.segments.length,
      },
    }, 201);
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/transcript][POST] error', err);
    return json({ ok: false, error: err?.message || 'transcript_write_failed' }, err?.status || 500);
  }
}
