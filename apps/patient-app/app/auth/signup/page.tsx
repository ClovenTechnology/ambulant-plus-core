'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Signup failed');
      // Save token/profile
      localStorage.setItem('mycare.token', data.token);
      localStorage.setItem('mycare.profile', JSON.stringify(data.profile));
      router.push('/myCare');
    } catch (er: any) {
      setErr(er?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Sign up</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <div className="text-sm text-slate-700">Full name</div>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded p-2" />
        </label>
        <label className="block">
          <div className="text-sm text-slate-700">Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border rounded p-2" />
        </label>
        <label className="block">
          <div className="text-sm text-slate-700">Phone</div>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border rounded p-2" />
        </label>

        {err && <div className="text-sm text-rose-600">{err}</div>}

        <div className="flex gap-2">
          <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">
            {loading ? 'Signing up…' : 'Sign up'}
          </button>
          <button type="button" onClick={() => router.push('/auth/login')} className="px-4 py-2 rounded border">
            Already have account
          </button>
        </div>
      </form>
    </main>
  );
}
