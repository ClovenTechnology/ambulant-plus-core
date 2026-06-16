import { NextRequest, NextResponse } from 'next/server';
import { readJson, forwardToGateway, gatewayBaseFromEnv } from '../../clinicians/onboarding/_helpers';

export const runtime = 'edge';

function cleanStr(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function positiveInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

async function passThroughJson(res: Response) {
  const text = await res.text().catch(() => '');
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: json?.error || text || `HTTP_${res.status}`,
        status: res.status,
      },
      { status: res.status },
    );
  }

  return NextResponse.json(json ?? { ok: true }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const clinicianId = cleanStr(req.nextUrl.searchParams.get('clinicianId'), 120);

  if (!clinicianId) {
    return NextResponse.json(
      { ok: false, error: 'clinicianId_required' },
      { status: 400 },
    );
  }

  const gateway = trimSlash(gatewayBaseFromEnv());
  const adminKey = process.env.ADMIN_API_KEY ?? '';

  if (!gateway) {
    return NextResponse.json(
      { ok: false, error: 'gateway_not_configured' },
      { status: 500 },
    );
  }

  const upstream = `${gateway}/api/admin/simulation/appointments?clinicianId=${encodeURIComponent(clinicianId)}`;

  const res = await fetch(upstream, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-admin-key': adminKey,
      'x-uid': req.headers.get('x-uid') || 'admin-dashboard',
      'x-role': req.headers.get('x-role') || 'admin',
      'x-org-id': req.headers.get('x-org-id') || 'org-default',
    },
    cache: 'no-store',
  });

  return passThroughJson(res);
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const clinicianId = cleanStr(body?.clinicianId, 120);
  if (!clinicianId) {
    return NextResponse.json(
      { ok: false, error: 'clinicianId_required' },
      { status: 400 },
    );
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
