// apps/clinician-app/app/api/consultation-sessions/by-appointment/[appointmentId]/route.ts
import { NextRequest } from 'next/server';
import { proxyConsultationSession } from '@/src/lib/consultation-session-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: { appointmentId: string } },
) {
  const appointmentId = encodeURIComponent(String(ctx.params.appointmentId || ''));
  return proxyConsultationSession(
    req,
    '/api/consultation-sessions/by-appointment/' + appointmentId,
    'GET',
  );
}
