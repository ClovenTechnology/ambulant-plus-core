// apps/careport/app/api/pharmacies/[pharmacyId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { pharmacyId: string } }) {
  const pharmacyId = String(params.pharmacyId || '').trim();

  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_pharmacy_route_disabled',
      pharmacyId,
      message:
        'This legacy pharmacy endpoint has been retired. Use gateway-backed CarePort pharmacy routes instead.',
      replacements: {
        currentPharmacyInventory: '/api/careport/pharmacies/me/inventory',
        currentPharmacyOffers: '/api/careport/pharmacies/me/offers',
        currentPharmacyOrders: '/api/careport/pharmacies/me/orders',
        adminPharmacies: '/api/careport/admin/pharmacies',
      },
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
