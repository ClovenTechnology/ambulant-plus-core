'use client'
import { useEffect, useState } from 'react'
type TestType={code:string;name:string;priceZAR:number;etaDays:number}
type Lab={id:string;name:string;city:string;contact:string;logoUrl?:string;tests:TestType[]}
export default function LabsPage(){
  const [labs,setLabs]=useState<Lab[]>([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{fetch('/api/labs',{cache:'no-store'}).then(r=>r.json()).then(d=>{setLabs(d.labs);setLoading(false)})},[])
  async function addLab(){ const name=prompt('Lab name (e.g., MedReach Durban)'); if(!name) return; const city=prompt('City (e.g., Durban)')||''; const contact=prompt('Contact (+27 ...)')||''; const res=await fetch('/api/labs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,city,contact})}); const d=await res.json(); setLabs(d.labs) }
  async function addTest(labId:string){ const code=prompt('Test code (e.g., CRP)')||''; const name=prompt('Test name')||''; const priceZAR=parseInt(prompt('Price (ZAR)')||'0',10); const etaDays=parseInt(prompt('ETA days')||'1',10); const res=await fetch('/api/labs/tests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({labId,code,name,priceZAR,etaDays})}); const d=await res.json(); setLabs(d.labs) }
  if(loading) return <main className="p-6">Loading...</main>
  return (<main className="p-6 space-y-4"><div className="flex items-center justify-between"><h1 className="text-lg font-semibold">MedReach — Labs</h1><button onClick={addLab} className="px-3 py-1 border rounded bg-black text-white text-sm">Add Lab</button></div>
  <div className="grid md:grid-cols-2 gap-4">{labs.map(lab=>(<div key={lab.id} className="border rounded p-4 bg-white space-y-2"><div className="font-medium">{lab.name}</div><div className="text-xs text-gray-600">{lab.city} • {lab.contact}</div><div><div className="text-sm font-medium mb-1">Test Types</div><ul className="text-sm border rounded divide-y">{lab.tests.map(t=>(<li key={t.code} className="p-2 flex justify-between"><span>{t.name} ({t.code})</span><span>R {t.priceZAR} • ETA {t.etaDays}d</span></li>))}{lab.tests.length===0&&<li className="p-2 text-gray-500">No tests yet.</li>}</ul><button onClick={()=>addTest(lab.id)} className="mt-2 px-3 py-1 border rounded text-sm">Add Test</button></div></div>))}</div></main>)}
