// apps/clinician-app/app/api/notify/appointment/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // In real life you'd call Resend/Twilio here. For now we just log.
  const payload = await req.json().catch(()=> ({}));
  console.log('[notify] appointment event:', payload?.kind, payload?.appt?.id);
  return new NextResponse(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
  });
}

export function OPTIONS() {
  return new NextResponse(null, { headers: { 'access-control-allow-methods': 'POST,OPTIONS','access-control-allow-origin':'*' }});
}
