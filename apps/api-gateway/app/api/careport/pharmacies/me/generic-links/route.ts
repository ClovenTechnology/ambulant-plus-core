//apps/api-gateway/app/api/careport/pharmacies/me/generic-links/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);
  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);
  if (who.role === 'pharmacy_staff' && who.uid) return await pharmacyIdForStaff(orgId, who.uid);
  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);
    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved', links: [] }, 409);

    const links = await (prisma as any).carePortGenericLink.findMany({
      where: { orgId, pharmacyId },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    }).catch(async () => {
      return (prisma as any).carePortGenericLink.findMany({ where: { orgId, pharmacyId }, take: 500 });
    });

    const skuIds = Array.from(new Set(links.flatMap((link: any) => [link.originalSkuId, link.genericSkuId]).filter(Boolean)));
    const skus = skuIds.length
      ? await (prisma as any).carePortPharmacySku.findMany({ where: { id: { in: skuIds }, pharmacyId }, take: 1000 })
      : [];
    const skuById = new Map(skus.map((sku: any) => [String(sku.id), sku]));
    const enriched = links.map((link: any) => ({
      ...link,
      originalSku: skuById.get(String(link.originalSkuId)) ?? null,
      genericSku: skuById.get(String(link.genericSkuId)) ?? null,
    }));

    return json({ ok: true, pharmacyId, links: enriched });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'generic_links_load_failed', links: [] }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);
    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const body = await req.json().catch(() => ({}));
    const originalSkuId = clean(body?.originalSkuId, 120);
    const genericSkuId = clean(body?.genericSkuId, 120);
    if (!originalSkuId || !genericSkuId) return json({ ok: false, error: 'originalSkuId_and_genericSkuId_required' }, 400);
    if (originalSkuId === genericSkuId) return json({ ok: false, error: 'generic_must_differ_from_original' }, 400);

    const skus = await (prisma as any).carePortPharmacySku.findMany({
      where: { id: { in: [originalSkuId, genericSkuId] }, orgId, pharmacyId, isActive: true },
      take: 2,
    });
    const original = skus.find((s: any) => s.id === originalSkuId);
    const generic = skus.find((s: any) => s.id === genericSkuId);
    if (!original) return json({ ok: false, error: 'original_sku_not_found' }, 404);
    if (!generic) return json({ ok: false, error: 'generic_sku_not_found' }, 404);
    if (original.isGeneric) return json({ ok: false, error: 'original_sku_must_not_be_generic' }, 409);
    if (!generic.isGeneric) return json({ ok: false, error: 'generic_sku_must_be_generic' }, 409);

    const existing = await (prisma as any).carePortGenericLink.findFirst({ where: { orgId, pharmacyId, originalSkuId, genericSkuId } });
    if (existing) return json({ ok: true, link: existing, alreadyExists: true });

    const created = await (prisma as any).carePortGenericLink.create({ data: { orgId, pharmacyId, originalSkuId, genericSkuId } });
    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_generic_link_created',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: created.id,
        meta: { orgId, pharmacyId, originalSkuId, genericSkuId },
      },
    }).catch(() => null);

    return json({ ok: true, link: created }, 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'generic_link_create_failed' }, error?.status || 500);
  }
}
