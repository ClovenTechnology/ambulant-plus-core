// apps/medreach/app/lab/[labId]/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { LabSettings } from '@/app/api/labs/settings/route';

export default function LabSettingsPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [settings, setSettings] = useState<LabSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/labs/settings?labId=${encodeURIComponent(labId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as LabSettings;
        if (!mounted) return;
        setSettings(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Unable to load lab settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [labId]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/labs/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, labId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LabSettings;
      setSettings(data);
      alert('Lab settings saved.');
    } catch (e: any) {
      setErr(e?.message || 'Unable to save lab settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading lab settings…
      </main>
    );
  }

  if (err || !settings) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 text-sm text-red-600">
        {err || 'Unable to load lab settings.'}
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {settings.name || labId} — Settings
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Maintain contact details, address, and branding for this lab. This information
            surfaces to clinicians and patients where appropriate.
          </p>
        </div>
      </header>

      {err && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2 rounded">
          {err}
        </div>
      )}

      <section className="bg-white border rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Lab Name
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            value={settings.name}
            onChange={(e) =>
              setSettings((prev) => prev && { ...prev, name: e.target.value })
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Primary Phone
            </label>
            <input
              type="tel"
              className="w-full border rounded px-3 py-2"
              value={settings.primaryPhone || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, primaryPhone: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Primary Email
            </label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={settings.primaryEmail || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, primaryEmail: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Address Line 1
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={settings.addressLine1 || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, addressLine1: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Address Line 2
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={settings.addressLine2 || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, addressLine2: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={settings.city || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, city: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Province
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={settings.province || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, province: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={settings.postalCode || ''}
              onChange={(e) =>
                setSettings((prev) => prev && { ...prev, postalCode: e.target.value })
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Logo URL
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="https://…/logo.png"
            value={settings.logoUrl || ''}
            onChange={(e) =>
              setSettings((prev) => prev && { ...prev, logoUrl: e.target.value })
            }
          />
          {settings.logoUrl && (
            <div className="mt-2">
              <img
                src={settings.logoUrl}
                alt="Lab logo preview"
                className="h-10 object-contain"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={
              'px-4 py-2 rounded border text-sm ' +
              (saving
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-900')
            }
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </section>
    </main>
  );
}
