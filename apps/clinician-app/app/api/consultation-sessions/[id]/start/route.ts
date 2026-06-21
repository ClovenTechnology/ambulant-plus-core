// apps/clinician-app/app/api/consultation-sessions/[id]/start/route.ts
import { NextRequest } from 'next/server';
import { proxyConsultationSession } from '@/src/lib/consultation-session-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const id = encodeURIComponent(String(ctx.params.id || ''));
  return proxyConsultationSession(
    req,
    '/api/consultation-sessions/' + id + '/start',
    'POST',
  );
}
