'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Login failed');
      localStorage.setItem('mycare.token', data.token);
      localStorage.setItem('mycare.profile', JSON.stringify(data.profile));
      router.push('/myCare');
    } catch (er: any) {
      setErr(er?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <div className="text-sm text-slate-700">Email</div>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full border rounded p-2" />
        </label>

        {err && <div className="text-sm text-rose-600">{err}</div>}

        <div className="flex gap-2">
          <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-indigo-600 text-white">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <button type="button" onClick={() => router.push('/auth/signup')} className="px-4 py-2 rounded border">
            Create account
          </button>
        </div>
      </form>
    </main>
  );
}
