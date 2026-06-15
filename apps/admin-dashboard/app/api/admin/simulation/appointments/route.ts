import { NextRequest } from 'next/server';
import { readJson, forwardToGateway } from '../../clinicians/onboarding/_helpers';

export const runtime = 'edge';

function cleanStr(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = cleanStr(body?.clinicianId, 120);
  if (!clinicianId) {
    return new Response('clinicianId required', { status: 400 });
  }

  const startsAt = cleanStr(body?.startsAt, 120);
  const durationMinutes = positiveInt(body?.durationMinutes, 30, 10, 120);
  const sessionNumber = positiveInt(body?.sessionNumber, 1, 1, 3);

  return forwardToGateway(req, '/api/admin/simulation/appointments', {
    clinicianId,
    startsAt: startsAt || undefined,
    durationMinutes,
    sessionNumber,
    patientId: cleanStr(body?.patientId, 120) || undefined,
    patientName: cleanStr(body?.patientName, 180) || `Simulation Patient ${sessionNumber}`,
    reason:
      cleanStr(body?.reason, 500) ||
      `Supervised onboarding simulation consultation ${sessionNumber} of 3`,
  });
}
