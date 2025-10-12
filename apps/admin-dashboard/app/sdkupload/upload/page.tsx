'use client'
import { useState } from 'react'
export default function SDKUploadForm(){
  const [file,setFile] = useState<File|null>(null)
  const [msg,setMsg] = useState('')
  async function onSubmit(e:any){
    e.preventDefault()
    if(!file){ setMsg('Select a .zip SDK (with manifest.json)'); return }
    const fd = new FormData()
    fd.set('file', file)
    const res = await fetch('/api/devices/register', { method:'POST', body: fd })
    const js = await res.json().catch(()=>({}))
    setMsg(res.ok? `Registered: ${js.device?.name||''}` : ('Failed: ' + (js.error||'unknown')))
  }
  return (<main className="p-6 space-y-4">
    <h1 className="text-lg font-semibold">Register IoMT SDK (ZIP)</h1>
    <form onSubmit={onSubmit} className="space-y-3 border rounded p-4 bg-white max-w-xl">
      <label className="block text-sm">SDK ZIP<input type="file" accept=".zip" onChange={e=>setFile(e.target.files?.[0]||null)} className="block mt-1"/></label>
      <button className="px-4 py-2 border rounded bg-black text-white">Upload & Validate</button>
    </form>
    {msg && <div className="text-sm">{msg}</div>}
  </main>)
}
