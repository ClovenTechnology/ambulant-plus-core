//apps/clinician-app/app/api/medications/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

const DEMO = [
  {
    id: 'demo-metformin',
    name: 'Metformin 500 mg tablet',
    dose: '500 mg',
    frequency: '1 tablet twice daily with meals',
    route: 'Oral',
    status: 'Active',
    started: '2024-01-05',
    source: 'demo',
  },
  {
    id: 'demo-amlodipine',
    name: 'Amlodipine 5 mg tablet',
    dose: '5 mg',
    frequency: 'Once daily',
    route: 'Oral',
    status: 'Active',
    started: '2023-11-12',
    source: 'demo',
  },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId') || 'pt-dev';

  if (GW) {
    const r = await fetch(`${GW}/api/medications?patientId=${encodeURIComponent(patientId)}`, { cache: 'no-store' })
      .catch(() => null);
    if (r?.ok) {
      const js = await r.json();
      return NextResponse.json(js, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  return NextResponse.json(DEMO, { headers: { 'Cache-Control': 'no-store' } });
}
