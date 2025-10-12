// app/api/vitals/route.ts
import { NextResponse } from 'next/server';

type Vital = {
  ts: string;             // ISO date
  hr?: number;            // bpm
  spo2?: number;          // %
  temp_c?: number;        // °C
  sys?: number; dia?: number; // BP
  bmi?: number;
  source?: 'manual' | 'iomt';
};

// In-memory store for dev (resets on restart)
let VITALS: Vital[] = [
  { ts: new Date(Date.now()-3600*1000*24).toISOString(), hr: 74, spo2: 98, temp_c: 36.7, sys: 118, dia: 76, bmi: 24.2, source: 'iomt' },
  { ts: new Date(Date.now()-3600*1000*12).toISOString(), hr: 72, spo2: 99, temp_c: 36.6, sys: 116, dia: 74, bmi: 24.2, source: 'iomt' },
  { ts: new Date(Date.now()-3600*1000*2).toISOString(),  hr: 78, spo2: 98, temp_c: 36.8, sys: 120, dia: 78, bmi: 24.3, source: 'iomt' }
];

export async function GET() {
  // newest first
  return NextResponse.json(VITALS.slice().sort((a,b)=> (a.ts<b.ts?1:-1)));
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<Vital>;
  const item: Vital = {
    ts: new Date().toISOString(),
    source: body.source ?? 'manual',
    hr: body.hr, spo2: body.spo2, temp_c: body.temp_c, sys: body.sys, dia: body.dia, bmi: body.bmi
  };
  VITALS.push(item);
  return NextResponse.json({ ok: true, item }, { status: 201 });
}
