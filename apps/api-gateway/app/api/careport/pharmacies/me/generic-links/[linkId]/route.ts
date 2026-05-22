//apps/api-gateway/app/api/careport/pharmacies/me/generic-links/[linkId]/route.ts
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

export async function DELETE(req: NextRequest, { params }: { params: { linkId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const linkId = clean(params.linkId, 120);
    if (!linkId) return json({ ok: false, error: 'linkId_required' }, 400);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const existing = await (prisma as any).carePortGenericLink.findFirst({ where: { id: linkId, orgId, pharmacyId } });
    if (!existing) return json({ ok: false, error: 'generic_link_not_found' }, 404);

    await (prisma as any).carePortGenericLink.delete({ where: { id: linkId } });

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_generic_link_deleted',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: linkId,
        meta: { orgId, pharmacyId, originalSkuId: existing.originalSkuId, genericSkuId: existing.genericSkuId },
      },
    }).catch(() => null);

    return json({ ok: true });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'generic_link_delete_failed' }, error?.status || 500);
  }
}
