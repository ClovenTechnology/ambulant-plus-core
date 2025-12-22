// apps/admin-dashboard/components/AdminSignIn.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthApi } from '@/src/lib/gateway';

export default function AdminSignIn() {
  const qs = useSearchParams();
  const next = qs.get('next') || '/';

  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      await AuthApi.adminLogin({ email });
      // Gateway set adm.profile cookie; redirect
      window.location.href = next;
    } catch (err: any) {
      setMsg(err?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-6">
      <h2 className="text-base font-semibold">Sign in</h2>

      <label className="mt-3 block text-sm">
        <span className="text-gray-700">Email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border p-2"
          placeholder="you@company.com"
        />
      </label>

      {msg && <div className="mt-2 text-sm text-rose-600">{msg}</div>}

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <a
          href="/auth/signup"
          className="rounded border px-4 py-2 text-sm hover:bg-black/5"
        >
          Create account
        </a>
      </div>
    </form>
  );
}
