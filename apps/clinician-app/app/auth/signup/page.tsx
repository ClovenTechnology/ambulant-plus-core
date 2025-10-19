// apps/clinician-app/app/auth/signup/page.tsx
'use client';

import { useState } from 'react';

export default function ClinicianSignupPage() {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [fee, setFee] = useState(650);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch('/api/clinicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, specialty, feeZAR: fee }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error || 'failed'}`);
      } else {
        setMsg(`✅ Signed up as ${data.clinician?.displayName ?? data.clinician?.userId ?? 'clinician'}`);
        setName('');
        setSpecialty('');
        setFee(650);
      }
    } catch (err: any) {
      setMsg(`Error: ${err?.message ?? 'network error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Clinician Signup</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="w-full border p-2 rounded" required />
        <input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Specialty" className="w-full border p-2 rounded" required />
        <input type="number" value={fee} onChange={e => setFee(Number(e.target.value))} placeholder="Consult Fee (R)" className="w-full border p-2 rounded" />
        <div className="flex gap-2">
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={loading}>
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>
        </div>
      </form>
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </main>
  );
}
