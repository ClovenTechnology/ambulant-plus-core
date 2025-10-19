// apps/patient-app/app/admin/clinicians/page.tsx
'use client';

import React, { useEffect, useState } from 'react';

type Clin = any;

export default function AdminCliniciansPage() {
  const [adminKey, setAdminKey] = useState<string | null>(typeof window !== 'undefined' ? sessionStorage.getItem('adminKey') : null);
  const [clinicians, setClinicians] = useState<Clin[]>([]);
  const [filter, setFilter] = useState<'pending'|'active'|'all'>('pending');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (typeof window !== 'undefined') setAdminKey(sessionStorage.getItem('adminKey')); }, []);

  async function load() {
    if (!adminKey) { setMsg('Enter admin key to load'); return; }
    setLoading(true); setMsg(null);
    try {
      const q = filter === 'all' ? '' : `?status=${encodeURIComponent(filter)}&adminKey=${encodeURIComponent(adminKey)}`;
      const res = await fetch(`/api/clinicians${q}`);
      const data = await res.json();
      if (!res.ok) { setMsg(String(data?.error || 'failed')); setClinicians([]); }
      else setClinicians(Array.isArray(data?.clinicians) ? data.clinicians : []);
    } catch (err:any) { setMsg(String(err?.message||err)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminKey, filter]);

  function saveAdminKey() {
    if (!adminKey) return;
    sessionStorage.setItem('adminKey', adminKey);
    load();
  }

  async function doAction(id:string, action:string) {
    if (!adminKey) { setMsg('Admin key required'); return; }
    setLoading(true);
    try {
      const body:any = { id };
      if (action === 'approve') { body.status = 'approved'; }
      if (action === 'reject') { body.status = 'rejected'; }
      if (action === 'activate') { body.status = 'active'; }
      if (action === 'suspend') { body.status = 'suspended'; }
      if (action === 'archive') { body.archived = true; body.status = 'archived'; }
      if (action === 'trainingDone') { body.trainingCompleted = true; }
      const res = await fetch('/api/clinicians', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setMsg(String(data?.error || 'failed'));
      else { setMsg('Updated'); load(); }
    } catch (err:any) {
      setMsg(String(err?.message||err));
    } finally { setLoading(false); }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin — Clinicians</h1>

      <div className="mb-4 flex gap-2 items-center">
        <input placeholder="Admin key" value={adminKey ?? ''} onChange={e=>setAdminKey(e.target.value)} className="border p-2" />
        <button onClick={saveAdminKey} className="px-3 py-1 bg-emerald-600 text-white rounded">Use key</button>
        <div className="ml-auto flex gap-2">
          <button onClick={()=>setFilter('pending')} className={`px-2 py-1 rounded ${filter==='pending'?'bg-gray-900 text-white':'bg-white border'}`}>Pending</button>
          <button onClick={()=>setFilter('active')} className={`px-2 py-1 rounded ${filter==='active'?'bg-gray-900 text-white':'bg-white border'}`}>Active</button>
          <button onClick={()=>setFilter('all')} className={`px-2 py-1 rounded ${filter==='all'?'bg-gray-900 text-white':'bg-white border'}`}>All</button>
        </div>
      </div>

      {msg && <div className="mb-3 text-sm text-rose-600">{msg}</div>}

      {loading ? <div>Loading…</div> : (
        <div className="space-y-3">
          {clinicians.length === 0 ? <div className="text-gray-500">No clinicians.</div> :
            clinicians.map((c:any)=>(<div key={c.id} className="p-3 border rounded flex justify-between items-start">
              <div>
                <div className="font-medium">{c.displayName || c.userId}</div>
                <div className="text-sm text-gray-600">{c.specialty} • {c.status}</div>
                <div className="text-xs text-gray-500">Training completed: {String(!!c.trainingCompleted)}</div>
              </div>
              <div className="flex gap-2">
                {c.status !== 'approved' && <button onClick={()=>doAction(c.id,'approve')} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Approve</button>}
                {c.status !== 'rejected' && <button onClick={()=>doAction(c.id,'reject')} className="px-2 py-1 bg-rose-600 text-white rounded text-xs">Reject</button>}
                {c.status !== 'active' && <button onClick={()=>doAction(c.id,'activate')} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Activate</button>}
                {c.status !== 'suspended' && <button onClick={()=>doAction(c.id,'suspend')} className="px-2 py-1 bg-amber-600 text-white rounded text-xs">Suspend</button>}
                <button onClick={()=>doAction(c.id,'archive')} className="px-2 py-1 bg-gray-700 text-white rounded text-xs">Archive</button>
                <button onClick={()=>doAction(c.id,'trainingDone')} className="px-2 py-1 bg-sky-600 text-white rounded text-xs">Mark Training Done</button>
              </div>
            </div>))
          }
        </div>
      )}
    </main>
  );
}
