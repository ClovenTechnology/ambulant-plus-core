import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch {}
  }
  return {};
}

async function context(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return { ok: false as const, response: json({ ok: false, error: 'patient_authentication_required' }, 401) };
  const profile = await prisma.patientProfile.findFirst({ where: { id: identity.patientId, userId: identity.uid } });
  if (!profile) return { ok: false as const, response: json({ ok: false, error: 'patient_profile_not_found' }, 404) };
  return { ok: true as const, profile };
}

export async function GET(req: NextRequest) {
  const access = await context(req);
  if (!access.ok) return access.response;
  const meta = asObject(access.profile.profileMetadata);
  return json({ ok: true, prefs: asObject(meta.fertilityPreferences) });
}

export async function PUT(req: NextRequest) {
  const access = await context(req);
  if (!access.ok) return access.response;
  const body = await req.json().catch(() => ({} as any));
  const lmp = String(body?.lmp || '').trim().slice(0, 10);
  const cycleDays = Math.max(20, Math.min(40, Math.round(Number(body?.cycleDays || 28))));
  if (lmp && !/^\d{4}-\d{2}-\d{2}$/.test(lmp)) return json({ ok: false, error: 'lmp_invalid' }, 400);

  const meta = asObject(access.profile.profileMetadata);
  await prisma.patientProfile.update({
    where: { id: access.profile.id },
    data: { profileMetadata: { ...meta, fertilityPreferences: { lmp, cycleDays } } },
  });
  return json({ ok: true, prefs: { lmp, cycleDays } });
}
