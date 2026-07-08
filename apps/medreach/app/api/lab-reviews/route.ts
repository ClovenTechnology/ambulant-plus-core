// apps/medreach/app/api/lab-reviews/route.ts
import { NextRequest } from 'next/server';
import { proxyGateway } from '../lab-networks/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-reviews', 'GET');
}

export async function POST(req: NextRequest) {
  return proxyGateway(req, '/api/medreach/lab-reviews', 'POST');
}