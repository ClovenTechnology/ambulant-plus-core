// apps/patient-app/app/tele-visit/[id]/page.tsx
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import RoomClient from './room-client';
import { jwtVerify } from 'jose';

async function verifyToken(token: string) {
  const secret = process.env.TELEVISIT_JWT_SECRET;
  if (!secret) throw new Error('Server misconfig');
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const apptId = String(payload.apptId);
    const startsAt = String(payload.startsAt);
    const endsAt = String(payload.endsAt);
    const role = (payload.role as 'patient' | 'clinician') ?? 'patient';
    return { apptId, startsAt, endsAt, role };
  } catch {
    return null;
  }
}

export default async function TeleVisitRoom({ params, searchParams }: { params: { id: string }, searchParams: { token?: string } }) {
  const hdrs = headers();
  const token = searchParams?.token;
  if (!token) redirect('/tele-visit'); // must come from Start

  const verified = await verifyToken(token);
  if (!verified || verified.apptId !== params.id) redirect('/tele-visit');

  // Pass serverNow for skew-free countdown
  const serverNow = new Date().toISOString();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tele-visit Room</h1>
          <div className="text-sm text-gray-600">Appointment #{params.id} · Role: {verified.role}</div>
        </div>
      </header>

      <RoomClient startsAt={verified.startsAt} endsAt={verified.endsAt} serverNow={serverNow} />
    </main>
  );
}
