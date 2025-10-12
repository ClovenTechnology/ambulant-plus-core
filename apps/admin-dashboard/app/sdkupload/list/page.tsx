'use client'
import { useEffect, useState } from 'react'

type Device = { id:string; name:string; active:boolean; mode:'mock'|'live'; streams:string[] }

export default function SDKList(){
  const [list,setList] = useState<Device[]>([])
  async function load(){
    const res = await fetch('/api/devices', { cache:'no-store' })
    setList(await res.json())
  }
  useEffect(()=>{ load() },[])
  async function toggle(id:string){
    const r = await fetch('/api/devices/toggle?id='+encodeURIComponent(id), { method:'POST' })
    if(r.ok) load()
  }
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">IoMT Devices</h1>
      <table className="w-full text-sm border">
        <thead><tr className="text-left">
          <th className="p-2">Name</th><th className="p-2">Mode</th><th className="p-2">Status</th><th className="p-2">Streams</th><th className="p-2">Actions</th>
        </tr></thead>
        <tbody>
          {list.map(d=> (
            <tr key={d.id} className="border-t">
              <td className="p-2">{d.name}</td>
              <td className="p-2 uppercase">{d.mode}</td>
              <td className="p-2">{d.active? 'Active':'Inactive'}</td>
              <td className="p-2">{d.streams.join(', ')}</td>
              <td className="p-2"><button onClick={()=>toggle(d.id)} className="px-2 py-1 border rounded bg-white">{d.active? 'Deactivate':'Activate'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
