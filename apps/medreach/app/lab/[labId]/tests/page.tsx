// apps/medreach/app/lab/[labId]/tests/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { LabTest } from '@/app/api/lab-tests/route';

export default function LabTestsPage() {
  const params = useParams<{ labId: string }>();
  const labId = params.labId;

  const [tests, setTests] = useState<LabTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<Partial<LabTest>>({
    code: '',
    name: '',
    category: '',
    sampleType: '',
    priceZAR: 0,
    etaDays: 1,
    instructions: '',
    referenceRange: '',
  });

  const niceLabName =
    labId
      .split('-')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lab-tests?labId=${encodeURIComponent(labId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { labId: string; tests: LabTest[] };
      setTests(data.tests || []);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load tests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
  }, [labId]);

  async function handleAddOrUpdate() {
    if (!draft.code || !draft.name) {
      alert('Code and name are required.');
      return;
    }

    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/lab-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, labId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { labId: string; tests: LabTest[] };
      setTests(data.tests || []);
      setDraft({
        code: '',
        name: '',
        category: '',
        sampleType: '',
        priceZAR: 0,
        etaDays: 1,
        instructions: '',
        referenceRange: '',
      });
    } catch (e: any) {
      setErr(e?.message || 'Unable to save test');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-gray-500">
        Loading test catalogue…
      </main>
    );
  }

  if (err) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-sm text-red-600">
        {err}
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {niceLabName} — Test Catalogue
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure tests offered by this lab, including categories, sample types,
            turnaround times, and pricing.
          </p>
        </div>
      </header>

      {/* Add / update test form */}
      <section className="bg-white border rounded-xl p-6 shadow-sm space-y-4 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Test Code
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={draft.code || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Test Name
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={draft.name || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="Haematology, Virology, etc."
              value={draft.category || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, category: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Sample Type
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="Serum, whole blood, swab, etc."
              value={draft.sampleType || ''}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, sampleType: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              ETA (days)
            </label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={draft.etaDays ?? 1}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  etaDays: Number(e.target.value) || 1,
                }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Price (ZAR)
            </label>
            <input
              type="number"
              className="w-full border rounded px-3 py-2"
              value={draft.priceZAR ?? 0}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  priceZAR: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Reference Range (if applicable)
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="e.g. 4.0 – 6.0 mmol/L"
              value={draft.referenceRange || ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  referenceRange: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Patient / Collection Instructions
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 min-h-[60px]"
            placeholder="Fasting, early morning urine, no water before sample, etc."
            value={draft.instructions || ''}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                instructions: e.target.value,
              }))
            }
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAddOrUpdate}
            disabled={saving}
            className={
              'px-4 py-2 rounded border text-sm ' +
              (saving
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-900')
            }
          >
            {saving ? 'Saving…' : 'Add / Update Test'}
          </button>
        </div>
      </section>

      {/* Existing tests */}
      <section className="bg-white border rounded-xl p-6 shadow-sm text-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Configured Tests</h2>
        {tests.length === 0 ? (
          <div className="text-xs text-gray-500">
            No tests configured yet. Add the first test using the form above.
          </div>
        ) : (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-2 py-1 text-left">Code</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Category</th>
                  <th className="px-2 py-1 text-left">Sample</th>
                  <th className="px-2 py-1 text-left">Price (ZAR)</th>
                  <th className="px-2 py-1 text-left">ETA (days)</th>
                  <th className="px-2 py-1 text-left">Ref. Range</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.code} className="border-t">
                    <td className="px-2 py-1 font-mono text-[11px]">{t.code}</td>
                    <td className="px-2 py-1">{t.name}</td>
                    <td className="px-2 py-1">{t.category || '—'}</td>
                    <td className="px-2 py-1">{t.sampleType || '—'}</td>
                    <td className="px-2 py-1">R {t.priceZAR.toFixed(2)}</td>
                    <td className="px-2 py-1">{t.etaDays}</td>
                    <td className="px-2 py-1">{t.referenceRange || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
