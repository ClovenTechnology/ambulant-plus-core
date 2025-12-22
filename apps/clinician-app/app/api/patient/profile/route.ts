//apps/clinician-app/app/api/patient/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

const DEMO = {
  profile: {
    id: 'pt-dev',
    userId: 'user-dev',
    name: 'Demo Patient',
    gender: 'Female',
    dob: '1985-04-12',
    email: 'demo.patient@example.com',
    mobile: '+27 82 000 0000',
    address: '0B Meadowbrook Ln, Bryanston 2152, ZA',
    avatarUrl: null,
    bloodType: null,
    allergies: ['Penicillin', 'Peanuts'],
    chronicConditions: ['Hypertension', 'Type 2 diabetes mellitus'],
    primaryConditionsText: 'Hypertension, Type 2 diabetes mellitus',
  },
  conditions: [],
  vaccinations: [],
  operations: [],
  medications: [],
  encounters: [],
  historyCounts: { conditions: 2, vaccinations: 3, operations: 1, medications: 2, encounters: 2 },
};

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const patientId = u.searchParams.get('patientId') || 'pt-dev';
  const userId = u.searchParams.get('userId') || undefined;

  // Prefer API Gateway if available
  if (GW) {
    const qs = new URLSearchParams();
    if (patientId) qs.set('patientId', patientId);
    if (userId) qs.set('userId', userId);
    const r = await fetch(`${GW}/api/patients/profile?${qs.toString()}`, { cache: 'no-store' }).catch(() => null);
    if (r?.ok) {
      const js = await r.json();
      return NextResponse.json(js, { headers: { 'Cache-Control': 'no-store' } });
    }
  }

  // Fallback demo
  return NextResponse.json({ ok: true, ...DEMO }, { headers: { 'Cache-Control': 'no-store' } });
}
