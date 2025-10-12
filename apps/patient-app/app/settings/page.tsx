// apps/patient-app/app/settings/page.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { z } from 'zod';

const schema = z.object({
  contactEmail: z.string().email('Enter a valid email'),
  notifications: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  shareData: z.boolean(),
});

type FormState = z.infer<typeof schema>;

function getUid() {
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [optimistic, setOptimistic] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const uid = getUid();
    fetch('/api/settings', { headers: { 'x-uid': uid }, cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setForm(j));
  }, []);

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
    // optimistic save
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

  if (!form) {
    return <main className="p-6">Loadingâ€¦</main>;
  }

  return (
    <main className="p-6">
      <div className="mx-auto max-w-xl rounded-2xl border p-6 bg-white">
        <h1 className="text-xl font-semibold">Settings</h1>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm text-neutral-700">Contact email</label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => onChange('contactEmail', e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            {errors.contactEmail && <div className="text-sm text-red-600 mt-1">{errors.contactEmail}</div>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.notifications}
                onChange={(e) => onChange('notifications', e.target.checked)}
              />
              <span className="text-sm">Notifications</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.shareData}
                onChange={(e) => onChange('shareData', e.target.checked)}
              />
              <span className="text-sm">Share anonymized data</span>
            </label>
          </div>

          <div>
            <label className="block text-sm text-neutral-700">Theme</label>
            <select
              value={form.theme}
              onChange={(e) => onChange('theme', e.target.value as any)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
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
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {optimistic || isPending ? 'Savingâ€¦' : 'Save Settings'}
            </button>
            {saved && <div className="text-sm text-emerald-600">Saved âœ“</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
