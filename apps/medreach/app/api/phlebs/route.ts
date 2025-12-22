// apps/medreach/app/api/phlebs/route.ts
import { NextResponse } from 'next/server';

export type Phleb = {
  id: string;             // slug, e.g. "thabo-m"
  fullName: string;       // "Thabo Mokoena"
  phone: string;          // "+27 ..."
  city: string;           // "Johannesburg"
  active: boolean;
  serviceRadiusKm?: number;
  serviceAreas?: string[];      // e.g. ["Randburg", "Sandton"]
  preferredLabs?: string[];     // lab IDs for optional preferences
};

// 🚧 TEMP: mock data; replace with real gateway call under Option A
export async function GET() {
  const phlebs: Phleb[] = [
    {
      id: 'thabo-m',
      fullName: 'Thabo M.',
      phone: '+27 82 000 0001',
      city: 'Johannesburg',
      active: true,
      serviceRadiusKm: 15,
      serviceAreas: ['Randburg', 'Rosebank'],
      preferredLabs: ['lancet-cresta'],
    },
    {
      id: 'lerato-k',
      fullName: 'Lerato K.',
      phone: '+27 73 000 0002',
      city: 'Durban',
      active: true,
      serviceRadiusKm: 20,
      serviceAreas: ['Umhlanga', 'Durban North'],
      preferredLabs: ['adc-diagnostics-durban'],
    },
    {
      id: 'siphiwe-d',
      fullName: 'Siphiwe D.',
      phone: '+27 61 000 0003',
      city: 'Cape Town',
      active: false,
      serviceRadiusKm: 10,
      serviceAreas: ['City Bowl'],
      preferredLabs: [],
    },
  ];

  // 👉 LATER: replace this with a call to your central API:
  // const res = await fetch(`${process.env.API_GATEWAY_URL}/phlebs`, { ... });
  // const phlebs = await res.json();

  return NextResponse.json({ phlebs });
}
