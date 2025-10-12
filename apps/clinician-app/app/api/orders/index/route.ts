import { NextRequest, NextResponse } from 'next/server';
import { store } from '@runtime/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encId = url.searchParams.get('encounterId') || undefined;

  const erx = Array.from(store.erxOrders.values());
  const lab = Array.from(store.labOrders.values());

  const rows = [...erx, ...lab]
    .filter(o => !encId || o.encounterId === encId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // stable, simple wire shape for lists
  const data = rows.map(o => ({
    id: o.id,
    kind: 'eRx' in o ? 'pharmacy' : 'lab',
    encounterId: o.encounterId,
    sessionId: o.sessionId,
    caseId: o.caseId,
    createdAt: ('createdAt' in o ? o.createdAt : undefined) as string | undefined,
    title: 'eRx' in o ? `${o.eRx.drug}` : (o as any).panel,
    details: 'eRx' in o ? (o.eRx.sig ?? '') : '',
  }));

  return NextResponse.json(data);
}
