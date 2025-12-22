// apps/careport/app/api/pharmacies/[pharmacyId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PHARMACIES } from '../../jobs/data';

export async function GET(
  _req: NextRequest,
  { params }: { params: { pharmacyId: string } },
) {
  const pharmacy = PHARMACIES.find((p) => p.id === params.pharmacyId);
  if (!pharmacy) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ pharmacy });
}
