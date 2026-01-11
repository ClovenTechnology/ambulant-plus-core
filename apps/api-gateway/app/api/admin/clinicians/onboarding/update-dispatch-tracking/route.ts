//apps/api-gateway/app/api/admin/clinicians/onboarding/update-dispatch-tracking/route.ts
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

function normalizeDispatchStatus(v: any): string | null {
  const s = cleanStr(v, 48);
  if (!s) return null;
  // keep open string statuses, but normalize some common ones
  const n = s.toLowerCase();
  if (n === 'prep' || n === 'prepared') return 'prepared';
  if (n === 'ship' || n === 'shipped') return 'shipped';
  if (n === 'deliver' || n === 'delivered') return 'delivered';
  if (n === 'cancel' || n === 'cancelled') return 'cancelled';
  return s;
}

function normalizeItemKind(v: any): string {
  const s = (v ?? '').toString().trim().toLowerCase();
  if (!s) return 'other';
  if (['device', 'merch', 'paperwork', 'other'].includes(s)) return s;
  // light heuristics
  if (s.includes('device') || s.includes('iot') || s.includes('monitor')) return 'device';
  if (s.includes('merch') || s.includes('hoodie') || s.includes('shirt')) return 'merch';
  if (s.includes('paper') || s.includes('doc')) return 'paperwork';
  return 'other';
}

/**
 * POST /api/admin/clinicians/onboarding/update-dispatch-tracking
 * Body:
 * {
 *   dispatchId: string,
 *   courier?: string,
 *   trackingCode?: string,
 *   trackingUrl?: string,
 *   etaDate?: string|Date,
 *   status?: string,
 *   shippedAt?: string|Date,
 *   deliveredAt?: string|Date,
 *   notes?: string,
 *   replaceItems?: boolean,
 *   items?: Array<{
 *     id?: string,
 *     kind?: string,
 *     label?: string,
 *     quantity?: number,
 *     deviceId?: string|null,
 *     isMandatory?: boolean,
 *     isShipped?: boolean
 *   }>
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const isAdmin = await verifyAdminRequest(req);
    if (!isAdmin) return NextResponse.json({ ok: false, error: 'admin_required' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as any;

    const dispatchId = cleanStr(body.dispatchId, 80);
    if (!dispatchId) {
      return NextResponse.json({ ok: false, error: 'dispatchId required' }, { status: 400 });
    }

    const existing = await prisma.clinicianDispatch.findUnique({
      where: { id: dispatchId },
      include: { onboarding: true, items: true },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: 'dispatch_not_found' }, { status: 404 });
    }

    const data: any = {};

    const courier = cleanStr(body.courier, 120);
    const trackingCode = cleanStr(body.trackingCode, 120);
    const trackingUrl = cleanStr(body.trackingUrl, 600);
    const status = normalizeDispatchStatus(body.status);
    const notes = cleanStr(body.notes, 2000);

    const etaDate = parseDateMaybe(body.etaDate);
    const shippedAt = parseDateMaybe(body.shippedAt);
    const deliveredAt = parseDateMaybe(body.deliveredAt);

    if (courier != null) data.courier = courier;
    if (trackingCode != null) data.trackingCode = trackingCode;
    if (trackingUrl != null) data.trackingUrl = trackingUrl;
    if (etaDate) data.etaDate = etaDate;
    if (notes != null) data.notes = notes;

    // Status/timestamps logic (don’t clobber timestamps if you already set them)
    if (status) data.status = status;

    if (shippedAt) {
      data.shippedAt = shippedAt;
      if (!status) data.status = 'shipped';
    }
    if (deliveredAt) {
      data.deliveredAt = deliveredAt;
      if (!status) data.status = 'delivered';
    }

    // If status says delivered/shipped but timestamp missing, you may want auto timestamps.
    // Keep conservative: only auto-stamp if explicitly requested.
    if (body.autoStamp === true) {
      if ((data.status === 'shipped' || data.status === 'delivered') && !existing.shippedAt && !data.shippedAt) {
        data.shippedAt = new Date();
      }
      if (data.status === 'delivered' && !existing.deliveredAt && !data.deliveredAt) {
        data.deliveredAt = new Date();
      }
    }

    const replaceItems = body.replaceItems === true;
    const itemsIn = Array.isArray(body.items) ? (body.items as any[]) : null;

    const result = await prisma.$transaction(async (tx) => {
      const updatedDispatch = await tx.clinicianDispatch.update({
        where: { id: dispatchId },
        data,
      });

      if (itemsIn && itemsIn.length) {
        const keepIds: string[] = [];

        for (const raw of itemsIn) {
          const itemId = cleanStr(raw?.id, 80);
          const kind = normalizeItemKind(raw?.kind);
          const label = cleanStr(raw?.label, 240);
          const quantity =
            Number.isFinite(Number(raw?.quantity)) && Number(raw.quantity) >= 1 ? Math.round(Number(raw.quantity)) : null;

          const deviceId = raw?.deviceId === null ? null : cleanStr(raw?.deviceId, 120);
          const isMandatory = typeof raw?.isMandatory === 'boolean' ? raw.isMandatory : null;
          const isShipped = typeof raw?.isShipped === 'boolean' ? raw.isShipped : null;

          const itemData: any = {};
          if (kind) itemData.kind = kind;
          if (label != null) itemData.label = label;
          if (quantity != null) itemData.quantity = quantity;
          if (deviceId !== undefined) itemData.deviceId = deviceId;
          if (isMandatory != null) itemData.isMandatory = isMandatory;
          if (isShipped != null) itemData.isShipped = isShipped;

          if (itemId) {
            const u = await tx.clinicianDispatchItem.update({
              where: { id: itemId },
              data: itemData,
            });
            keepIds.push(u.id);
          } else {
            const c = await tx.clinicianDispatchItem.create({
              data: {
                dispatchId,
                kind: itemData.kind ?? 'other',
                label: itemData.label ?? 'Item',
                quantity: itemData.quantity ?? 1,
                deviceId: itemData.deviceId ?? null,
                isMandatory: itemData.isMandatory ?? true,
                isShipped: itemData.isShipped ?? true,
              },
            });
            keepIds.push(c.id);
          }
        }

        if (replaceItems) {
          await tx.clinicianDispatchItem.deleteMany({
            where: {
              dispatchId,
              id: { notIn: keepIds },
            },
          });
        }
      }

      // Update onboarding status (light-touch; your status strings are open)
      const nextDispatchStatus = (data.status as string | undefined) ?? existing.status;
      const onboardUpdate: any = {};

      if (nextDispatchStatus === 'delivered' || data.deliveredAt) {
        onboardUpdate.status = 'kit_delivered';
      } else if (nextDispatchStatus === 'shipped' || data.shippedAt) {
        onboardUpdate.status = 'kit_shipped';
      }

      if (Object.keys(onboardUpdate).length) {
        await tx.clinicianOnboarding.update({
          where: { id: existing.onboardingId },
          data: onboardUpdate,
        });
      }

      const hydrated = await tx.clinicianDispatch.findUnique({
        where: { id: dispatchId },
        include: { items: true, onboarding: true },
      });

      return hydrated;
    });

    return NextResponse.json({ ok: true, dispatch: result });
  } catch (err: any) {
    console.error('update-dispatch-tracking error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
