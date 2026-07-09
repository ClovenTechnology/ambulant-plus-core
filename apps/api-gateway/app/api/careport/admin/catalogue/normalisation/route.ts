import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(raw)) return true;
  if (['false', '0', 'no', 'n'].includes(raw)) return false;
  return fallback;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function allowedAction(value: unknown) {
  const action = clean(value, 80).toLowerCase();

  if (['verify', 'admin_verify', 'approve'].includes(action)) return 'verify';
  if (['match_global', 'global_match', 'map_global'].includes(action)) return 'match_global';
  if (['request_review', 'flag', 'needs_review'].includes(action)) return 'request_review';
  if (['reject', 'reject_mapping'].includes(action)) return 'reject';
  if (['clear_review', 'dismiss'].includes(action)) return 'clear_review';

  return '';
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'system']);

    const q = clean(req.nextUrl.searchParams.get('q'), 160);
    const pharmacyId = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);
    const status = clean(req.nextUrl.searchParams.get('status'), 80).toUpperCase();
    const source = clean(req.nextUrl.searchParams.get('source'), 80).toUpperCase();
    const review = clean(req.nextUrl.searchParams.get('reviewRequired') ?? req.nextUrl.searchParams.get('review'), 20).toLowerCase();
    const productType = clean(req.nextUrl.searchParams.get('productType'), 80).toUpperCase();
    const category = clean(req.nextUrl.searchParams.get('category'), 120);
    const limit = Math.min(300, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 100)));

    const where: any = { orgId };

    if (pharmacyId) where.pharmacyId = pharmacyId;
    if (status && status !== 'ALL') where.normalisationStatus = status;
    if (source && source !== 'ALL') where.catalogueSource = source;
    if (productType && productType !== 'ALL') where.productType = productType;
    if (category) where.category = { equals: category, mode: 'insensitive' };

    if (review === 'true' || review === '1' || review === 'yes') where.reviewRequired = true;
    if (review === 'false' || review === '0' || review === 'no') where.reviewRequired = false;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { canonicalName: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { drugCode: { contains: q, mode: 'insensitive' } },
        { skuCode: { contains: q, mode: 'insensitive' } },
        { globalProductKey: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await (prisma as any).carePortPharmacySku.findMany({
      where,
      orderBy: [
        { reviewRequired: 'desc' },
        { updatedAt: 'desc' },
        { name: 'asc' },
      ],
      take: limit,
    });

    const pharmacyIds = Array.from(new Set(items.map((item: any) => item.pharmacyId).filter(Boolean)));

    const pharmacies = pharmacyIds.length
      ? await (prisma as any).pharmacyPartner.findMany({
          where: { id: { in: pharmacyIds } },
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            active: true,
          },
        })
      : [];

    const pharmacyById = new Map(pharmacies.map((pharmacy: any) => [pharmacy.id, pharmacy]));

    const rows = items.map((item: any) => ({
      ...item,
      pharmacy: pharmacyById.get(item.pharmacyId) ?? null,
    }));

    return json({
      ok: true,
      items: rows,
      queue: rows,
      count: rows.length,
      filters: {
        reviewRequired: review || null,
        status: status || null,
        source: source || null,
        productType: productType || null,
        category: category || null,
      },
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'catalogue_normalisation_load_failed', items: [] }, error?.status || 500);
  }
}

export async function PATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'system']);

    const body = await req.json().catch(() => ({}));
    const skuId = clean(body?.skuId ?? body?.id, 120);
    const action = allowedAction(body?.action);

    if (!skuId) return json({ ok: false, error: 'skuId_required' }, 400);
    if (!action) return json({ ok: false, error: 'valid_action_required' }, 400);

    const existing = await (prisma as any).carePortPharmacySku.findFirst({
      where: { id: skuId, orgId },
    });

    if (!existing) return json({ ok: false, error: 'sku_not_found' }, 404);

    const note = clean(body?.normalisationNotes ?? body?.note ?? body?.reason, 2000);
    const canonicalName = clean(body?.canonicalName ?? body?.name, 500);
    const globalProductKey = clean(body?.globalProductKey ?? body?.globalKey, 180);
    const reviewReason = clean(body?.reviewReason ?? body?.reason, 2000);
    const normalisedAttributes =
      body?.normalisedAttributes && typeof body.normalisedAttributes === 'object' && !Array.isArray(body.normalisedAttributes)
        ? body.normalisedAttributes
        : undefined;

    const data: any = {};

    if (action === 'verify') {
      data.normalisationStatus = 'ADMIN_VERIFIED';
      data.reviewRequired = false;
      data.reviewReason = null;
      if (canonicalName) data.canonicalName = canonicalName;
      if (globalProductKey) data.globalProductKey = globalProductKey;
      if (normalisedAttributes !== undefined) data.normalisedAttributes = normalisedAttributes;
    }

    if (action === 'match_global') {
      if (!globalProductKey && !canonicalName) {
        return json({ ok: false, error: 'globalProductKey_or_canonicalName_required' }, 400);
      }

      data.normalisationStatus = 'GLOBAL_CATALOGUE_MATCHED';
      data.reviewRequired = false;
      data.reviewReason = null;
      if (canonicalName) data.canonicalName = canonicalName;
      if (globalProductKey) data.globalProductKey = globalProductKey;
      if (normalisedAttributes !== undefined) data.normalisedAttributes = normalisedAttributes;
      data.normalisationConfidence = 0.99;
    }

    if (action === 'request_review') {
      data.normalisationStatus = 'RAW_PHARMACY_SUPPLIED';
      data.reviewRequired = true;
      data.reviewReason = reviewReason || 'Admin requested catalogue review.';
    }

    if (action === 'reject') {
      data.normalisationStatus = 'REJECTED';
      data.reviewRequired = false;
      data.reviewReason = reviewReason || null;
    }

    if (action === 'clear_review') {
      data.reviewRequired = false;
      data.reviewReason = null;
      if (existing.normalisationStatus === 'RAW_PHARMACY_SUPPLIED') {
        data.normalisationStatus = 'MAPPED_TO_TEMPLATE';
      }
    }

    if (note) data.normalisationNotes = note;

    data.reviewedBy = who.uid ?? null;
    data.reviewedAt = new Date();

    if (body?.marketplaceVisible !== undefined) data.marketplaceVisible = asBool(body.marketplaceVisible, existing.marketplaceVisible);
    if (body?.prescriptionRequired !== undefined) data.prescriptionRequired = asBool(body.prescriptionRequired, existing.prescriptionRequired);
    if (body?.otc !== undefined) data.otc = asBool(body.otc, existing.otc);

    const item = await (prisma as any).carePortPharmacySku.update({
      where: { id: existing.id },
      data,
    });

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_catalogue_normalisation_reviewed',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: item.id,
        meta: {
          orgId,
          action,
          previousStatus: existing.normalisationStatus,
          nextStatus: item.normalisationStatus,
          previousReviewRequired: existing.reviewRequired,
          nextReviewRequired: item.reviewRequired,
          globalProductKey: item.globalProductKey,
          canonicalName: item.canonicalName,
        },
      },
    }).catch(() => null);

    return json({ ok: true, item });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'catalogue_normalisation_update_failed' }, error?.status || 500);
  }
}
