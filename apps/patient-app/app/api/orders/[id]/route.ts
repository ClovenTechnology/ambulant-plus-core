// apps/patient-app/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import orders from '../../../../mock/orders.json';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const order = (orders as any[]).find(o => o.id === params.id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json(order);
}
