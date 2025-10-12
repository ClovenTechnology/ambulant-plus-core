'use client'
import { useEffect, useState } from 'react'
export default function Monthly(){
  const [data,setData] = useState<any>(null)
  useEffect(()=>{ fetch('/api/analytics/monthly',{cache:'no-store'}).then(r=>r.json()).then(setData)},[])
  if(!data) return <main className="p-6">Loading…</main>
  return (<main className="p-6 space-y-4">
    <h1 className="text-lg font-semibold">Monthly Summary</h1>
    <div className="grid md:grid-cols-4 gap-4">
      {['revenueZAR','deliveries','labTests','consultations'].map(k=>(
        <div key={k} className="border rounded p-4 bg-white">
          <div className="text-xs text-gray-500">{k}</div>
          <div className="text-xl font-semibold">{String(data[k])}</div>
        </div>
      ))}
    </div>
  </main>)
}
