// apps/api-gateway/app/api/appointments/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { settleAppointment } from '@/src/lib/settlement';

export async function POST(req: NextRequest){
  const b = await req.json();
  const apptId = String(b.appointment_id || '');
  const kind   = String(b.kind || ''); // 'cancel_lt24h'|'no_show'|'clinician_miss'|'network_interrupt'
  const elapsed = b.elapsed_minutes ? Number(b.elapsed_minutes) : undefined;
  if (!apptId || !kind) return NextResponse.json({ error:'missing fields' }, { status:400 });

  const result = await settleAppointment(apptId, {
    reason: kind as any,
    elapsedMinutes: elapsed,
  });

  return NextResponse.json({ ok:true, result });
}
