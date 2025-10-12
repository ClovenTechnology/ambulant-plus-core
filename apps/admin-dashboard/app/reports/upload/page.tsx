'use client'
import { useState } from 'react'
export default function UploadReport(){
  const [id,setId] = useState('RPT-NEW')
  const [patient,setPatient] = useState('Naledi Mokoena')
  const [test,setTest] = useState('Lipid Profile')
  const [file,setFile] = useState<File|null>(null)
  const [msg,setMsg] = useState<string>('')
  async function onSubmit(e:any){
    e.preventDefault()
    if(!file){ setMsg('Choose a file'); return }
    const fd = new FormData()
    fd.set('id', id); fd.set('patient', patient); fd.set('test', test)
    fd.set('file', file)
    const res = await fetch('/api/medreach/reports', { method:'POST', body: fd })
    const js = await res.json()
    setMsg(res.ok ? 'Uploaded ✓' : ('Error: ' + (js.error||'failed')))
  }
  return (<main className="p-6 space-y-4">
    <h1 className="text-lg font-semibold">Upload Lab Report</h1>
    <form onSubmit={onSubmit} className="space-y-3 border rounded p-4 bg-white">
      <label className="block text-sm">Report ID<input value={id} onChange={e=>setId(e.target.value)} className="block border rounded px-2 py-1 mt-1"/></label>
      <label className="block text-sm">Patient<input value={patient} onChange={e=>setPatient(e.target.value)} className="block border rounded px-2 py-1 mt-1"/></label>
      <label className="block text-sm">Test<input value={test} onChange={e=>setTest(e.target.value)} className="block border rounded px-2 py-1 mt-1"/></label>
      <label className="block text-sm">File<input type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="block mt-1"/></label>
      <button className="px-4 py-2 border rounded bg-black text-white">Upload</button>
    </form>
    {msg && <div className="text-sm">{msg}</div>}
  </main>)
}
