import { NextRequest, NextResponse } from 'next/server';
import { readIdentity } from '@/src/lib/identity';
import { getClinician, setClinicianFee } from '@/src/store/appointments';

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' || !who.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const row = await getClinician(who.uid);
  return NextResponse.json({ fee_cents: row?.feeCents ?? 0, currency: row?.currency ?? 'ZAR' });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'clinician' || !who.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { fee_cents, currency } = await req.json();
  await setClinicianFee(who.uid, Number(fee_cents||0), String(currency||'ZAR').toUpperCase());
  return NextResponse.json({ ok: true });
}
