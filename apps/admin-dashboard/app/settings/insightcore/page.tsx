'use client'
import { useEffect, useState } from 'react'
type Cfg = Record<string, any>
export default function InsightCoreSettings(){
  const [cfg,setCfg]=useState<Cfg|null>(null),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false)
  useEffect(()=>{fetch('/api/insightcore/config',{cache:'no-store'}).then(r=>r.json()).then(setCfg)},[])
  function update(p:string,v:any){ if(!cfg) return; const n=structuredClone(cfg),k=p.split('.'); let c:any=n; for(let i=0;i<k.length-1;i++) c=c[k[i]]; c[k.at(-1)!]=v; setCfg(n)}
  async function save(){ setSaving(true); setSaved(false); const res=await fetch('/api/insightcore/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)}); setSaving(false); setSaved(res.ok)}
  if(!cfg) return <main className="p-6">Loading...</main>
  return (<main className="p-6 space-y-6">
    <h1 className="text-lg font-semibold">InsightCore Thresholds</h1>
    <section className="grid md:grid-cols-2 gap-4">
      <Card title="Heart Rate"><Number label="Min" value={cfg.heartRate.min} onChange={v=>update('heartRate.min',v)}/><Number label="Max" value={cfg.heartRate.max} onChange={v=>update('heartRate.max',v)}/></Card>
      <Card title="SpO₂"><Number label="Min" value={cfg.spo2.min} onChange={v=>update('spo2.min',v)}/></Card>
      <Card title="Temperature"><Number label="Max (°C)" value={cfg.temperature.max} onChange={v=>update('temperature.max',v)}/></Card>
      <Card title="Blood Pressure"><Number label="Systolic Max" value={cfg.bp.systolicMax} onChange={v=>update('bp.systolicMax',v)}/><Number label="Diastolic Max" value={cfg.bp.diastolicMax} onChange={v=>update('bp.diastolicMax',v)}/></Card>
      <Card title="Glucose Instability"><Number step={0.05} label="Threshold" value={cfg.glucoseInstability.threshold} onChange={v=>update('glucoseInstability.threshold',v)}/></Card>
      <Card title="Risk Scoring"><Number step={0.01} label="Alert Score Min" value={cfg.riskScoring.alertScoreMin} onChange={v=>update('riskScoring.alertScoreMin',v)}/></Card>
    </section>
    <div className="flex gap-2"><button onClick={save} className="px-4 py-2 border rounded bg-black text-white" disabled={saving}>{saving?'Saving…':'Save Changes'}</button>{saved&&<span className="text-green-700 text-sm mt-2">Saved ✓</span>}</div>
  </main>)}
function Card({title,children}:{title:string,children:any}){return <div className="border rounded p-4 bg-white"><div className="font-medium mb-2">{title}</div><div className="grid grid-cols-2 gap-2">{children}</div></div>}
function Number({label,value,onChange,step=1}:{label:string,value:number,onChange:(v:number)=>void,step?:number}){return <label className="text-sm flex items-center gap-2"><span className="w-36 text-gray-600">{label}</span><input type="number" step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} className="border rounded px-2 py-1 w-32"/></label>}
