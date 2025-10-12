import { NextRequest, NextResponse } from 'next/server';
import { store, nextPayId } from '@runtime/store';

export async function GET(req: NextRequest) {
  const encId = new URL(req.url).searchParams.get('encounterId');
  const all = Array.from(store.payments.values());
  return NextResponse.json(encId ? all.filter(p => p.encounterId === encId) : all);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { encounterId, caseId, amountCents, currency='ZAR', meta } = body || {};
  if (!encounterId || !caseId || !amountCents) {
    return NextResponse.json({ ok:false, error:'missing fields' }, { status: 400 });
  }
  const p = {
    id: nextPayId(),
    encounterId, caseId,
    amountCents, currency,
    status: 'captured' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta: meta || {},
  };
  store.payments.set(p.id, p);
  return NextResponse.json({ ok:true, payment: p });
}
