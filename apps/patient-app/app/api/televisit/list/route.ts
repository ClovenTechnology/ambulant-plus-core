// apps/patient-app/app/api/televisit/list/route.ts
export const runtime = 'edge';

type Appt = {
  id: string;
  clinicianName: string;
  specialty: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  location?: string;
};

function isoIn(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

// TEMP: mock until DB is wired
function mockAppts(): Appt[] {
  // One starting in 12m (to see disabled -> enabled flip), one later today
  const aStart = isoIn(12), aEnd = isoIn(12 + 25);
  const bStart = isoIn(180), bEnd = isoIn(210);
  return [
    { id: 'apt_001', clinicianName: 'Dr. Lerato Mokoena', specialty: 'General Practitioner', startsAt: aStart, endsAt: aEnd, location: 'Virtual' },
    { id: 'apt_002', clinicianName: 'Dr. Sibusiso Nkosi', specialty: 'Cardiologist', startsAt: bStart, endsAt: bEnd, location: 'Virtual' },
  ];
}

export async function GET() {
  // âŸ¶ Replace with DB query (user-scoped) later
  const items = mockAppts();
  return new Response(JSON.stringify({ items, serverNow: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
