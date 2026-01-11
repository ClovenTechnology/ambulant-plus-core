//apps/api-gateway/app/api/admin/clinicians/onboarding/create-dispatch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(v: any, max = 240): string | null {
  const s = (v ?? '').toString().trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function parseDateMaybe(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeItemKind(v: any): string {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (!s) return 'other';
  if (['device', 'merch', 'paperwork', 'other'].includes(s)) return s;
  if (s.includes('device') || s.includes('iot') || s.includes('monitor')) return 'device';
  if (s.includes('merch') || s.includes('hoodie') || s.includes('shirt')) return 'merch';
  if (s.includes('paper') || s.includes('doc')) return 'paperwork';
  return 'other';
}

/**
 * POST /api/admin/clinicians/onboarding/create-dispatch
 * Body:
 * {
 *   clinicianId: string,            // ClinicianProfile.id
 *   courier: string,
 *   trackingCode: string,
 *   trackingUrl?: string,
 *   etaDate?: string|Date,
 *   notes?: string,
 *   items?: Array<{ kind?: string, label: string, quantity?: number, deviceId?: string|null, isMandatory?: boolean }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as any;

    const clinicianId = cleanStr(body.clinicianId, 80);
    const courier = cleanStr(body.courier, 120);
    const trackingCode = cleanStr(body.trackingCode, 120);

    if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId required' }, { status: 400 });
    if (!courier) return NextResponse.json({ ok: false, error: 'courier required' }, { status: 400 });
    if (!trackingCode) return NextResponse.json({ ok: false, error: 'trackingCode required' }, { status: 400 });

    const onboarding = await prisma.clinicianOnboarding.findUnique({ where: { clinicianId } });
    if (!onboarding) return NextResponse.json({ ok: false, error: 'onboarding_not_found' }, { status: 404 });

    const trackingUrl = cleanStr(body.trackingUrl, 600);
    const etaDate = parseDateMaybe(body.etaDate);
    const notes = cleanStr(body.notes, 2000);

    const itemsIn = Array.isArray(body.items) ? (body.items as any[]) : [];

    const created = await prisma.clinicianDispatch.create({
      data: {
        onboardingId: onboarding.id,
        clinicianId,
        courier,
        trackingCode,
        trackingUrl: trackingUrl ?? null,
        etaDate: etaDate ?? null,
        status: 'prepared',
        notes: notes ?? null,
        items: {
          create: itemsIn.map((it) => ({
            kind: normalizeItemKind(it.kind),
            label: cleanStr(it.label, 240) ?? 'Item',
            quantity:
              Number.isFinite(Number(it.quantity)) && Number(it.quantity) >= 1 ? Math.round(Number(it.quantity)) : 1,
            deviceId: it.deviceId === null ? null : cleanStr(it.deviceId, 120),
            isMandatory: typeof it.isMandatory === 'boolean' ? it.isMandatory : true,
            isShipped: true,
          })),
        },
      },
      include: { items: true },
    });

    // Nudge onboarding status
    await prisma.clinicianOnboarding.update({
      where: { id: onboarding.id },
      data: { status: 'kit_prepared' },
    });

    return NextResponse.json({ ok: true, dispatch: created }, { status: 201 });
  } catch (err: any) {
    console.error('create-dispatch error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
