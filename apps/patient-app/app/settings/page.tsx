// apps/patient-app/app/settings/page.tsx
'use client';

import { startRegistration } from '@simplewebauthn/browser';
import { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';
import {
  CheckCircle2,
  Fingerprint,
  Loader2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

const schema = z.object({
  contactEmail: z.string().email('Enter a valid email'),
  notifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  shareData: z.boolean(),
});

type FormState = z.infer<typeof schema>;

type Passkey = {
  id: string;
  deviceLabel: string;
  createdAt?: string;
  lastUsedAt?: string | null;
  backedUp?: boolean;
  transports?: unknown;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function getUid() {
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not used yet';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optimistic, setOptimistic] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  useEffect(() => {
    const uid = getUid();

    fetch('/api/settings', { headers: { 'x-uid': uid }, cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setForm(j));

    void loadPasskeys();
  }, []);

  async function loadPasskeys() {
    try {
      const res = await fetch('/api/auth/passkey/list', {
        cache: 'no-store',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setPasskeys(Array.isArray(data.passkeys) ? data.passkeys : []);
      }
    } catch {
      // Keep settings usable even if passkey list fails.
    }
  }

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!form) return;
    setForm({ ...form, [key]: value });
  }

  function submit() {
    if (!form) return;
    setSaved(false);

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        e[issue.path.join('.')] = issue.message;
      }
      setErrors(e);
      return;
    }

    setErrors({});
    setOptimistic(true);
    const uid = getUid();

    startTransition(async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-uid': uid },
          body: JSON.stringify(parsed.data),
        });
        setSaved(true);
      } finally {
        setOptimistic(false);
      }
    });
  }

  async function addPasskey() {
    if (passkeyBusy) return;

    setPasskeyBusy(true);
    setPasskeyError(null);
    setPasskeyMessage(null);

    try {
      if (typeof window === 'undefined' || !window.PublicKeyCredential) {
        throw new Error('Passkeys are not supported on this browser or device.');
      }

      const deviceLabel =
        window.prompt('Name this passkey', 'My device passkey')?.trim() ||
        'Personal passkey';

      const optionsRes = await fetch('/api/auth/passkey/register/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceLabel }),
      });

      const optionsData = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok || !optionsData?.ok || !optionsData?.options) {
        throw new Error(optionsData?.error || 'Could not start passkey setup.');
      }

      const registrationResponse = await startRegistration(optionsData.options);

      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          response: registrationResponse,
          deviceLabel,
        }),
      });

      const verifyData = await verifyRes.json().catch(() => ({}));

      if (!verifyRes.ok || !verifyData?.ok) {
        throw new Error(verifyData?.error || 'Could not save passkey.');
      }

      setPasskeyMessage('Passkey added successfully.');
      await loadPasskeys();
    } catch (err: any) {
      const message = String(err?.message || err || 'Passkey setup failed.');
      if (message.toLowerCase().includes('abort')) {
        setPasskeyError('Passkey setup was cancelled.');
      } else {
        setPasskeyError(message);
      }
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function removePasskey(id: string) {
    if (!id || passkeyBusy) return;

    const ok = window.confirm('Remove this passkey from your Ambulant+ account?');
    if (!ok) return;

    setPasskeyBusy(true);
    setPasskeyError(null);
    setPasskeyMessage(null);

    try {
      const res = await fetch(`/api/auth/passkey/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Could not remove passkey.');
      }

      setPasskeyMessage('Passkey removed.');
      await loadPasskeys();
    } catch (err: any) {
      setPasskeyError(err?.message || 'Could not remove passkey.');
    } finally {
      setPasskeyBusy(false);
    }
  }

  if (!form) {
    return (
      <main data-p-ui="patient-settings-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-white bg-white/80 p-6 shadow-sm">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main data-p-ui="patient-settings-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50 bg-[radial-gradient(900px_circle_at_15%_-10%,rgba(20,184,166,0.16),transparent_55%),linear-gradient(to_bottom,#ffffff,#f8fafc)] p-6">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[34px] border border-white/80 bg-white/85 p-7 shadow-xl shadow-teal-900/[0.06] backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            <ShieldCheck className="h-4 w-4" />
            Patient settings
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
            Settings and security
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Manage account preferences, notifications and secure sign-in methods
            for your Ambulant+ patient workspace.
          </p>

          <div className="mt-6 rounded-[28px] border border-teal-100 bg-teal-50/70 p-5">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-teal-700" />
              <div>
                <div className="font-bold text-slate-950">Passkeys</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Passkeys let you sign in using Face ID, fingerprint, Windows Hello,
                  Android device lock, or your device screen lock where supported.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[34px] border border-white/80 bg-white/90 p-7 shadow-xl shadow-teal-900/[0.06] backdrop-blur">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Account preferences
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700">
                  Contact email
                </label>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => onChange('contactEmail', e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                {errors.contactEmail ? (
                  <div className="mt-1 text-sm text-red-600">{errors.contactEmail}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.notifications}
                    onChange={(e) => onChange('notifications', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-slate-700">Notifications</span>
                </label>

                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.shareData}
                    onChange={(e) => onChange('shareData', e.target.checked)}
                  />
                  <span className="text-sm font-medium text-slate-700">Share anonymised data</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700">Theme</label>
                <select
                  value={form.theme}
                  onChange={(e) => onChange('theme', e.target.value as any)}
                  className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={submit}
                  disabled={isPending}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {optimistic || isPending ? 'Saving...' : 'Save settings'}
                </button>

                {saved ? (
                  <div className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Saved
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-[34px] border border-white/80 bg-white/90 p-7 shadow-xl shadow-teal-900/[0.06] backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  Passkeys
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Add a passkey for faster and safer sign-in on trusted devices.
                </p>
              </div>

              <button
                onClick={addPasskey}
                disabled={passkeyBusy}
                className={cx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-teal-900/10',
                  'hover:from-teal-700 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {passkeyBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add passkey
              </button>
            </div>

            {passkeyMessage ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {passkeyMessage}
              </div>
            ) : null}

            {passkeyError ? (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {passkeyError}
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {passkeys.length ? (
                passkeys.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-[26px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-teal-700">
                        <Fingerprint className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-950">
                          {item.deviceLabel || 'Passkey'}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Created {formatDate(item.createdAt)} · Last used {formatDate(item.lastUsedAt)}
                        </div>
                        {item.backedUp ? (
                          <div className="mt-1 text-xs font-semibold text-emerald-700">
                            Synced / backed up by device provider
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      onClick={() => removePasskey(item.id)}
                      disabled={passkeyBusy}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-[26px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <Fingerprint className="mx-auto h-8 w-8 text-slate-400" />
                  <div className="mt-3 font-bold text-slate-950">No passkeys yet</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Add a passkey to sign in with your device unlock method where supported.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
