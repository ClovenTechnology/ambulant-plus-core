// apps/admin-dashboard/app/api/admin/medreach/labs/route.ts
import { NextRequest } from 'next/server';
import { proxyJson, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  return proxyJson(req, {
    method: 'GET',
    path: '/api/medreach/labs',
    search: url.search,
  });
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  return proxyJson(req, {
    method: 'POST',
    path: '/api/medreach/labs',
    body,
  });
}