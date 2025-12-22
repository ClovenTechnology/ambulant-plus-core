// apps/patient-app/app/api/erx/encounter/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as store from '../../../encounters/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const APIGW = process.env.NEXT_PUBLIC_APIGW_BASE || 'http://localhost:3010';

type ErxMedOut = {
  id: string;
  encounterId: string;
  name: string;
  dose: string;
  frequency: string;
  route: string;
  durationDays?: number;
  orderId?: string;
  sig?: string;
};

function parseDurationFromSig(sig: string | null | undefined): number | undefined {
  if (!sig) return undefined;
  const s = sig.toLowerCase();

  // pattern: ... x5d
  const m1 = s.match(/x\s*(\d{1,3})\s*d\b/);
  if (m1 && m1[1]) {
    const n = Number(m1[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // pattern: for 5 days
  const m2 = s.match(/for\s+(\d{1,3})\s+day/);
  if (m2 && m2[1]) {
    const n = Number(m2[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return undefined;
}

async function fetchFromGateway(encounterId: string): Promise<ErxMedOut[] | null> {
  try {
    const url = `${APIGW.replace(/\/$/, '')}/api/orders/index?encounterId=${encodeURIComponent(
      encounterId
    )}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const rows: any[] = await res.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const out: ErxMedOut[] = [];

    for (const row of rows) {
      if (!row || row.kind !== 'pharmacy') continue;

      const orderId = String(row.id);
      const encId = String(row.encounterId || encounterId);
      const name = String(row.title || 'Medication');
      const sig = typeof row.details === 'string' ? row.details : '';
      const durationDays = parseDurationFromSig(sig);

      out.push({
        id: orderId,
        encounterId: encId,
        name,
        dose: '', // could be parsed from sig later if needed
        frequency: sig,
        route: '',
        durationDays,
        orderId,
        sig,
      });
    }

    return out;
  } catch (err) {
    console.error('[erx/encounter:id] gateway error', err);
    return null;
  }
}

function buildMockForEncounter(encounterId: string): ErxMedOut[] {
  let title = '';
  try {
    const enc = store.getEncounter?.(encounterId);
    title = (enc as any)?.caseTitle || (enc as any)?.title || '';
  } catch {
    // ignore
  }

  const lower = title.toLowerCase();
  if (lower.includes('hypertension')) {
    return [
      {
        id: `${encounterId}-rx-1`,
        encounterId,
        name: 'Amlodipine',
        dose: '5 mg',
        frequency: 'Once daily',
        route: 'Oral',
        durationDays: 30,
        orderId: encounterId,
        sig: '1 tablet po od x30d',
      },
      {
        id: `${encounterId}-rx-2`,
        encounterId,
        name: 'Atorvastatin',
        dose: '20 mg',
        frequency: 'Once daily at night',
        route: 'Oral',
        durationDays: 90,
        orderId: encounterId,
        sig: '1 tablet nocte x90d',
      },
    ];
  }

  if (lower.includes('cough')) {
    return [
      {
        id: `${encounterId}-rx-1`,
        encounterId,
        name: 'Salbutamol inhaler',
        dose: '100 mcg',
        frequency: '2 puffs every 6 hours as needed',
        route: 'Inhaled',
        durationDays: 7,
        orderId: encounterId,
        sig: '2 puffs q6h prn x7d',
      },
      {
        id: `${encounterId}-rx-2`,
        encounterId,
        name: 'Paracetamol',
        dose: '500 mg',
        frequency: '1 tablet every 8 hours',
        route: 'Oral',
        durationDays: 5,
        orderId: encounterId,
        sig: '1 tablet q8h x5d',
      },
    ];
  }

  return [
    {
      id: `${encounterId}-rx-1`,
      encounterId,
      name: 'Paracetamol',
      dose: '500 mg',
      frequency: '1 tablet every 6 hours',
      route: 'Oral',
      durationDays: 5,
      orderId: encounterId,
      sig: '1 tablet q6h x5d',
    },
    {
      id: `${encounterId}-rx-2`,
      encounterId,
      name: 'Ibuprofen',
      dose: '400 mg',
      frequency: '1 tablet every 8 hours with food',
      route: 'Oral',
      durationDays: 7,
      orderId: encounterId,
      sig: '1 tablet q8h with food x7d',
    },
  ];
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = params.id;
  if (!encounterId) {
    return NextResponse.json(
      { error: 'encounterId required in path' },
      { status: 400 }
    );
  }

  const fromGw = await fetchFromGateway(encounterId);
  if (fromGw && fromGw.length) {
    return NextResponse.json(fromGw, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const mock = buildMockForEncounter(encounterId);
  return NextResponse.json(mock, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
