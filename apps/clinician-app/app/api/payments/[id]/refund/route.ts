import { NextRequest, NextResponse } from 'next/server';
import { store } from '@runtime/store';

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const p = store.payments.get(params.id);
  if (!p) return NextResponse.json({ ok:false, error:'not_found' }, { status: 404 });
  if (p.status === 'refunded') return NextResponse.json({ ok:true, payment: p });
  p.status = 'refunded';
  p.updatedAt = new Date().toISOString();
  return NextResponse.json({ ok:true, payment: p });
}
