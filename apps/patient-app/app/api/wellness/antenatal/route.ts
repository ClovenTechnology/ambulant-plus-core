import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readPatientGatewayIdentity } from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function asObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {}
  }
  return {};
}

async function context(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return { ok: false as const, response: json({ ok: false, error: 'patient_authentication_required' }, 401) };
  const profile = await prisma.patientProfile.findFirst({ where: { id: identity.patientId, userId: identity.uid } });
  if (!profile) return { ok: false as const, response: json({ ok: false, error: 'patient_profile_not_found' }, 404) };
  return { ok: true as const, identity, profile };
}

export async function GET(req: NextRequest) {
  const access = await context(req);
  if (!access.ok) return access.response;
  const meta = asObject(access.profile.profileMetadata);
  const data = asObject(meta.antenatalCenterData);
  return json({
    ok: true,
    data: {
      prefs: data.prefs ?? null,
      logs: Array.isArray(data.logs) ? data.logs : [],
      labs: asObject(data.labs),
      erx: Array.isArray(data.erx) ? data.erx : [],
    },
  });
}

export async function PATCH(req: NextRequest) {
  const access = await context(req);
  if (!access.ok) return access.response;
  const body = await req.json().catch(() => ({} as any));
  const section = String(body?.section || '').trim();
  if (!['prefs', 'logs', 'labs', 'erx'].includes(section)) {
    return json({ ok: false, error: 'antenatal_section_invalid' }, 400);
  }
  const serialized = JSON.stringify(body?.value ?? null);
  if (Buffer.byteLength(serialized, 'utf8') > 400_000) {
    return json({ ok: false, error: 'antenatal_section_too_large' }, 413);
  }

  const meta = asObject(access.profile.profileMetadata);
  const current = asObject(meta.antenatalCenterData);
  const next = { ...current, [section]: body?.value ?? null };
  await prisma.patientProfile.update({
    where: { id: access.profile.id },
    data: { profileMetadata: { ...meta, antenatalCenterData: next } },
  });
  return json({ ok: true });
}
