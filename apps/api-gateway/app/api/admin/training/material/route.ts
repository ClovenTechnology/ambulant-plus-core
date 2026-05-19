import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: unknown, max = 500): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function safeParseJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function pushMaterial(rawProfile: any, item: any) {
  const current = Array.isArray(rawProfile?.trainingMaterials)
    ? rawProfile.trainingMaterials
    : [];
  return {
    ...rawProfile,
    trainingMaterials: [item, ...current],
  };
}

async function persistRawProfileJson(db: any, clinicianId: string, clinician: any, profileJson: any) {
  const rawProfileJson = JSON.stringify(profileJson);

  try {
    const nextMeta =
      clinician?.meta && typeof clinician.meta === 'object'
        ? {
            ...(clinician.meta || {}),
            rawProfile: profileJson,
            rawProfileJson,
          }
        : {
            rawProfile: profileJson,
            rawProfileJson,
          };

    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: { meta: nextMeta },
    });
    return true;
  } catch {}

  try {
    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        metadata: clinician?.metadata
          ? { update: { rawProfileJson, rawProfile: profileJson } }
          : { create: { rawProfileJson, rawProfile: profileJson } },
      },
    });
    return true;
  } catch {}

  try {
    await db.clinicianProfile.update({
      where: { id: clinicianId },
      data: { rawProfileJson },
    });
    return true;
  } catch {}

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 120);
    const onboardingId = cleanStr(body.onboardingId, 120);
    const trainingSlotId = cleanStr(body.trainingSlotId, 120);
    const title = cleanStr(body.title, 240);
    const kind =
      cleanStr(body.kind, 40)?.toLowerCase() ||
      'link';
    const url = cleanStr(body.url, 1000);
    const fileKey = cleanStr(body.fileKey, 1000);
    const notes = cleanStr(body.notes, 2000);

    if (!clinicianId || !onboardingId || !trainingSlotId || !title) {
      return NextResponse.json(
        { ok: false, error: 'clinicianId, onboardingId, trainingSlotId, title required' },
        { status: 400 },
      );
    }

    if (!url && !fileKey) {
      return NextResponse.json(
        { ok: false, error: 'url_or_fileKey_required' },
        { status: 400 },
      );
    }

    const db: any = prisma;

    const clinician = await db.clinicianProfile.findUnique({ where: { id: clinicianId } });
    if (!clinician) {
      return NextResponse.json({ ok: false, error: 'clinician_not_found' }, { status: 404 });
    }

    const onboarding = await db.clinicianOnboarding.findUnique({ where: { id: onboardingId } });
    if (!onboarding || String(onboarding.clinicianId) !== clinicianId) {
      return NextResponse.json({ ok: false, error: 'onboarding_not_found' }, { status: 404 });
    }

    if (String(onboarding.trainingSlotId || '') !== trainingSlotId) {
      return NextResponse.json({ ok: false, error: 'training_slot_mismatch' }, { status: 409 });
    }

    const rawBase =
      safeParseJson((clinician as any)?.meta?.rawProfile) ||
      safeParseJson((clinician as any)?.meta?.rawProfileJson) ||
      safeParseJson((clinician as any)?.metadata?.rawProfile) ||
      safeParseJson((clinician as any)?.metadata?.rawProfileJson);

    const item = {
      id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      trainingSlotId,
      title,
      kind,
      url: url || null,
      fileKey: fileKey || null,
      notes: notes || null,
      uploadedAt: new Date().toISOString(),
    };

    const merged = pushMaterial(rawBase, item);
    await persistRawProfileJson(db, clinicianId, clinician, merged);

    return NextResponse.json(
      { ok: true, item },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][admin][training/materials][POST] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'training_material_create_failed') },
      { status: 500 },
    );
  }
}