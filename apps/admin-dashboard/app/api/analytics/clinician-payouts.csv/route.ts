import { NextResponse } from 'next/server'
export async function GET(){
  const rows = [
    { classId:'classA', name:'Class A — Doctors', consultations:124, revenueZAR:186000, rxPayoutPercent:70, payoutZAR:130200 },
    { classId:'classB', name:'Class B — Allied Health', consultations:92, revenueZAR:69000, rxPayoutPercent:70, payoutZAR:48300 },
    { classId:'classC', name:'Class C — Wellness', consultations:48, revenueZAR:24000, rxPayoutPercent:70, payoutZAR:16800 }
  ]
  const header = 'classId,name,consultations,revenueZAR,rxPayoutPercent,payoutZAR\n'
  const body = rows.map(r=>[r.classId,r.name,r.consultations,r.revenueZAR,r.rxPayoutPercent,r.payoutZAR].join(',')).join('\n')
  return new NextResponse(header+body+'\n', { headers: { 'Content-Type':'text/csv; charset=utf-8' } })
}
