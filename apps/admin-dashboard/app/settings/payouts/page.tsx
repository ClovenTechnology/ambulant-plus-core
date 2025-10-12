'use client'
import { useEffect, useState } from 'react'
type ClinicianClass = { id:string; name:string; enabled:boolean; rxPayoutPercent:number }
type Payouts = {
  riderPayoutPercent:number
  pharmacyCommissionPercent:number
  platformCommissionPercent:number
  labCommissionPercent:number
  monthlyFees:{ pharmacyZAR:number; labZAR:number }
  clinicianErxCommissionPercent:number
  clinicianClasses: ClinicianClass[]
  deliveryModel:{ baseFeeZAR:number; perKmZAR:number }
}
export default function PayoutSettings(){
  const [cfg,setCfg] = useState<Payouts|null>(null)
  const [saving,setSaving] = useState(false)
  const [saved,setSaved] = useState(false)
  useEffect(()=>{ fetch('/api/settings/payouts',{cache:'no-store'}).then(r=>r.json()).then(setCfg) }, [])
  function upd(path:string, val:any){
    if(!cfg) return
    const next:any = structuredClone(cfg)
    const keys = path.split('.')
    let cur = next
    for(let i=0;i<keys.length-1;i++){ cur = cur[keys[i]] }
    cur[keys.at(-1)!] = val
    setCfg(next)
  }
  function setClass(idx:number, patch:Partial<ClinicianClass>){
    if(!cfg) return
    const next = structuredClone(cfg)
    next.clinicianClasses[idx] = { ...next.clinicianClasses[idx], ...patch }
    setCfg(next)
  }
  function addClass(){
    if(!cfg) return
    const next = structuredClone(cfg)
    next.clinicianClasses.push({ id: crypto.randomUUID(), name: 'New Class', enabled: true, rxPayoutPercent: 70 })
    setCfg(next)
  }
  function removeClass(idx:number){
    if(!cfg) return
    const next = structuredClone(cfg)
    next.clinicianClasses.splice(idx,1)
    setCfg(next)
  }
  async function save(){
    setSaving(true); setSaved(false)
    const res = await fetch('/api/settings/payouts',{method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cfg)})
    setSaving(false); setSaved(res.ok)
  }
  if(!cfg) return <main className="p-6">Loading...</main>
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Payout Configuration</h1>
      <section className="grid md:grid-cols-2 gap-4">
        <Card title="Delivery Payouts">
          <Num label="Rider/Phleb Payout %" v={cfg.riderPayoutPercent} onChange={v=>upd('riderPayoutPercent', v)}/>
          <Num label="Pharmacy Commission %" v={cfg.pharmacyCommissionPercent} onChange={v=>upd('pharmacyCommissionPercent', v)}/>
          <Num label="Lab Commission %" v={cfg.labCommissionPercent} onChange={v=>upd('labCommissionPercent', v)}/>
          <Num label="Platform Commission %" v={cfg.platformCommissionPercent} onChange={v=>upd('platformCommissionPercent', v)}/>
        </Card>
        <Card title="Monthly Access Fees">
          <Num label="Pharmacy Monthly (ZAR)" v={cfg.monthlyFees.pharmacyZAR} onChange={v=>upd('monthlyFees.pharmacyZAR', v)}/>
          <Num label="Lab Monthly (ZAR)" v={cfg.monthlyFees.labZAR} onChange={v=>upd('monthlyFees.labZAR', v)}/>
        </Card>
        <Card title="Clinician eRx Commission (default 0%)">
          <Num label="eRx Commission %" v={cfg.clinicianErxCommissionPercent} onChange={v=>upd('clinicianErxCommissionPercent', v)}/>
        </Card>
        <Card title="Delivery Fee Model">
          <Num label="Base Fee (ZAR)" v={cfg.deliveryModel.baseFeeZAR} onChange={v=>upd('deliveryModel.baseFeeZAR', v)}/>
          <Num label="Per Km (ZAR)" v={cfg.deliveryModel.perKmZAR} onChange={v=>upd('deliveryModel.perKmZAR', v)}/>
        </Card>
      </section>
      <section className="border rounded p-4 bg-white">
        <div className="font-medium mb-3">Clinician Rx Payout (share of consultation revenue) — Dynamic Classes</div>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="p-2">Enabled</th>
              <th className="p-2">Class Name</th>
              <th className="p-2">Rx Payout %</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {cfg.clinicianClasses.map((c,idx)=>(
              <tr key={c.id} className="border-t">
                <td className="p-2"><input type="checkbox" checked={c.enabled} onChange={e=>setClass(idx,{enabled:e.target.checked})}/></td>
                <td className="p-2"><input value={c.name} onChange={e=>setClass(idx,{name:e.target.value})} className="border rounded px-2 py-1 w-full"/></td>
                <td className="p-2 w-48"><input type="number" value={c.rxPayoutPercent} onChange={e=>setClass(idx,{rxPayoutPercent: Math.max(0,Math.min(100, Number(e.target.value||0)))})} className="border rounded px-2 py-1 w-28"/></td>
                <td className="p-2 text-right"><button onClick={()=>removeClass(idx)} className="px-2 py-1 border rounded">Remove</button></td>
              </tr>
            ))}
            {cfg.clinicianClasses.length===0 && <tr><td className="p-2 text-gray-500" colSpan={4}>No classes. Add one below.</td></tr>}
          </tbody>
        </table>
        <div className="mt-3"><button onClick={addClass} className="px-3 py-2 border rounded bg-black text-white">Add Class</button></div>
      </section>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 border rounded bg-black text-white">{saving?'Saving…':'Save Changes'}</button>
        {saved && <span className="text-green-700 text-sm mt-2">Saved ✓</span>}
      </div>
    </main>
  )
}
function Card({title, children}:{title:string, children:any}){ return <div className="border rounded p-4 bg-white"><div className="font-medium mb-2">{title}</div><div className="grid grid-cols-2 gap-2">{children}</div></div> }
function Num({label, v, onChange}:{label:string; v:number; onChange:(n:number)=>void}){ return <label className="text-sm flex items-center gap-2"><span className="w-52 text-gray-600">{label}</span><input type="number" value={v} onChange={e=>onChange(parseFloat(e.target.value))} className="border rounded px-2 py-1 w-28"/></label> }
