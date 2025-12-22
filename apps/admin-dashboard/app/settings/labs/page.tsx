// apps/admin-dashboard/app/settings/labs/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TestType = {
  id?: string;
  code: string;
  name: string;
  priceZAR: number;
  etaDays: number;
};

type Lab = {
  id: string;
  name: string;
  city: string;
  contact: string;
  logoUrl?: string | null;
  active?: boolean; // treated as true when undefined
  tests: TestType[];
};

type LabFormState = {
  id?: string;
  name: string;
  city: string;
  contact: string;
  logoUrl?: string;
};

type TestFormState = {
  labId: string;
  code: string;
  name: string;
  priceZAR: string;
  etaDays: string;
};

type FilterKey = 'all' | 'active' | 'inactive';

function TextInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-gray-600">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="rounded border px-2 py-1 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
      />
    </label>
  );
}

export default function LabsSettingsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  const [labModalOpen, setLabModalOpen] = useState(false);
  const [labForm, setLabForm] = useState<LabFormState>({
    name: '',
    city: '',
    contact: '',
    logoUrl: '',
  });

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState<TestFormState>({
    labId: '',
    code: '',
    name: '',
    priceZAR: '',
    etaDays: '1',
  });

  /* ---------- Data loading ---------- */

  async function loadLabs() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch('/api/labs', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setLabs(d.labs || []);
    } catch (e: any) {
      console.error('labs settings load error', e);
      setErr(e?.message || 'Unable to load labs');
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLabs();
  }, []);

  /* ---------- Helpers ---------- */

  function openCreateLabModal() {
    setLabForm({
      id: undefined,
      name: '',
      city: '',
      contact: '',
      logoUrl: '',
    });
    setLabModalOpen(true);
  }

  function openEditLabModal(lab: Lab) {
    setLabForm({
      id: lab.id,
      name: lab.name,
      city: lab.city,
      contact: lab.contact,
      logoUrl: lab.logoUrl ?? '',
    });
    setLabModalOpen(true);
  }

  function openAddTestModal(labId: string) {
    setTestForm({
      labId,
      code: '',
      name: '',
      priceZAR: '',
      etaDays: '1',
    });
    setTestModalOpen(true);
  }

  async function saveLab(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      id: labForm.id,
      name: labForm.name.trim(),
      city: labForm.city.trim(),
      contact: labForm.contact.trim(),
      logoUrl: labForm.logoUrl?.trim() || undefined,
    };
    if (!body.name) return;

    try {
      const res = await fetch('/api/labs', {
        method: labForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setLabs(d.labs || []);
      setLabModalOpen(false);
    } catch (e: any) {
      console.error('saveLab error', e);
      setErr(e?.message || 'Unable to save lab');
    }
  }

  async function saveTest(e: React.FormEvent) {
    e.preventDefault();
    const price = parseInt(testForm.priceZAR || '0', 10) || 0;
    const eta = parseInt(testForm.etaDays || '1', 10) || 1;
    const body = {
      labId: testForm.labId,
      code: testForm.code.trim(),
      name: testForm.name.trim(),
      priceZAR: price,
      etaDays: eta,
    };
    if (!body.labId || !body.code || !body.name) return;

    try {
      const res = await fetch('/api/labs/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setLabs(d.labs || []);
      setTestModalOpen(false);
    } catch (e: any) {
      console.error('saveTest error', e);
      setErr(e?.message || 'Unable to save test');
    }
  }

  async function toggleActive(lab: Lab) {
    const current = lab.active !== false;
    const next = !current;

    // optimistic
    setLabs((prev) =>
      prev.map((l) =>
        l.id === lab.id ? { ...l, active: next } : l,
      ),
    );
    try {
      const res = await fetch('/api/labs/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lab.id, active: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      console.error('toggleActive error', e);
      // revert
      setLabs((prev) =>
        prev.map((l) =>
          l.id === lab.id ? { ...l, active: current } : l,
        ),
      );
    }
  }

  function copySelfServiceLink(lab: Lab) {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/lab/${encodeURIComponent(
      lab.id,
    )}`;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert(
          'Self-service link copied to clipboard:\n' +
            url,
        );
      })
      .catch(() => {
        // ignore
      });
  }

  /* ---------- Derived views ---------- */

  const filteredLabs = useMemo(() => {
    let res = labs;
    if (filter !== 'all') {
      const wantActive = filter === 'active';
      res = res.filter((l) => (l.active !== false) === wantActive);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.contact.toLowerCase().includes(q),
      );
    }
    return res;
  }, [labs, filter, search]);

  const totalLabs = labs.length;
  const activeLabs = labs.filter((l) => l.active !== false).length;
  const totalTests = labs.reduce(
    (sum, l) => sum + (l.tests?.length || 0),
    0,
  );

  /* ---------- Render ---------- */

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Settings — Labs &amp; Test Catalog
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Onboard and configure partner laboratories and standard
            test panels for MedReach and clinic workflows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={openCreateLabModal}
            className="rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-900"
          >
            + Add lab
          </button>
          <Link
            href="/medreach"
            className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            MedReach dashboard
          </Link>
          <Link
            href="/analytics/labs"
            className="rounded-full border bg-white px-3 py-1.5 hover:bg-gray-50"
          >
            Lab analytics
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">Loading labs…</div>
      )}

      {/* KPIs + filters */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">
            Registered labs
          </div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {totalLabs}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            {activeLabs} active
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3">
          <div className="text-xs text-gray-500">Test types</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {totalTests}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Across all partner labs
          </div>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 md:col-span-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-1">
              <span className="text-gray-500">Status</span>
              <select
                className="bg-transparent text-gray-900 outline-none"
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as FilterKey)
                }
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search labs by name, city or contact"
              className="flex-1 rounded-full border px-3 py-1 text-xs outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      </section>

      {/* LAB CARDS */}
      <section className="grid gap-4 md:grid-cols-2">
        {filteredLabs.map((lab) => {
          const active = lab.active !== false;
          const tests = lab.tests || [];

          return (
            <article
              key={lab.id}
              className={`space-y-3 rounded-2xl border bg-white p-4 shadow-sm ${
                active ? '' : 'opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {lab.logoUrl ? (
                      <img
                        src={lab.logoUrl}
                        alt={lab.name}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-600">
                        {lab.name
                          .split(' ')
                          .slice(0, 2)
                          .map((p) => p[0])
                          .join('')
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {lab.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {lab.city} • {lab.contact}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px]">
                    Status:{' '}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 text-[11px]">
                  <button
                    onClick={() => toggleActive(lab)}
                    className="rounded border bg-white px-2 py-1 hover:bg-gray-50"
                  >
                    {active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => openEditLabModal(lab)}
                    className="text-gray-600 underline"
                  >
                    Edit lab
                  </button>
                  <button
                    onClick={() => copySelfServiceLink(lab)}
                    className="text-gray-500 underline"
                  >
                    Copy self-service link
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-900">
                    Test types
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {tests.length} configured
                  </span>
                </div>
                <ul className="divide-y rounded border text-xs">
                  {tests.length === 0 ? (
                    <li className="px-3 py-2 text-[11px] text-gray-500">
                      No tests configured yet.
                    </li>
                  ) : (
                    tests.map((t) => (
                      <li
                        key={t.id || t.code}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="flex flex-col">
                          <span className="text-gray-900">
                            {t.name}
                          </span>
                          <span className="font-mono text-[10px] text-gray-500">
                            {t.code}
                          </span>
                        </div>
                        <div className="text-right text-[11px] text-gray-600">
                          <div>R {t.priceZAR}</div>
                          <div className="text-gray-400">
                            TAT {t.etaDays}d
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  onClick={() => openAddTestModal(lab.id)}
                  className="mt-2 rounded border px-3 py-1 text-xs hover:bg-gray-50"
                >
                  + Add test
                </button>
              </div>
            </article>
          );
        })}

        {filteredLabs.length === 0 && (
          <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">
            No labs match this filter. Try clearing search or add a new
            lab.
          </div>
        )}
      </section>

      {/* LAB MODAL */}
      {labModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">
                {labForm.id ? 'Edit lab' : 'Add lab'}
              </h2>
              <button
                onClick={() => setLabModalOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={saveLab}
              className="space-y-3 text-xs"
            >
              <TextInput
                label="Lab name"
                value={labForm.name}
                onChange={(v) =>
                  setLabForm((s) => ({ ...s, name: v }))
                }
                required
              />
              <TextInput
                label="City / location"
                value={labForm.city}
                onChange={(v) =>
                  setLabForm((s) => ({ ...s, city: v }))
                }
                required
              />
              <TextInput
                label="Contact"
                value={labForm.contact}
                onChange={(v) =>
                  setLabForm((s) => ({ ...s, contact: v }))
                }
                placeholder="+27 ..."
                required
              />
              <TextInput
                label="Logo URL (optional)"
                value={labForm.logoUrl || ''}
                onChange={(v) =>
                  setLabForm((s) => ({ ...s, logoUrl: v }))
                }
                placeholder="/images/labs/ambath.png"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLabModalOpen(false)}
                  className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-black px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TEST MODAL */}
      {testModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">
                Add test type
              </h2>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={saveTest}
              className="space-y-3 text-xs"
            >
              <TextInput
                label="Test code"
                value={testForm.code}
                onChange={(v) =>
                  setTestForm((s) => ({ ...s, code: v }))
                }
                placeholder="CRP"
                required
              />
              <TextInput
                label="Test name"
                value={testForm.name}
                onChange={(v) =>
                  setTestForm((s) => ({ ...s, name: v }))
                }
                placeholder="C-reactive protein (CRP)"
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Price (ZAR)"
                  value={testForm.priceZAR}
                  onChange={(v) =>
                    setTestForm((s) => ({
                      ...s,
                      priceZAR: v.replace(/[^\d]/g, ''),
                    }))
                  }
                  placeholder="180"
                  required
                />
                <TextInput
                  label="TAT (days)"
                  value={testForm.etaDays}
                  onChange={(v) =>
                    setTestForm((s) => ({
                      ...s,
                      etaDays: v.replace(/[^\d]/g, ''),
                    }))
                  }
                  placeholder="1"
                  required
                />
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(false)}
                  className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-black px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
                >
                  Save test
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
