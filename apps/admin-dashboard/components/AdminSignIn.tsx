// apps/admin-dashboard/components/AdminSignIn.tsx
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthApi } from '@/src/lib/gateway';

export default function AdminSignIn() {
  const qs = useSearchParams();
  const next = qs?.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(
    qs?.get('approval') === 'pending'
      ? 'Your application has been submitted and is awaiting Super Admin approval. You cannot sign in until it is approved.'
      : null,
  );
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      await AuthApi.adminLogin({ email: cleanEmail, password });
      window.location.href = next;
    } catch (err: any) {
      const raw = String(err?.message || 'Sign in failed');
      if (raw.includes('admin_approval_pending')) {
        setMsg('Your application is awaiting Super Admin approval. You cannot sign in yet.');
      } else if (raw.includes('admin_application_denied')) {
        setMsg('This application was not approved. Please contact the Super Admin if you need a review.');
      } else if (raw.includes('password_not_set')) {
        setMsg('This existing Admin account requires secure credential setup. Please contact the Super Admin.');
      } else if (raw.includes('invalid_credentials')) {
        setMsg('Invalid email or password.');
      } else {
        setMsg(raw);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">Sign in</h2>

      <label className="mt-3 block text-sm">
        <span className="text-gray-700">Email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2.5 outline-none focus:border-slate-500"
          placeholder="you@company.com"
          autoComplete="email"
        />
      </label>

      <label className="mt-3 block text-sm">
        <span className="text-gray-700">Password</span>
        <div className="mt-1 flex rounded-lg border bg-white focus-within:border-slate-500">
          <input
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-transparent p-2.5 outline-none"
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="px-3 text-xs text-slate-600 hover:text-slate-900"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </label>

      {msg && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <a href="/auth/signup" className="rounded-lg border px-4 py-2 text-sm hover:bg-black/5">
          Create account
        </a>
      </div>
    </form>
  );
}
