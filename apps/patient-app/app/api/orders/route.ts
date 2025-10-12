// apps/patient-app/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import orders from '../../../mock/orders.json';

// Force reload of JSON every request
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const body = await req.json();
  const newOrder = {
    id: `ord-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...body,
  };

  // In-memory append (not persisted to file in dev)
  (orders as any[]).push(newOrder);

  return NextResponse.json(newOrder, { status: 201 });
}
