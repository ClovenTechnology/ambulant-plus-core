// apps/patient-app/app/api/encounters/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const enc = store.encounters.get(params.id);
  if (!enc) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json(enc);
}
