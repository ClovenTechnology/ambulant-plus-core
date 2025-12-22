// apps/app-gateway/app/api/appointments/[id]/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateApptStatus } from '@/src/appointmentsStore';

export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  const updated = updateApptStatus(params.id, 'cancelled');
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(updated, { headers: { 'access-control-allow-origin': '*' } });
}
export const dynamic = 'force-dynamic';
