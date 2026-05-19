//apps/api-gateway/app/api/careport/pharmacies/me/kyc/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, requireRole, pharmacyIdForStaff } from '@/src/lib/careport';
import { COUNTRY_CONFIG, validatePharmacyKyc } from '@/src/lib/kyc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);

  // If "pharmacy" users are modeled such that uid === pharmacyPartner.id, this works.
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);

  // Pharmacy staff: map userId -> pharmacyId
  if (who.role === 'pharmacy_staff' && who.uid) {
    const pid = await pharmacyIdForStaff(orgId, who.uid);
    return pid ? String(pid) : null;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

  const pharmacyId = await resolvePharmacyId(req, who);
  if (!pharmacyId) return NextResponse.json({ ok: false, error: 'pharmacyId_unresolved' }, { status: 409 });

  const pharmacy = await prisma.pharmacyPartner.findUnique({ where: { id: pharmacyId } });
  if (!pharmacy) return NextResponse.json({ ok: false, error: 'pharmacy_not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, pharmacy }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

  const pharmacyId = await resolvePharmacyId(req, who);
  if (!pharmacyId) return NextResponse.json({ ok: false, error: 'pharmacyId_unresolved' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const country = String(body?.country || 'ZA').toUpperCase() as keyof typeof COUNTRY_CONFIG;
  const schemaKey = String(body?.schemaKey || 'ZA_SAPC_PHARMACY_v1') as any;
  const payload = body?.payload ?? null;

  const cfg = COUNTRY_CONFIG[country];
  if (!cfg) return NextResponse.json({ ok: false, error: 'unsupported_country' }, { status: 400 });

  const v = validatePharmacyKyc(country as any, schemaKey, payload);
  if (!v.ok) return NextResponse.json({ ok: false, error: 'invalid_payload', issues: v.errors }, { status: 400 });

  const updated = await prisma.pharmacyPartner.update({
    where: { id: pharmacyId },
    data: {
      country,
      currency: cfg.currency,
      kycSchemaKey: schemaKey,
      kycPayload: v.data as any,
      kycSubmittedAt: new Date(),
      kycVerifiedAt: null,
      kycRejectedReason: null,
      kycStatus: 'PENDING_REVIEW',
    } as any,
  });

  return NextResponse.json({ ok: true, pharmacy: updated }, { status: 200 });
}