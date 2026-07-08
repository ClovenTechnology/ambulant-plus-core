// apps/medreach/app/api/lab-networks/route.ts
import { NextRequest } from 'next/server';
import { proxyGateway } from './_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-networks', 'GET');
}

export async function POST(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-networks', 'POST');
}