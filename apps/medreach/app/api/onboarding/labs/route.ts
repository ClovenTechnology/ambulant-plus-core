import { NextRequest, NextResponse } from 'next/server';
import { gatewayUrl, medreachHeaders } from '../_gateway';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  try {
    const url = gatewayUrl('/api/medreach/labs?active=true&status=ACTIVE&limit=200');
    if (!url) throw new Error('gateway_not_configured');
    const res = await fetch(url, { headers: medreachHeaders(req, 'public-lab-directory'), cache: 'no-store', redirect: 'error' });
    if (!res.ok) throw new Error('directory_unavailable');
    const data = await res.json();
    const rows = data.data || data.labs || [];
    return NextResponse.json({ ok: true, data: rows.map((lab: any) => ({ id: lab.id, name: lab.name, displayName: lab.displayName, active: true })) }, { headers: { 'cache-control': 'no-store' } });
  } catch { return NextResponse.json({ ok: false, error: 'directory_unavailable' }, { status: 503 }); }
}
