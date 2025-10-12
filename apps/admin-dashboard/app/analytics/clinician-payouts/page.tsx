'use client'
import { useEffect, useState } from 'react'
type Row = { classId:string; name:string; consultations:number; revenueZAR:number; rxPayoutPercent:number; payoutZAR:number }
export default function ClinicianPayouts(){
  const [rows,setRows] = useState<Row[]>([])
  const [total,setTotal] = useState<number>(0)
  useEffect(()=>{
    fetch('/api/analytics/clinician-payouts',{cache:'no-store'}).then(r=>r.json()).then(d=>{ setRows(d.classes||[]); setTotal(d.totalPayoutZAR||0) })
  },[])
  return (<main className="p-6 space-y-4">
    <h1 className="text-lg font-semibold">Clinician Payouts (last 30 days)</h1>
    <table className="w-full text-sm border">
      <thead className="bg-gray-50"><tr className="text-left">
        <th className="p-2">Class</th><th className="p-2">Consultations</th><th className="p-2">Revenue (ZAR)</th><th className="p-2">Rx Payout %</th><th className="p-2">Payout (ZAR)</th>
      </tr></thead>
      <tbody>
        {rows.map(r=>(<tr key={r.classId} className="border-t">
          <td className="p-2">{r.name}</td><td className="p-2">{r.consultations}</td><td className="p-2">{r.revenueZAR.toLocaleString()}</td><td className="p-2">{r.rxPayoutPercent}%</td><td className="p-2">{r.payoutZAR.toLocaleString()}</td>
        </tr>))}
        {rows.length===0 && <tr><td className="p-2 text-gray-500" colSpan={5}>No data.</td></tr>}
      </tbody>
      <tfoot><tr className="border-t font-semibold"><td className="p-2" colSpan={4}>Total</td><td className="p-2">{total.toLocaleString()}</td></tr></tfoot>
    </table>
  </main>)
}
