import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = [
    { id: 'a-hr-1',  vital: 'Blood Pressure', value: '165/101', level: 'red',   when: new Date(Date.now()-60*60*1000).toLocaleString() },
    { id: 'a-spo2-1',vital: 'SpO₂',           value: '89%',     level: 'amber', when: new Date(Date.now()-5*60*60*1000).toLocaleString() },
  ];
  return NextResponse.json({ items });
}
