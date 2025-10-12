import { NextResponse } from 'next/server'
export async function GET(){
  return NextResponse.json({
    month: '2025-08',
    revenueZAR: 512000,
    deliveries: 842,
    labTests: 391,
    consultations: 1260
  })
}
