// apps/patient-app/app/api/appointments/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([
    { id: 1, date: '2025-07-26', doctor: 'Dr. Ndileka' },
    { id: 2, date: '2025-08-01', doctor: 'Dr. Mokoena' },
  ])
}

export async function POST(req: Request) {
  const appointment = await req.json()
  return NextResponse.json({ success: true, data: appointment })
}
