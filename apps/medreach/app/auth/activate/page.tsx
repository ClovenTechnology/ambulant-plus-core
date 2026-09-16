'use client';
import { useEffect, useRef, useState } from 'react';
export default function Activate() {
  const token = useRef(''); const [message, setMessage] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  useEffect(() => { const value = new URLSearchParams(window.location.hash.slice(1)).get('token'); if (value) { token.current = value; history.replaceState(null, '', window.location.pathname); } }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      if (form.get('password') !== form.get('confirm')) throw new Error('Passwords must match.');
      const res = await fetch('/api/partner-auth/activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: token.current, password: form.get('password') }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Setup failed');
      token.current = ''; setDone(true); setMessage('Password saved. You can sign in once your partner access is approved.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Setup failed'); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md space-y-5 p-8"><h1 className="text-2xl font-bold">Set your partner password</h1>{!done && <form onSubmit={submit} className="space-y-4"><label className="block">New password<input className="block w-full border p-2" type="password" name="password" minLength={12} maxLength={128} required autoComplete="new-password" /></label><label className="block">Confirm password<input className="block w-full border p-2" type="password" name="confirm" minLength={12} maxLength={128} required autoComplete="new-password" /></label><button disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-white">Save password</button></form>}<p role="status">{message.replace(/_/g, ' ')}</p><a className="underline" href="/auth/login">Sign in</a></main>;
}
