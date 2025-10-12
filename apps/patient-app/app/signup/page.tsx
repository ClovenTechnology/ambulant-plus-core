'use client';

import { useState } from 'react';

export default function PatientSignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const res = await fetch(`${process.env.NEXT_PUBLIC_GATEWAY_BASE}/api/patients/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMsg(`Error: ${data.error || 'failed'}`);
    } else {
      setMsg(`✅ Signed up as patient ${data.userId}`);
      setName('');
      setEmail('');
    }
  };

  return (
    <main className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Patient Signup</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Full Name"
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full border p-2 rounded"
          required
        />
        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded">
          Sign Up
        </button>
      </form>
      {msg && <div className="mt-3 text-sm">{msg}</div>}
    </main>
  );
}
