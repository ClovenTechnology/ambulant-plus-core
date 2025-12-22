// apps/admin-dashboard/app/api/analytics/clinician-payouts/route.ts
import { NextResponse } from 'next/server'
export async function GET(){
  return NextResponse.json({
    period: 'last_30_days',
    classes: [
      { classId:'classA', name:'Class A — Doctors', consultations: 124, revenueZAR: 186000, rxPayoutPercent: 70, payoutZAR: 130200 },
      { classId:'classB', name:'Class B — Allied Health', consultations: 92, revenueZAR: 69000, rxPayoutPercent: 70, payoutZAR: 48300 },
      { classId:'classC', name:'Class C — Wellness', consultations: 48, revenueZAR: 24000, rxPayoutPercent: 70, payoutZAR: 16800 }
    ],
    totalPayoutZAR: 195300
  })
}
