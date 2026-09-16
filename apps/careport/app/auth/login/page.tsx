'use client';
import { useState } from 'react';
export default function Login() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const res = await fetch('/api/partner-auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Sign in failed');
      const a = result.account;
      if (!["pharmacy", "rider"].includes(a.role)) { await fetch('/api/partner-auth/logout', { method: 'POST' }); throw new Error('Use the partner app for your role.'); }
      window.location.assign(a.role === 'lab' || a.role === 'phleb' ? '/' + a.role + '/' + encodeURIComponent(a.actorRefId) : '/' + a.role);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed'); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md space-y-5 p-8"><h1 className="text-2xl font-bold">Partner sign in</h1><p>Use the password set up through your Admin invitation. Access requires current partner approval.</p><form onSubmit={submit} className="space-y-4"><label className="block">Partner role<select name="role" className="block w-full rounded border p-2">{["pharmacy", "rider"].map(role => <option key={role} value={role}>{role}</option>)}</select></label><label className="block">Email<input name="email" type="email" required autoComplete="username" className="block w-full rounded border p-2" /></label><label className="block">Password<input name="password" type="password" required maxLength={128} autoComplete="current-password" className="block w-full rounded border p-2" /></label><button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white">{busy ? 'Signing in…' : 'Sign in'}</button></form><p role="alert">{error.replace(/_/g, ' ')}</p><p>For first access or a forgotten password, ask your reviewing Admin for a password setup link.</p></main>;
}
