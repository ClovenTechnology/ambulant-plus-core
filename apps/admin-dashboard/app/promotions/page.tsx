// apps/admin-dashboard/app/promotions/page.tsx
'use client';

import { useEffect, useState } from 'react';

const APIGW_BASE =
  process.env.NEXT_PUBLIC_APIGW_BASE ?? 'http://localhost:3010';

type PromoToken = {
  id: string;
  code: string;
  kind: string;
  description?: string | null;
  amountCents: number;
  currency: string;
  maxUses: number;
  usedCount: number;
  patientId?: string | null;
  active?: boolean;
  validFrom?: string | null;
  expiresAt?: string | null;
};

type FormState = {
  id?: string;
  code: string;
  description: string;
  amountZar: string;
  maxUses: string;
  patientId: string;
  validFrom: string; // yyyy-mm-dd
  expiresAt: string; // yyyy-mm-dd
  active: boolean;
};

const emptyForm: FormState = {
  id: undefined,
  code: '',
  description: '',
  amountZar: '0',
  maxUses: '1',
  patientId: '',
  validFrom: '',
  expiresAt: '',
  active: true,
};

export default function PromotionsPage() {
  const [tokens, setTokens] = useState<PromoToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      setLoading(true);
      const r = await fetch(`${APIGW_BASE}/api/vouchers`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setTokens(d.vouchers || []);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load promotions');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      amountZar: '200',
      maxUses: '1',
      active: true,
    });
  };

  const startEdit = (t: PromoToken) => {
    setEditingId(t.id);
    setForm({
      id: t.id,
      code: t.code || '',
      description: t.description || '',
      amountZar: ((t.amountCents || 0) / 100).toString(),
      maxUses: (t.maxUses || 1).toString(),
      patientId: t.patientId || '',
      validFrom: t.validFrom ? t.validFrom.slice(0, 10) : '',
      expiresAt: t.expiresAt ? t.expiresAt.slice(0, 10) : '',
      active: t.active !== false,
    });
  };

  const handleFormChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    // basic validation
    const amountCents =
      Math.round(Number(form.amountZar || '0') * 100) || 0;
    const maxUses = parseInt(form.maxUses || '1', 10) || 1;

    const payload: any = {
      code: form.code || undefined,
      kind: 'consult',
      description: form.description || undefined,
      amountCents,
      currency: 'ZAR',
      maxUses,
      patientId: form.patientId || undefined,
      active: form.active,
    };

    if (form.validFrom) {
      const d = new Date(form.validFrom);
      if (!Number.isNaN(d.getTime())) {
        payload.validFrom = d.toISOString();
      }
    }
    if (form.expiresAt) {
      const d = new Date(form.expiresAt);
      if (!Number.isNaN(d.getTime())) {
        payload.expiresAt = d.toISOString();
      }
    }

    try {
      if (editingId) {
        // Update existing voucher
        const res = await fetch(
          `${APIGW_BASE}/api/vouchers/${encodeURIComponent(editingId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, ...payload }),
          },
        );
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(
            txt || `Failed to update voucher (HTTP ${res.status})`,
          );
        }
      } else {
        // Create new voucher
        const res = await fetch(`${APIGW_BASE}/api/vouchers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(
            txt || `Failed to create voucher (HTTP ${res.status})`,
          );
        }
      }

      await load();
      setForm(emptyForm);
      setEditingId(null);
    } catch (e: any) {
      setErr(e?.message || 'Failed to save voucher. Check API gateway logs.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(token: PromoToken) {
    const current = token.active !== false;
    const next = !current;

    // optimistic
    setTokens((prev) =>
      prev.map((t) =>
        t.id === token.id ? { ...t, active: next } : t,
      ),
    );

    try {
      const res = await fetch(`${APIGW_BASE}/api/vouchers/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: token.id, active: next }),
      });
      if (!res.ok) throw new Error('status_update_failed');
    } catch {
      // revert
      setTokens((prev) =>
        prev.map((t) =>
          t.id === token.id ? { ...t, active: current } : t,
        ),
      );
      alert('Failed to update voucher status.');
    }
  }

  const filteredTokens = tokens.filter((t) => {
    if (filterActive === 'active' && t.active === false) return false;
    if (filterActive === 'inactive' && t.active !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(t.code || '').toLowerCase().includes(q) &&
        !(t.description || '').toLowerCase().includes(q) &&
        !(t.patientId || '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  if (loading) {
    return (
      <main className="p-6 text-sm text-gray-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-6">
      <header className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-lg font-semibold">
            Promotions &amp; Vouchers
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            Generate and manage voucher tokens for consultations or other
            services. Patients can redeem these during checkout via code
            entry.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="rounded bg-black px-3 py-1 text-sm text-white"
        >
          {editingId ? 'New voucher' : 'Create voucher'}
        </button>
      </header>

      {err ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          {err}
        </div>
      ) : null}

      {/* Builder / editor card */}
      <section className="rounded border bg-white p-4 text-xs">
        <form
          onSubmit={submitForm}
          className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end"
        >
          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Code
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              placeholder="AMBULANT-LAUNCH-200"
              value={form.code}
              onChange={(e) =>
                handleFormChange('code', e.target.value)
              }
            />
            <p className="text-[10px] text-gray-400">
              Leave blank to auto-generate (if your API supports it).
            </p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-[11px] text-gray-600">
              Description
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              placeholder="Launch promo R200 off first consult"
              value={form.description}
              onChange={(e) =>
                handleFormChange('description', e.target.value)
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Value (ZAR)
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              type="number"
              min={0}
              step="0.01"
              value={form.amountZar}
              onChange={(e) =>
                handleFormChange('amountZar', e.target.value)
              }
            />
            <p className="text-[10px] text-gray-400">
              Fixed value per use.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Max uses
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              type="number"
              min={0}
              value={form.maxUses}
              onChange={(e) =>
                handleFormChange('maxUses', e.target.value)
              }
            />
            <p className="text-[10px] text-gray-400">
              0 = unlimited.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Restrict to patient ID (optional)
            </label>
            <input
              className="w-full rounded border px-2 py-1 text-xs"
              placeholder="pt-za-001"
              value={form.patientId}
              onChange={(e) =>
                handleFormChange('patientId', e.target.value)
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Valid from
            </label>
            <input
              type="date"
              className="w-full rounded border px-2 py-1 text-xs"
              value={form.validFrom}
              onChange={(e) =>
                handleFormChange('validFrom', e.target.value)
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-600">
              Expires at
            </label>
            <input
              type="date"
              className="w-full rounded border px-2 py-1 text-xs"
              value={form.expiresAt}
              onChange={(e) =>
                handleFormChange('expiresAt', e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="active"
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  handleFormChange('active', e.target.checked)
                }
              />
              <label
                htmlFor="active"
                className="text-[11px] text-gray-700"
              >
                Active
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
            >
              {saving
                ? 'Saving…'
                : editingId
                ? 'Save changes'
                : 'Create voucher'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={startCreate}
                className="w-full rounded border bg-white px-3 py-1 text-[11px] hover:bg-gray-50"
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Filters */}
      <section className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-gray-600">Filter:</span>
          <select
            className="rounded border px-2 py-1"
            value={filterActive}
            onChange={(e) =>
              setFilterActive(e.target.value as any)
            }
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Search code / description / patient…"
            className="w-64 rounded border px-2 py-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-[11px] text-gray-500">
            {filteredTokens.length} of {tokens.length} voucher
            {tokens.length === 1 ? '' : 's'}
          </span>
        </div>
      </section>

      {/* Table */}
      <div className="rounded border bg-white">
        <table className="w-full text-xs">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Code</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Uses</th>
              <th className="px-3 py-2 text-left">Patient</th>
              <th className="px-3 py-2 text-left">Validity</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTokens.map((t) => {
              const active = t.active !== false;
              const remaining =
                t.maxUses === 0
                  ? '∞'
                  : Math.max(0, t.maxUses - t.usedCount).toString();
              const valueZar = (t.amountCents || 0) / 100;
              const vf = t.validFrom ? t.validFrom.slice(0, 10) : '';
              const ve = t.expiresAt ? t.expiresAt.slice(0, 10) : '';
              return (
                <tr
                  key={t.id}
                  className={
                    'border-b last:border-b-0 ' +
                    (active ? '' : 'opacity-60')
                  }
                >
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {t.code}
                  </td>
                  <td className="max-w-xs px-3 py-2">
                    {t.description || (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.currency || 'ZAR'} {valueZar.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.usedCount} / {t.maxUses || '∞'}{' '}
                    <span className="text-gray-500">
                      (remaining {remaining})
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {t.patientId || (
                      <span className="text-gray-400">
                        Any patient
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {vf || '—'} {vf || ve ? '→' : ''} {ve || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => startEdit(t)}
                        className="rounded border bg-white px-2 py-0.5 text-[11px] hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(t)}
                        className="rounded border bg-white px-2 py-0.5 text-[11px] hover:bg-gray-50"
                      >
                        {active ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTokens.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  No vouchers match this filter. Use &quot;Create
                  voucher&quot; to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
