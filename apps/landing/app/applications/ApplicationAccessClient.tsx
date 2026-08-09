'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { normalisePortalReference } from './client-policy';

export default function ApplicationAccessClient({ initialReference = '' }: { initialReference?: string }) {
  const [referenceCode, setReferenceCode] = useState(normalisePortalReference(initialReference));
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const reference = normalisePortalReference(referenceCode);
    if (!reference || !email.trim()) {
      setError('Enter your application reference and email address.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/applications/public/access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ referenceCode: reference, email: email.trim() }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || 'application_access_request_failed');
      }
      setSent(true);
    } catch {
      setError('The access request could not be completed. Please try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-14 text-slate-950">
      <div className="mx-auto max-w-xl">
        <Link href="/opportunities" className="text-sm font-medium text-cyan-700 hover:text-cyan-900">← Opportunities</Link>
        <div className="mt-5 rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Secure applicant access</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Manage your Ambulant+ application</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Enter the reference shown after submission and the same email address used in your application. For privacy, the response is the same whether or not the details match.</p>

          {sent ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">If the details match an application, a secure access link has been sent to that email address. The link expires automatically.</div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium">Application reference
                <input value={referenceCode} onChange={(event) => setReferenceCode(event.target.value.toUpperCase())} placeholder="APP-…" autoComplete="off" className="mt-2 w-full rounded-xl border px-3 py-2 font-mono text-sm" />
              </label>
              <label className="block text-sm font-medium">Application email
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" />
              </label>
              {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Requesting secure link…' : 'Email me a secure access link'}</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
