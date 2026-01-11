// apps/patient-app/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GatewayPatient = {
  id?: string;
  patientId?: string;
  userId?: string;
  name?: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  dob?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
  mobile?: string | null;
  bloodType?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  primaryConditionsText?: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || '';

  // 1) Try API Gateway (if configured)
  if (API) {
    try {
      const baseUrl = API.replace(/\/+$/, ''); // trim trailing slash
      const url = new URL('/api/patients/profile', baseUrl);
      if (userId) {
        url.searchParams.set('userId', userId);
      }

      // Forward auth-related headers so identity works on gateway
      const forwardHeaders = new Headers();
      const original = req.headers;

      const forwardKeys = ['cookie', 'authorization', 'x-ambulant-identity'];
      forwardKeys.forEach((key) => {
        const v = original.get(key);
        if (v) forwardHeaders.set(key, v);
      });

      forwardHeaders.set('content-type', 'application/json');

      const r = await fetch(url.toString(), {
        headers: forwardHeaders,
        cache: 'no-store',
      });

      if (r.ok) {
        const data = await r.json().catch(() => ({} as any));

        // Gateway shape: { ok, profile, conditions, ... }
        const patient: GatewayPatient = (data?.patient || data?.profile || data || {}) as GatewayPatient;

        const chronicConditions = Array.isArray(patient.chronicConditions)
          ? patient.chronicConditions
          : [];

        const normalized = {
          userId: patient.userId || userId || null,
          patientId: patient.patientId || patient.id || null,
          name: patient.name || (data?.displayName ?? null),
          email: patient.email ?? null,
          age: patient.age ?? null, // optional, if you ever compute it server-side
          gender: patient.gender ?? null,
          dob: patient.dob ?? null,
          avatarUrl: patient.avatarUrl || null,
          address: patient.address || null,
          mobile: patient.mobile || null,
          bloodType: patient.bloodType ?? null,
          allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
          chronicConditions,
          primaryConditionsText:
            patient.primaryConditionsText ??
            (chronicConditions.length ? chronicConditions.join(', ') : null),

          // keep the entire gateway payload for richer UIs (history, etc.)
          patientRaw: data,
        };

        return NextResponse.json(normalized, {
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    } catch (err) {
      console.error('[patient-app/api/profile] gateway error', err);
      // fall through to local mock
    }
  }

  // 2) Local dev stub (kept realistic & stable for PDFs/UI)
  const mockChronic = ['Hypertension', 'Prediabetes'];
  return NextResponse.json(
    {
      userId: userId || 'patient-demo-001',
      patientId: 'Am25-02-001',
      name: 'Lerato Teeke',
      email: 'lerato@ambulant.com',
      age: 34,
      gender: 'Female',
      dob: '1991-03-14',
      avatarUrl: '/images/avatar-placeholder.png',
      address: 'Morningside, Sandton 2150',
      mobile: '074-551-8583',
      bloodType: 'O+',
      allergies: ['Peanuts (mild)'],
      chronicConditions: mockChronic,
      primaryConditionsText: mockChronic.join(', '),
      patientRaw: {
        ok: true,
        profile: {
          id: 'Am25-02-001',
          userId: userId || 'patient-demo-001',
          name: 'Lerato Teeke',
          email: 'lerato@ambulant.com',
          gender: 'Female',
          dob: '1991-03-14',
          address: 'Morningside, Sandton 2150',
          mobile: '074-551-8583',
          bloodType: 'O+',
          allergies: ['Peanuts (mild)'],
          chronicConditions: mockChronic,
        },
        conditions: [],
        vaccinations: [],
        operations: [],
        medications: [],
        encounters: [],
        historyCounts: {
          conditions: 0,
          vaccinations: 0,
          operations: 0,
          medications: 0,
          encounters: 0,
        },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
