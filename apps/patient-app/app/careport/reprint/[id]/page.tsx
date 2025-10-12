'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
export default function Reprint(){
  const { id } = useParams() as { id:string }
  const [msg,setMsg] = useState<string>('')
  async function send(){
    const res = await fetch('/api/careport/reprint', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    setMsg(res.ok? 'Reprint triggered ✓' : 'Failed to trigger')
  }
  return (<main className="p-6 space-y-3">
    <h1 className="text-lg font-semibold">Reprint / Reorder eRx</h1>
    <div className="text-sm">Prescription: {id}</div>
    <button onClick={send} className="px-3 py-2 border rounded bg-black text-white">Trigger Reprint/Reorder</button>
    {msg && <div className="text-sm">{msg}</div>}
  </main>)
}
