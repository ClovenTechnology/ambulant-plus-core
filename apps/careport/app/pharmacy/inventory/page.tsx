//apps/careport/app/pharmacy/inventory/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Sku = {
  id: string;
  name: string;
  drugCode?: string | null;
  skuCode?: string | null;
  priceCents: number;
  currency: string;
  isGeneric: boolean;
  isActive: boolean;
};

type GenericLink = {
  id: string;
  originalSkuId: string;
  genericSkuId: string;
  originalSku?: Sku | null;
  genericSku?: Sku | null;
};

function money(cents: number, currency = 'ZAR') {
  return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
}

function normalizePriceInput(value: string) {
  const n = Number(String(value || '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export default function PharmacyInventoryPage() {
  const [items, setItems] = useState<Sku[]>([]);
  const [links, setLinks] = useState<GenericLink[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    drugCode: '',
    skuCode: '',
    price: '',
    currency: 'ZAR',
    isGeneric: false,
  });

  const [linkForm, setLinkForm] = useState({ originalSkuId: '', genericSkuId: '' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [invRes, linkRes] = await Promise.all([
        fetch('/api/careport/pharmacies/me/inventory?limit=500', { cache: 'no-store' }),
        fetch('/api/careport/pharmacies/me/generic-links', { cache: 'no-store' }),
      ]);

      const inv = await invRes.json().catch(() => ({}));
      const gl = await linkRes.json().catch(() => ({}));

      if (!invRes.ok || !inv?.ok) throw new Error(inv?.error || `inventory_http_${invRes.status}`);
      if (!linkRes.ok || !gl?.ok) throw new Error(gl?.error || `generic_links_http_${linkRes.status}`);

      setItems(Array.isArray(inv.items) ? inv.items : Array.isArray(inv.inventory) ? inv.inventory : []);
      setLinks(Array.isArray(gl.links) ? gl.links : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load inventory.');
      setItems([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.name, item.drugCode, item.skuCode, item.currency, item.isGeneric ? 'generic' : 'original', item.isActive ? 'active' : 'inactive']
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(needle)),
    );
  }, [items, q]);

  const originals = items.filter((x) => x.isActive && !x.isGeneric);
  const generics = items.filter((x) => x.isActive && x.isGeneric);

  async function createSku() {
    setBusy('create');
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        drugCode: form.drugCode.trim() || null,
        skuCode: form.skuCode.trim() || null,
        priceCents: normalizePriceInput(form.price),
        currency: form.currency.trim().toUpperCase() || 'ZAR',
        isGeneric: form.isGeneric,
        isActive: true,
      };

      const res = await fetch('/api/careport/pharmacies/me/inventory', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || `create_http_${res.status}`);

      setForm({ name: '', drugCode: '', skuCode: '', price: '', currency: payload.currency, isGeneric: false });
      setMessage('SKU added.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not add SKU.');
    } finally {
      setBusy(null);
    }
  }

  async function patchSku(id: string, data: Partial<Sku>) {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/inventory/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(js?.error || `update_http_${res.status}`);
      setMessage('Inventory updated.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not update SKU.');
    } finally {
      setBusy(null);
    }
  }

  async function deactivateSku(id: string) {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/inventory/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(js?.error || `delete_http_${res.status}`);
      setMessage('SKU deactivated.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not deactivate SKU.');
    } finally {
      setBusy(null);
    }
  }

  async function createGenericLink() {
    setBusy('link');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/careport/pharmacies/me/generic-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(linkForm),
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(js?.error || `link_http_${res.status}`);
      setLinkForm({ originalSkuId: '', genericSkuId: '' });
      setMessage('Generic substitution linked.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not create generic link.');
    } finally {
      setBusy(null);
    }
  }

  async function deleteLink(id: string) {
    setBusy(id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/careport/pharmacies/me/generic-links/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const js = await res.json().catch(() => ({}));
      if (!res.ok || !js?.ok) throw new Error(js?.error || `delete_link_http_${res.status}`);
      setMessage('Generic substitution removed.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Could not remove generic link.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pharmacy inventory</p>
          <h1 className="text-2xl font-semibold text-slate-950">SKU catalogue and generic substitution</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Maintain original and generic medicines used by CarePort to score invitation eligibility, build offers, and show patients transparent price choices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/pharmacy" className="rounded-xl border bg-white px-3 py-2 hover:bg-slate-50">Dashboard</Link>
          <Link href="/pharmacy/inventory/import" className="rounded-xl bg-slate-900 px-3 py-2 font-semibold text-white hover:bg-slate-800">Bulk import</Link>
        </div>
      </header>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Inventory</h2>
              <p className="text-xs text-slate-500">{items.length} SKU records</p>
            </div>
            <button onClick={() => void load()} className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50" disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <input
            className="mt-4 w-full rounded-2xl border px-3 py-2 text-sm"
            placeholder="Search by medicine name, code, original/generic, active/inactive"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />

          <div className="mt-4 overflow-hidden rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((item) => (
                  <tr key={item.id} className={!item.isActive ? 'bg-slate-50 text-slate-400' : ''}>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.drugCode || 'No code recorded'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border px-2 py-1 text-xs">{item.isGeneric ? 'Generic' : 'Original'}</span>
                    </td>
                    <td className="px-3 py-3">{money(item.priceCents, item.currency)}</td>
                    <td className="px-3 py-3">{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                          disabled={busy === item.id}
                          onClick={() => void patchSku(item.id, { isActive: !item.isActive })}
                        >
                          {item.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        {item.isActive && (
                          <button
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            disabled={busy === item.id}
                            onClick={() => void deactivateSku(item.id)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                      {loading ? 'Loading inventory...' : 'No matching inventory items.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Add SKU</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Medicine name" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Clinical code / NAPPI / RxNorm" value={form.drugCode} onChange={(e) => setForm((s) => ({ ...s, drugCode: e.target.value }))} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Pharmacy SKU / stock code" value={form.skuCode} onChange={(e) => setForm((s) => ({ ...s, skuCode: e.target.value }))} />
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <input className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Price, e.g. 79.99" value={form.price} onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))} />
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value.toUpperCase().slice(0, 3) }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isGeneric} onChange={(e) => setForm((s) => ({ ...s, isGeneric: e.target.checked }))} />
                This is a generic alternative
              </label>
              <button
                className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={busy === 'create' || !form.name.trim() || !form.price.trim()}
                onClick={() => void createSku()}
              >
                {busy === 'create' ? 'Adding...' : 'Add SKU'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-950">Generic substitution map</h2>
            <p className="mt-1 text-xs text-slate-500">Link an original medicine to an approved generic alternative from your own inventory.</p>
            <div className="mt-4 grid gap-2">
              <select className="rounded-xl border px-3 py-2 text-sm" value={linkForm.originalSkuId} onChange={(e) => setLinkForm((s) => ({ ...s, originalSkuId: e.target.value }))}>
                <option value="">Select original</option>
                {originals.map((sku) => <option key={sku.id} value={sku.id}>{sku.name}</option>)}
              </select>
              <select className="rounded-xl border px-3 py-2 text-sm" value={linkForm.genericSkuId} onChange={(e) => setLinkForm((s) => ({ ...s, genericSkuId: e.target.value }))}>
                <option value="">Select generic</option>
                {generics.map((sku) => <option key={sku.id} value={sku.id}>{sku.name}</option>)}
              </select>
              <button
                className="rounded-xl border bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                disabled={busy === 'link' || !linkForm.originalSkuId || !linkForm.genericSkuId}
                onClick={() => void createGenericLink()}
              >
                {busy === 'link' ? 'Linking...' : 'Create generic link'}
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {links.map((link) => (
                <div key={link.id} className="rounded-xl border p-3 text-xs">
                  <div className="font-medium text-slate-800">{link.originalSku?.name || link.originalSkuId}</div>
                  <div className="text-slate-500">{'->'} {link.genericSku?.name || link.genericSkuId}</div>
                  <button className="mt-2 text-rose-700 hover:underline" disabled={busy === link.id} onClick={() => void deleteLink(link.id)}>Remove</button>
                </div>
              ))}
              {!links.length && <div className="rounded-xl border border-dashed p-3 text-xs text-slate-500">No generic links yet.</div>}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
