import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction, type Who } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function normalizeText(value: unknown) {
  return clean(value, 20000).toLowerCase().replace(/\s+/g, ' ').trim();
}

function transcriptSegments(summaryPayload: unknown) {
  const summary = asRecord(summaryPayload);
  const transcript = asRecord(summary.captionTranscript);
  return Array.isArray(transcript.segments)
    ? transcript.segments.filter((s) => s && typeof s === 'object' && s.final !== false && clean(s.text, 6000))
    : [];
}

function joinedTranscript(segments: any[]) {
  return segments
    .map((s) => {
      const who = clean(s.speakerDisplay || s.speakerName || s.speakerRole || 'Speaker', 120);
      const text = clean(s.text, 6000);
      return who && text ? `${who}: ${text}` : text;
    })
    .filter(Boolean)
    .join('\n');
}

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-80);
}

function existingSoapText(body: any) {
  const soap = asRecord(body?.soap || body?.existingSoap);
  return normalizeText([
    soap.subjective,
    soap.objective,
    soap.assessment,
    soap.plan,
    body?.existingNote,
    body?.notes,
  ].filter(Boolean).join('\n'));
}

function classifyLine(line: string) {
  const l = line.toLowerCase();

  if (/\b(pain|fever|cough|shortness|sob|vomit|diarrhoea|diarrhea|bleed|dizzy|headache|symptom|complain|complaint)\b/.test(l)) {
    return 'symptoms';
  }

  if (/\b(history|previous|past|known|diagnosed|medication|allergy|allergic|surgery|admission)\b/.test(l)) {
    return 'history';
  }

  if (/\b(assess|impression|diagnosis|diagnose|likely|possible|differential)\b/.test(l)) {
    return 'assessment';
  }

  if (/\b(plan|start|stop|continue|prescribe|refer|follow|review|safety|return|urgent|emergency|red flag)\b/.test(l)) {
    return 'plan';
  }

  return 'history';
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

function assertCanDraft(encounter: any, who: Who) {
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

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedInProduction(req, who);

    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const body = await req.json().catch(() => ({}));
    const encounter = await requireEncounter(encounterId);
    assertCanDraft(encounter, who);

    const segments = transcriptSegments(encounter.summaryPayload);
    const transcriptText = joinedTranscript(segments);
    const existingText = existingSoapText(body);

    const suggestions = splitLines(transcriptText)
      .map((line) => ({
        id: Buffer.from(line).toString('base64url').slice(0, 48),
        section: classifyLine(line),
        suggestedText: line,
        source: 'caption_transcript',
        confidence: null,
        duplicateOf: existingText && existingText.includes(normalizeText(line)) ? ['existing_note'] : [],
        action: 'append_new_only',
        createdAt: new Date().toISOString(),
      }))
      .filter((item) => item.duplicateOf.length === 0)
      .slice(-30);

    return json({
      ok: true,
      encounterId,
      reviewRequired: true,
      action: 'append_new_only',
      source: 'caption_transcript',
      transcriptSegmentCount: segments.length,
      suggestions,
      noteDraft: {
        createdAt: new Date().toISOString(),
        sections: suggestions.reduce((acc: Record<string, string[]>, item) => {
          acc[item.section] = acc[item.section] || [];
          acc[item.section].push(item.suggestedText);
          return acc;
        }, {}),
      },
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'note_draft_failed' }, err?.status || 500);
  }
}
