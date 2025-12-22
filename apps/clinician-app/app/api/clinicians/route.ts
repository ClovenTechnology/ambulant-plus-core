// apps/clinician-app/app/api/clinicians/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE?.replace(/\/+$/, '') ||
  '';

type Clinician = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  gender?: string;
  cls?: 'Doctor' | 'Allied Health' | 'Wellness';
  priceZAR?: number;
  rating?: number;
  online?: boolean;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = Number.isFinite(Number(limitParam))
    ? Math.max(1, Math.min(500, Number(limitParam)))
    : 100;

  // Try to proxy to gateway if available
  if (GW) {
    try {
      const r = await fetch(`${GW}/api/clinicians?limit=${encodeURIComponent(String(limit))}`, {
        cache: 'no-store',
        headers: {
          'x-ambulant-source': 'clinician-app',
        },
      });
      if (r.ok) {
        const js = await r.json().catch(() => null);
        const itemsRaw: any[] = Array.isArray((js as any)?.items)
          ? (js as any).items
          : Array.isArray(js)
          ? (js as any)
          : [];

        if (itemsRaw.length > 0) {
          const items: Clinician[] = itemsRaw.map((c: any, idx: number) => ({
            id: String(c.id ?? `gw-${idx}`),
            name: c.name ?? c.fullName ?? 'Unnamed clinician',
            specialty: c.specialty ?? c.specialisation ?? '',
            location: c.location ?? c.city ?? c.region ?? '',
            gender: (c.gender || c.sex || '').trim() || undefined,
            cls: (c.cls as Clinician['cls']) || 'Doctor',
            priceZAR: typeof c.priceZAR === 'number' ? c.priceZAR : undefined,
            rating: typeof c.rating === 'number' ? c.rating : undefined,
            online: typeof c.online === 'boolean' ? c.online : undefined,
          }));
          return NextResponse.json({ items });
        }
      } else {
        console.warn('[clinicians] gateway non-OK', r.status);
      }
    } catch (err) {
      console.warn('[clinicians] gateway error, falling back to mock', err);
    }
  }

  // Fallback mock list (dev/demo)
  const mock: Clinician[] = [
    {
      id: 'clin-za-001',
      name: 'Dr Ama Ndlovu',
      specialty: 'GP',
      location: 'Johannesburg',
      gender: 'Female',
      cls: 'Doctor',
      priceZAR: 500,
      rating: 4.7,
      online: true,
    },
    {
      id: 'clin-za-002',
      name: 'Dr Jane Smith',
      specialty: 'Cardiology',
      location: 'Cape Town',
      gender: 'Female',
      cls: 'Doctor',
      priceZAR: 850,
      rating: 4.8,
      online: true,
    },
    {
      id: 'clin-za-003',
      name: 'Dr Adam Lee',
      specialty: 'ENT',
      location: 'Johannesburg',
      gender: 'Male',
      cls: 'Doctor',
      priceZAR: 700,
      rating: 4.6,
      online: true,
    },
    {
      id: 'clin-za-101',
      name: 'RN T. Dube',
      specialty: 'Nurse',
      location: 'Durban',
      gender: 'Male',
      cls: 'Allied Health',
      priceZAR: 300,
      rating: 4.5,
      online: false,
    },
    {
      id: 'clin-za-201',
      name: 'Coach L. Maseko',
      specialty: 'Therapist',
      location: 'Pretoria',
      gender: 'Female',
      cls: 'Wellness',
      priceZAR: 400,
      rating: 4.4,
      online: true,
    },
  ];

  return NextResponse.json({ items: mock.slice(0, limit) });
}
