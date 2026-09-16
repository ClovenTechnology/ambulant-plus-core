'use client';
import { useState } from 'react';
export default function Account() {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); try { const res = await fetch('/api/partner-auth/logout', { method: 'POST' }); if (!res.ok) throw new Error('Sign out failed. Please retry.'); window.location.assign('/auth/login'); } catch (e) { setError(String(e)); setBusy(false); } }
  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try { const form = new FormData(event.currentTarget); if (form.get('password') !== form.get('confirm')) throw new Error('Passwords must match.'); const res = await fetch('/api/partner-auth/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Password change failed'); window.location.assign('/auth/login'); } catch (e) { setError(String(e)); setBusy(false); }
  }
  return <main className="mx-auto max-w-md space-y-5 p-8"><h1 className="text-2xl font-bold">Partner account</h1><button disabled={busy} className="underline" onClick={logout}>Sign out</button><h2>Change password</h2><p>Changing your password signs out all your sessions.</p><form onSubmit={change} className="space-y-4"><label className="block">Current password<input className="block w-full border p-2" required type="password" name="currentPassword" autoComplete="current-password" /></label><label className="block">New password<input className="block w-full border p-2" required type="password" name="password" minLength={12} maxLength={128} autoComplete="new-password" /></label><label className="block">Confirm password<input className="block w-full border p-2" required type="password" name="confirm" minLength={12} maxLength={128} autoComplete="new-password" /></label><button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white">Change password</button></form><p role="alert">{error.replace(/_/g, ' ')}</p></main>;
}
