'use client'
import { useEffect, useState } from 'react'

type Alert = { id:string; patient:string; type:string; score:number; ts:string; note?:string }

export default function AlertSimulator(){
  const [alerts,setAlerts] = useState<Alert[]>([])
  const [patient,setPatient] = useState('Thandi Mokoena')
  const [type,setType] = useState('Heart Risk')
  const [score,setScore] = useState(0.72)
  const [note,setNote] = useState('Persistent tachycardia over threshold')

  async function load(){
    const d = await fetch('/api/insightcore/alerts',{cache:'no-store'}).then(r=>r.json())
    setAlerts(d.alerts || [])
  }
  useEffect(()=>{ load() }, [])

  async function push(){
    const res = await fetch('/api/insightcore/alerts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ patient, type, score, note })
    })
    if(res.ok) load()
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">InsightCore — Alert Simulator</h1>
      <div className="border rounded p-4 bg-white grid md:grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col">Patient<input className="border rounded px-2 py-1" value={patient} onChange={e=>setPatient(e.target.value)} /></label>
        <label className="flex flex-col">Type<input className="border rounded px-2 py-1" value={type} onChange={e=>setType(e.target.value)} /></label>
        <label className="flex flex-col">Score<input type="number" step="0.01" className="border rounded px-2 py-1" value={score} onChange={e=>setScore(parseFloat(e.target.value))} /></label>
        <label className="flex flex-col">Note<input className="border rounded px-2 py-1" value={note} onChange={e=>setNote(e.target.value)} /></label>
        <button onClick={push} className="px-3 py-2 border rounded bg-black text-white w-max">Generate Alert</button>
      </div>

      <div className="border rounded p-4 bg-white">
        <div className="font-medium mb-2">Recent Alerts</div>
        <ul className="divide-y text-sm">
          {alerts.slice().reverse().map(a => (
            <li key={a.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{a.type} — {a.patient}</div>
                <div className="text-xs text-gray-600">{a.ts} • score {a.score.toFixed(2)}</div>
              </div>
              <div className="text-xs border rounded px-2 py-1">{a.note}</div>
            </li>
          ))}
          {alerts.length===0 && <li className="py-2 text-gray-500">No alerts yet.</li>}
        </ul>
      </div>
    </main>
  )
}
