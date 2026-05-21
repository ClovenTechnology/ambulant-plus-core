import { NextRequest } from 'next/server';
import { proxyJsonGET } from '@/app/api/_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyJsonGET(req, {
    path: '/api/patient/adherence-summary',
    forwardQuery: true,
  });
}
