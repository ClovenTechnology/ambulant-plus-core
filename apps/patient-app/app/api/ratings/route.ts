// apps/patient-app/app/api/ratings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { POST as postEncounterRating } from '../encounters/[id]/rating/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Generic ratings gateway.
 *
 * Accepts:
 *   { encounterId, score, comment, createdAt }
 *
 * Delegates to /api/encounters/[id]/rating so that:
 *   - rating is written to DB + in-memory store
 *   - clinician discipline / archive logic runs (if encounter has clinicianId)
 */
export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const encounterIdRaw =
    body?.encounterId ??
    body?.encounter_id ??
    body?.encounter ??
    body?.visitId ??
    body?.visit_id ??
    null;

  const encounterId = encounterIdRaw ? String(encounterIdRaw) : null;

  if (!encounterId) {
    return NextResponse.json(
      { ok: false, error: 'encounterId required' },
      { status: 400 },
    );
  }

  const { score, comment, createdAt } = body;

  // Forward only the rating payload to the encounter-specific handler,
  // preserving headers (auth, etc.) from the original request.
  const forwardedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify({ score, comment, createdAt }),
  });

  // Delegate to /api/encounters/[id]/rating POST handler
  return postEncounterRating(forwardedReq, { params: { id: encounterId } });
}
