'use client'
import { useEffect, useState } from 'react'

export default function DevTools(){
  const [state, setState] = useState<'demo'|'empty'>('demo')
  useEffect(()=>{
    fetch('/api/devtools/state',{cache:'no-store'}).then(r=>r.json()).then(d=>setState(d.mode))
  },[])
  async function call(path:string, method:'POST'|'GET'='POST'){
    const res = await fetch(path,{method})
    const js = await res.json().catch(()=>({}))
    alert(res.ok? (js.message||'OK') : ('Failed: '+(js.error||res.status)))
    if(path.includes('/state')) setState(js.mode)
  }
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">Developer Utilities</h1>
      <div className="space-x-2">
        <button onClick={()=>call('/api/devtools/reset')} className="px-3 py-2 border rounded bg-white">Quick DB Reset</button>
        <button onClick={()=>call('/api/devtools/seed')} className="px-3 py-2 border rounded bg-white">Mock Seeder</button>
        <button onClick={()=>call('/api/devtools/state?mode='+(state==='demo'?'empty':'demo'))} className="px-3 py-2 border rounded bg-black text-white">
          Switch to {state==='demo'?'Empty':'Demo'} State
        </button>
      </div>
      <p className="text-sm text-gray-600">Current test data mode: <b>{state}</b></p>
    </main>
  )
}
