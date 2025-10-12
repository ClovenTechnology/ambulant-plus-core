// apps/clinician-app/app/api/availability/[clinicianId]/route.ts
import { NextResponse } from 'next/server';

function genSlots() {
  const now = new Date();
  const out: { label: string; dateISO: string; slots: string[] }[] = [];
  for (let i=0;i<7;i++){
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const dateISO = d.toISOString().slice(0,10);
    out.push({ label, dateISO, slots: ['09:00','10:30','14:00','16:00'] });
  }
  return out;
}

export async function GET(_: Request, { params }: { params: { clinicianId: string } }) {
  const days = genSlots();
  return new NextResponse(JSON.stringify({ clinicianId: params.clinicianId, days }), {
    headers: { 'content-type':'application/json', 'access-control-allow-origin':'*' }
  });
}
