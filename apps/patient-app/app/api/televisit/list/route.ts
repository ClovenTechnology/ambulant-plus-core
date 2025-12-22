// apps/patient-app/app/api/televisit/list/route.ts
import { NextResponse } from 'next/server';
import { store } from '@runtime/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Appt = {
  id: string;
  clinicianName: string;
  specialty: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  location?: string;
};

function isoIn(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

// TEMP: mock until DB is wired
function mockAppts(): Appt[] {
  const aStart = isoIn(12);
  const aEnd = isoIn(12 + 25);
  const bStart = isoIn(180);
  const bEnd = isoIn(210);

  return [
    {
      id: 'apt_001',
      clinicianName: 'Dr. Lerato Mokoena',
      specialty: 'General Practitioner',
      startsAt: aStart,
      endsAt: aEnd,
      location: 'Virtual',
    },
    {
      id: 'apt_002',
      clinicianName: 'Dr. Sibusiso Nkosi',
      specialty: 'Cardiologist',
      startsAt: bStart,
      endsAt: bEnd,
      location: 'Virtual',
    },
  ];
}

function seedTelevisits(items: Appt[]) {
  const tv = (store as any)?.televisits;
  if (!tv || typeof tv.set !== 'function') return;

  for (const a of items) {
    try {
      const prev = tv.get(a.id);
      if (!prev) {
        tv.set(a.id, {
          id: a.id,
          visitId: a.id,
          roomId: a.id,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          kind: 'televisit',
          title: `${a.specialty} • ${a.clinicianName}`,
          clinicianName: a.clinicianName,
          specialty: a.specialty,
          location: a.location ?? 'Virtual',
        });
      } else {
        // keep any extra fields but ensure schedule stays current
        tv.set(a.id, {
          ...prev,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          clinicianName: (prev as any).clinicianName ?? a.clinicianName,
          specialty: (prev as any).specialty ?? a.specialty,
          location: (prev as any).location ?? a.location ?? 'Virtual',
        });
      }
    } catch {
      // ignore
    }
  }
}

export async function GET() {
  const items = mockAppts();

  // Make sure /api/televisit/status + /api/televisit/issue can find these visits (dev convenience)
  seedTelevisits(items);

  return NextResponse.json(
    { ok: true, items, serverNow: new Date().toISOString() },
    { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}
