// apps/admin-dashboard/app/admin/shop/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Channel = 'PATIENT' | 'CLINICIAN' | 'MEDREACH' | 'CAREPORT';

type Variant = {
  id: string;
  productId: string;
  sku: string;
  label: string;
  active: boolean;
  imageUrl?: string;
  unitAmountZar: number;
  saleUnitAmountZar?: number | null;
  priceZar?: number;
  inStock: boolean;
  stockQty?: number | null;
  allowBackorder?: boolean;
  channels: Channel[];
  updatedAt?: any;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string; // merch / duecare
  collection?: string | null;
  tags: string[];
  images: string[];
  fallbackImage?: string;
  active: boolean;
  allowBackorder: boolean;
  maxQtyPerOrder?: number | null;
  unitAmountZar: number;
  saleAmountZar?: number | null;
  channels: Channel[];
  variants: Variant[];
  updatedAt?: any;
};

const ALL_CHANNELS: Channel[] = ['PATIENT', 'CLINICIAN', 'MEDREACH', 'CAREPORT'];

function moneyZar(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 'R 0';
  return `R ${Math.round(x).toLocaleString('en-ZA')}`;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function pickPrice(base?: number | null, sale?: number | null) {
  const s = Number(sale ?? 0);
  if (Number.isFinite(s) && s > 0) return s;
  const b = Number(base ?? 0);
  if (Number.isFinite(b) && b > 0) return b;
  return 0;
}

export default function AdminShopSettingsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [editing, setEditing] = useState<Product | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // “create product” quick form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'merch' | 'duecare'>('merch');

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const url = new URL('/api/settings/shop', window.location.origin);
      if (showInactive) url.searchParams.set('includeInactive', '1');
      const res = await fetch(url.toString(), { cache: 'no-store' });
      const js = await res.json();
      if (!res.ok || !js.ok) throw new Error(js?.error || 'Failed to load shop settings');
      setItems(js.items || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, [showInactive]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) => {
      const hay = `${p.name} ${p.slug} ${p.type} ${(p.tags || []).join(' ')}`.toLowerCase();
      if (hay.includes(term)) return true;
      return (p.variants || []).some((v) => `${v.sku} ${v.label}`.toLowerCase().includes(term));
    });
  }, [items, q]);

  async function api(method: 'POST' | 'PATCH' | 'DELETE', body: any) {
    const res = await fetch('/api/settings/shop', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const js = await res.json().catch(() => ({}));
    if (!res.ok || js.ok === false) throw new Error(js.error || 'Request failed');
    return js;
  }

  async function createProduct() {
    const name = newName.trim();
    if (!name) return;
    try {
      setBusy(true);
      await api('POST', {
        kind: 'product',
        name,
        type: newType,
        active: true,
        allowBackorder: false,
        unitAmountZar: 0,
        saleAmountZar: null,
        tags: [],
        images: [],
        channels: [], // empty => visible to all channels (per your /api/shop logic)
      });
      setNewName('');
      setToast('Created product.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Product) {
    // deep copy for safe editing in state
    setEditing(JSON.parse(JSON.stringify(p)));
  }

  async function saveProduct(p: Product) {
    try {
      setBusy(true);
      setErr(null);

      await api('PATCH', {
        kind: 'product',
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        type: p.type,
        collection: p.collection ?? null,
        tags: p.tags || [],
        images: p.images || [],
        fallbackImage: p.fallbackImage || '',
        active: p.active,
        allowBackorder: p.allowBackorder,
        maxQtyPerOrder: p.maxQtyPerOrder ?? null,
        unitAmountZar: p.unitAmountZar,
        saleAmountZar: p.saleAmountZar ?? null,
        channels: p.channels || [],
      });

      // Variants are saved separately (so product save stays snappy)
      for (const v of p.variants || []) {
        await api('PATCH', {
          kind: 'variant',
          id: v.id,
          sku: v.sku,
          label: v.label,
          active: v.active,
          imageUrl: v.imageUrl || '',
          unitAmountZar: v.unitAmountZar,
          saleUnitAmountZar: v.saleUnitAmountZar ?? null,
          inStock: v.inStock,
          allowBackorder: v.allowBackorder ?? null,
          channels: v.channels || [],
        });
      }

      setToast('Saved.');
      setEditing(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete product and all variants?')) return;
    try {
      setBusy(true);
      await api('DELETE', { kind: 'product', id });
      setToast('Deleted product.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function addVariant(productId: string) {
    const sku = prompt('Variant SKU (unique):');
    if (!sku) return;
    const label = prompt('Variant label (e.g. Size M):');
    if (!label) return;

    try {
      setBusy(true);
      await api('POST', {
        kind: 'variant',
        productId,
        sku: sku.trim(),
        label: label.trim(),
        active: true,
        unitAmountZar: 0,
        saleUnitAmountZar: null,
        stockQty: 0,
        inStock: true,
        allowBackorder: null,
        imageUrl: '',
        channels: [], // empty => inherits product channels in your storefront logic
      });
      setToast('Variant created.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Variant create failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteVariant(id: string) {
    if (!confirm('Delete this variant?')) return;
    try {
      setBusy(true);
      await api('DELETE', { kind: 'variant', id });
      setToast('Deleted variant.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function adjustStock(variantId: string, current: number | null | undefined) {
    if (current == null) {
      alert('Stock is untracked for this variant (stockQty is null). Set a number first by editing the variant and saving.');
      return;
    }

    const nextStr = prompt(`Set stock quantity (current: ${current}):`, String(current));
    if (nextStr == null) return;

    const next = Math.max(0, Math.round(Number(nextStr)));
    if (!Number.isFinite(next)) return;

    try {
      setBusy(true);
      await api('PATCH', {
        kind: 'variant_stock_adjust',
        variantId,
        mode: 'set',
        value: next,
        reason: 'admin_set',
        note: 'admin-dashboard',
      });
      setToast('Stock updated.');
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Stock update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">1Stop Catalog (Admin)</h1>
          <p className="text-sm text-gray-600">
            Inventory, variants, pricing, and channel exposure rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50"
            disabled={busy}
          >
            {busy ? 'Refreshing…' : 'Refresh'}
          </button>

          <label className="text-xs flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 bg-white">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            show inactive
          </label>
        </div>
      </header>

      {toast && (
        <div className="text-sm bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2">
          {toast}
        </div>
      )}
      {err && (
        <div className="text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
          {err}
        </div>
      )}

      {/* Create */}
      <div className="border rounded-lg bg-white shadow-sm p-3 flex flex-col md:flex-row md:items-center gap-2">
        <div className="font-medium text-sm">Create product</div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Ambulant+ Hoodie"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="merch">merch</option>
          <option value="duecare">duecare</option>
        </select>
        <button
          type="button"
          onClick={createProduct}
          disabled={busy || !newName.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Create
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product / slug / tags / SKU…"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filtered.map((p) => {
          const expanded = expandedId === p.id;
          const price = pickPrice(p.unitAmountZar, p.saleAmountZar);

          return (
            <div key={p.id} className="border rounded-lg bg-white shadow-sm overflow-hidden">
              <div className="p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={(p.images?.[0] || p.fallbackImage || '/images/shop/_placeholder.png')}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-sm">{p.name}</div>
                      <span className="text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-gray-50">
                        {p.type}
                      </span>
                      {!p.active && (
                        <span className="text-[11px] px-2 py-1 rounded-full border border-red-200 bg-red-50 text-red-700">
                          inactive
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500">
                        slug: <span className="font-mono">{p.slug}</span>
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Base price: <span className="font-semibold text-gray-900">{moneyZar(price)}</span>
                      <span className="ml-2">• Variants: {p.variants?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : p.id)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50"
                  >
                    {expanded ? 'Collapse' : 'Manage'}
                  </button>

                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => addVariant(p.id)}
                    className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + Variant
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteProduct(p.id)}
                    className="text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="p-3 border-t bg-gray-50 space-y-3">
                  <div className="text-xs text-gray-600">
                    Exposure channels: if empty → **visible to all**. If set → only those channels.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.map((c) => (
                      <span
                        key={c}
                        className={[
                          'text-[11px] px-2 py-1 rounded-full border',
                          (p.channels || []).includes(c)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-800 border-gray-200',
                        ].join(' ')}
                      >
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Variants table */}
                  <div className="border rounded-lg bg-white overflow-hidden">
                    <div className="px-3 py-2 border-b bg-white flex items-center justify-between">
                      <div className="text-sm font-semibold">Variants</div>
                      <div className="text-xs text-gray-500">
                        Tip: “Adjust stock” writes inventory movements.
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-[980px] w-full text-sm">
                        <thead className="text-xs text-gray-600">
                          <tr className="border-b">
                            <th className="text-left p-3">SKU</th>
                            <th className="text-left p-3">Label</th>
                            <th className="text-left p-3">Active</th>
                            <th className="text-right p-3">Price</th>
                            <th className="text-right p-3">Sale</th>
                            <th className="text-right p-3">Stock</th>
                            <th className="text-left p-3">Backorder</th>
                            <th className="text-left p-3">Channels</th>
                            <th className="text-right p-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(p.variants || []).map((v) => (
                            <tr key={v.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-mono text-xs">{v.sku}</td>
                              <td className="p-3">{v.label}</td>
                              <td className="p-3">
                                <span className={v.active ? 'text-green-700' : 'text-gray-500'}>
                                  {v.active ? 'yes' : 'no'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-semibold">{moneyZar(v.unitAmountZar)}</td>
                              <td className="p-3 text-right">{v.saleUnitAmountZar ? moneyZar(v.saleUnitAmountZar) : '—'}</td>
                              <td className="p-3 text-right">
                                {v.stockQty == null ? (
                                  <span className="text-gray-500">untracked</span>
                                ) : (
                                  <span className={v.stockQty > 0 ? 'text-gray-900' : 'text-red-700'}>
                                    {v.stockQty}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {(v.allowBackorder ?? p.allowBackorder) ? (
                                  <span className="text-green-700">on</span>
                                ) : (
                                  <span className="text-gray-500">off</span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1">
                                  {(v.channels || []).length ? (
                                    (v.channels || []).map((c) => (
                                      <span
                                        key={c}
                                        className="text-[10px] px-2 py-1 rounded-full border border-gray-200 bg-gray-50"
                                      >
                                        {c}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-gray-500">inherits product</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => adjustStock(v.id, v.stockQty ?? null)}
                                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50"
                                >
                                  Adjust stock
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteVariant(v.id)}
                                  className="ml-2 text-xs px-3 py-1.5 rounded-full border border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!p.variants || p.variants.length === 0) && (
                            <tr>
                              <td className="p-3 text-sm text-gray-500" colSpan={9}>
                                No variants yet. Add one (sizes / colors / editions).
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Worldclass rule: keep “stockQty tracked” for physical items. If you set stockQty to null, it becomes “untracked” and stock checks won’t block checkout.
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!busy && filtered.length === 0 && (
          <div className="text-sm text-gray-500">No products match your search.</div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-end md:items-center justify-center p-3 z-50">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-sm">Edit product</div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="p-4 grid gap-4 lg:grid-cols-2">
              {/* Left: product */}
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Name</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Slug</label>
                  <input
                    value={editing.slug}
                    onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Description</label>
                  <textarea
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-[90px]"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Type</label>
                  <select
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="merch">merch</option>
                    <option value="duecare">duecare</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Tags (comma separated)</label>
                  <input
                    value={(editing.tags || []).join(', ')}
                    onChange={(e) =>
                      setEditing({ ...editing, tags: uniq(e.target.value.split(',').map((x) => x.trim())) })
                    }
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Images (one URL per line)</label>
                  <textarea
                    value={(editing.images || []).join('\n')}
                    onChange={(e) => setEditing({ ...editing, images: uniq(e.target.value.split('\n')) })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 min-h-[110px] font-mono"
                  />
                  <div className="text-[11px] text-gray-500">
                    Use shared paths like <span className="font-mono">/images/shop/merch/hoodie/front.png</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Fallback image</label>
                  <input
                    value={editing.fallbackImage || ''}
                    onChange={(e) => setEditing({ ...editing, fallbackImage: e.target.value })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing.active}
                      onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    />
                    active
                  </label>

                  <label className="text-xs flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editing.allowBackorder}
                      onChange={(e) => setEditing({ ...editing, allowBackorder: e.target.checked })}
                    />
                    allowBackorder (default)
                  </label>
                </div>
              </div>

              {/* Right: pricing + channels + variants quick edit */}
              <div className="space-y-3">
                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Base price (ZAR)</label>
                  <input
                    type="number"
                    value={editing.unitAmountZar}
                    onChange={(e) => setEditing({ ...editing, unitAmountZar: Number(e.target.value || 0) })}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Sale price (ZAR, optional)</label>
                  <input
                    type="number"
                    value={editing.saleAmountZar ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        saleAmountZar: e.target.value === '' ? null : Number(e.target.value || 0),
                      })
                    }
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-xs text-gray-600">Max qty per order</label>
                  <input
                    type="number"
                    value={editing.maxQtyPerOrder ?? ''}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        maxQtyPerOrder: e.target.value === '' ? null : Number(e.target.value || 0),
                      })
                    }
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-sm font-semibold mb-2">Exposure channels</div>
                  <div className="text-xs text-gray-600 mb-2">
                    If you select none → product visible to all apps. If you select some → only those apps.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {ALL_CHANNELS.map((c) => {
                      const on = (editing.channels || []).includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const next = on
                              ? (editing.channels || []).filter((x) => x !== c)
                              : [...(editing.channels || []), c];
                            setEditing({ ...editing, channels: next });
                          }}
                          className={[
                            'text-xs px-3 py-1.5 rounded-full border',
                            on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-sm font-semibold mb-2">Variants (quick edit)</div>

                  <div className="grid gap-2">
                    {(editing.variants || []).map((v, idx) => (
                      <div key={v.id} className="border rounded-lg p-2 bg-gray-50">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-mono">{v.sku}</div>
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!v.active}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, active: e.target.checked };
                                setEditing({ ...editing, variants: next });
                              }}
                            />
                            active
                          </label>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[11px] text-gray-600">Label</label>
                            <input
                              value={v.label}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, label: e.target.value };
                                setEditing({ ...editing, variants: next });
                              }}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-600">Unit price (ZAR)</label>
                            <input
                              type="number"
                              value={v.unitAmountZar}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, unitAmountZar: Number(e.target.value || 0) };
                                setEditing({ ...editing, variants: next });
                              }}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-600">Sale (ZAR)</label>
                            <input
                              type="number"
                              value={v.saleUnitAmountZar ?? ''}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, saleUnitAmountZar: e.target.value === '' ? null : Number(e.target.value || 0) };
                                setEditing({ ...editing, variants: next });
                              }}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-gray-600">Image URL</label>
                            <input
                              value={v.imageUrl || ''}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, imageUrl: e.target.value };
                                setEditing({ ...editing, variants: next });
                              }}
                              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 mt-2">
                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!v.inStock}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, inStock: e.target.checked };
                                setEditing({ ...editing, variants: next });
                              }}
                            />
                            inStock
                          </label>

                          <label className="text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!(v.allowBackorder ?? false)}
                              onChange={(e) => {
                                const next = [...editing.variants];
                                next[idx] = { ...v, allowBackorder: e.target.checked };
                                setEditing({ ...editing, variants: next });
                              }}
                            />
                            allowBackorder (override)
                          </label>
                        </div>

                        <div className="mt-2">
                          <div className="text-[11px] text-gray-600 mb-1">Variant channels (empty → inherits product)</div>
                          <div className="flex flex-wrap gap-2">
                            {ALL_CHANNELS.map((c) => {
                              const on = (v.channels || []).includes(c);
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    const nextV = { ...v };
                                    nextV.channels = on
                                      ? (v.channels || []).filter((x) => x !== c)
                                      : [...(v.channels || []), c];
                                    const next = [...editing.variants];
                                    next[idx] = nextV;
                                    setEditing({ ...editing, variants: next });
                                  }}
                                  className={[
                                    'text-[11px] px-2 py-1 rounded-full border',
                                    on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50',
                                  ].join(' ')}
                                >
                                  {c}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!editing.variants || editing.variants.length === 0) && (
                      <div className="text-sm text-gray-500">
                        No variants. Close this modal and click “+ Variant”.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveProduct(editing)}
                    className="text-sm px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save changes
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  Pricing rule: storefront uses sale price if &gt; 0, else base price. Variant price overrides product base.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
