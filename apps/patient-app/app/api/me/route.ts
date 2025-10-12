// apps/patient-app/app/api/me/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // TODO: Replace with real user profile (from your auth/session)
  return NextResponse.json({
    id: 'user-demo',
    email: 'patient@example.com',
    phone: '+2348012345678',
    name: 'Demo Patient',
  });
}
