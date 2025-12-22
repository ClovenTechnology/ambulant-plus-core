// apps/admin-dashboard/app/api/admin/shop/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(_req: NextRequest) {
  try {
    const base = mustEnv('API_GATEWAY_BASE_URL');
    const key = mustEnv('API_GATEWAY_ADMIN_KEY');

    const res = await fetch(`${base}/api/admin/shop`, {
      method: 'GET',
      headers: { 'x-admin-key': key },
      cache: 'no-store',
    });

    const js = await res.json().catch(() => ({}));
    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Proxy failed' }, { status: 500 });
  }
}
