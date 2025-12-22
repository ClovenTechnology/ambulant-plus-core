// apps/admin-dashboard/app/settings/shop/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type ShopChannel = 'CLINICIAN' | 'PATIENT' | 'MEDREACH' | 'CAREPORT';

const CHANNELS: ShopChannel[] = ['CLINICIAN', 'PATIENT', 'MEDREACH', 'CAREPORT'];

type ProductChannelRow = { channel: ShopChannel };
type VariantChannelRow = { channel: ShopChannel };

type ShopVariant = {
  id: string;
  productId: string;
  sku: string;
  label: string;
  active: boolean;
  unitAmountZar: number;
  saleUnitAmountZar?: number | null;
  imageUrl?: string | null;
  inStock: boolean;
  stockQty?: number | null;
  allowBackorder?: boolean | null;
  channels?: VariantChannelRow[];
};

type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  type: string;
  tags: string[];
  images: string[];
  fallbackImage?: string | null;
  active: boolean;
  unitAmountZar?: number | null;
  saleAmountZar?: number | null;
  allowBackorder: boolean;
  maxQtyPerOrder: number;
  channels?: ProductChannelRow[];
  variants: ShopVariant[];
};

function formatZar(n: number) {
  return `R ${Math.round(n).toString()}`;
}

function channelsToSet(rows?: { channel: string }[]) {
  return new Set((rows || []).map((r) => r.channel));
}

export default function AdminShopSettingsPage() {
  const [items, setItems] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId]
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((p) => {
      const hay = [
        p.slug,
        p.name,
        p.description || '',
        p.type,
        (p.tags || []).join(' '),
        (p.variants || []).map((v) => `${v.sku} ${v.label}`).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(s);
    });
  }, [items, q]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/shop', { cache: 'no-store' });
      const js = await res.json();
      if (!res.ok) throw new Error(js?.error || 'Failed to load shop settings');
      setItems(js.items || []);
      setSelectedId((prev) => prev || (js.items?.[0]?.id ?? null));
    } catch (e: any) {
      setError(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function op(payload: any) {
    const res = await fetch('/api/settings/shop', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const js = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(js?.error || 'Operation failed');
    return js;
  }

  // ---------- Product editing ----------
  const [pDraft, setPDraft] = useState<Partial<ShopProduct>>({});
  useEffect(() => {
    if (!selected) return;
    setPDraft({
      id: selected.id,
      slug: selected.slug,
      name: selected.name,
      description: selected.description || '',
      type: selected.type,
      tags: selected.tags || [],
      images: selected.images || [],
      fallbackImage: selected.fallbackImage || '',
      active: selected.active,
      unitAmountZar: selected.unitAmountZar ?? null,
      saleAmountZar: selected.saleAmountZar ?? null,
      allowBackorder: selected.allowBackorder,
      maxQtyPerOrder: selected.maxQtyPerOrder,
      channels: selected.channels || [],
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pChannelSet = useMemo(() => channelsToSet(pDraft.channels as any), [pDraft.channels]);

  function toggleProductChannel(ch: ShopChannel) {
    const set = new Set(pChannelSet);
    if (set.has(ch)) set.delete(ch);
    else set.add(ch);

    // IMPORTANT: empty channels means "ALL"
    setPDraft((d) => ({
      ...d,
      channels: Array.from(set).map((x) => ({ channel: x as ShopChannel })) as any,
    }));
  }

  async function saveProduct() {
    if (!pDraft.slug || !pDraft.name) {
      setError('Product slug and name are required');
      return;
    }
    try {
      setBusy('saveProduct');
      setError(null);

      await op({
        op: 'upsertProduct',
        product: {
          ...pDraft,
          tags:
            typeof pDraft.tags === 'string'
              ? String(pDraft.tags).split(',').map((x) => x.trim()).filter(Boolean)
              : pDraft.tags,
          images:
            typeof pDraft.images === 'string'
              ? String(pDraft.images).split(',').map((x) => x.trim()).filter(Boolean)
              : pDraft.images,
          channels: (pDraft.channels as any)?.map((x: any) => x.channel) ?? [],
        },
      });

      await load();
    } catch (e: any) {
      setError(e?.message || 'Save product failed');
    } finally {
      setBusy(null);
    }
  }

  async function setActive(kind: 'product' | 'variant', id: string, active: boolean) {
    try {
      setBusy(`${kind}:${id}`);
      setError(null);
      await op({ op: 'setActive', kind, id, active });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  // ---------- Variant editing ----------
  const [vDraft, setVDraft] = useState<Partial<ShopVariant> | null>(null);

  function startNewVariant() {
    if (!selected) return;
    setVDraft({
      productId: selected.id,
      sku: '',
      label: '',
      active: true,
      unitAmountZar: 0,
      saleUnitAmountZar: null,
      inStock: true,
      stockQty: 0,
      allowBackorder: null,
      channels: [],
    });
  }

  function editVariant(v: ShopVariant) {
    setVDraft({
      ...v,
      channels: v.channels || [],
      stockQty: v.stockQty ?? null,
      saleUnitAmountZar: v.saleUnitAmountZar ?? null,
      allowBackorder: v.allowBackorder ?? null,
    });
  }

  const vChannelSet = useMemo(() => channelsToSet((vDraft?.channels as any) || []), [vDraft?.channels]);

  function toggleVariantChannel(ch: ShopChannel) {
    if (!vDraft) return;
    const set = new Set(vChannelSet);
    if (set.has(ch)) set.delete(ch);
    else set.add(ch);
    setVDraft((d) =>
      d
        ? ({
            ...d,
            channels: Array.from(set).map((x) => ({ channel: x as ShopChannel })) as any,
          } as any)
        : d
    );
  }

  async function saveVariant() {
    if (!vDraft || !selected) return;
    if (!vDraft.sku || !vDraft.label) {
      setError('Variant SKU and label are required');
      return;
    }
    try {
      setBusy('saveVariant');
      setError(null);

      await op({
        op: 'upsertVariant',
        variant: {
          ...vDraft,
          productId: selected.id,
          unitAmountZar: Number(vDraft.unitAmountZar || 0),
          saleUnitAmountZar:
            vDraft.saleUnitAmountZar === null || vDraft.saleUnitAmountZar === undefined || vDraft.saleUnitAmountZar === ('' as any)
              ? null
              : Number(vDraft.saleUnitAmountZar),
          stockQty:
            vDraft.stockQty === null || vDraft.stockQty === undefined || vDraft.stockQty === ('' as any)
              ? null
              : Number(vDraft.stockQty),
          channels: (vDraft.channels as any)?.map((x: any) => x.channel) ?? [],
        },
      });

      setVDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Save variant failed');
    } finally {
      setBusy(null);
    }
  }

  // ---------- Stock adjust ----------
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [stockReason, setStockReason] = useState<string>('Restock');
  const [stockVariantId, setStockVariantId] = useState<string>('');

  async function adjustStock() {
    if (!stockVariantId) {
      setError('Select a variant to adjust');
      return;
    }
    if (!Number.isFinite(stockDelta) || stockDelta === 0) {
      setError('Stock delta must be a non-zero number');
      return;
    }
    try {
      setBusy('adjustStock');
      setError(null);
      await op({
        op: 'adjustStock',
        variantId: stockVariantId,
        delta: Math.floor(stockDelta),
        reason: stockReason,
      });
      setStockDelta(0);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Adjust stock failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shop Inventory</h1>
          <p className="text-sm text-gray-500">
            Products, SKUs, channel visibility, and stock control — one source of truth.
          </p>
        </div>

        <div className="w-full sm:w-96">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, tags, SKUs..."
            className="w-full border rounded-full px-4 py-2 text-sm bg-white"
          />
        </div>
      </header>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Product list */}
        <div className="lg:col-span-4 border rounded-xl bg-white">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="text-sm font-medium">Products</div>
            <div className="text-xs text-gray-500">{filtered.length}</div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading…</div>
            ) : filtered.length ? (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={[
                    'w-full text-left px-4 py-3 border-b hover:bg-gray-50',
                    selectedId === p.id ? 'bg-gray-50' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{p.name}</div>
                    <span
                      className={[
                        'text-[11px] px-2 py-0.5 rounded-full border',
                        p.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200',
                      ].join(' ')}
                    >
                      {p.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{p.slug}</div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {p.description || '—'}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-sm text-gray-500">No products found.</div>
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="lg:col-span-8 space-y-4">
          {!selected ? (
            <div className="border rounded-xl bg-white p-6 text-sm text-gray-600">
              Select a product to edit.
            </div>
          ) : (
            <>
              {/* Product editor */}
              <div className="border rounded-xl bg-white">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Product Settings</div>
                    <div className="text-xs text-gray-500">
                      Visibility: select channels (empty means ALL).
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActive('product', selected.id, !selected.active)}
                      disabled={busy === `product:${selected.id}`}
                      className="text-xs px-3 py-1.5 rounded-full border bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {selected.active ? 'Deactivate' : 'Activate'}
                    </button>

                    <button
                      onClick={saveProduct}
                      disabled={busy === 'saveProduct'}
                      className="text-xs px-4 py-1.5 rounded-full bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                    >
                      {busy === 'saveProduct' ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Slug</label>
                    <input
                      value={String(pDraft.slug || '')}
                      onChange={(e) => setPDraft((d) => ({ ...d, slug: e.target.value }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Name</label>
                    <input
                      value={String(pDraft.name || '')}
                      onChange={(e) => setPDraft((d) => ({ ...d, name: e.target.value }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Description</label>
                    <textarea
                      value={String(pDraft.description || '')}
                      onChange={(e) => setPDraft((d) => ({ ...d, description: e.target.value }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Tags (comma separated)</label>
                    <input
                      value={Array.isArray(pDraft.tags) ? pDraft.tags.join(', ') : String(pDraft.tags || '')}
                      onChange={(e) => setPDraft((d) => ({ ...d, tags: e.target.value as any }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Images (comma separated URLs)</label>
                    <input
                      value={Array.isArray(pDraft.images) ? pDraft.images.join(', ') : String(pDraft.images || '')}
                      onChange={(e) => setPDraft((d) => ({ ...d, images: e.target.value as any }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Allow backorder</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(pDraft.allowBackorder)}
                        onChange={(e) => setPDraft((d) => ({ ...d, allowBackorder: e.target.checked }))}
                      />
                      <span className="text-sm text-gray-700">Enabled</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Max qty/order</label>
                    <input
                      type="number"
                      value={Number(pDraft.maxQtyPerOrder || 99)}
                      onChange={(e) => setPDraft((d) => ({ ...d, maxQtyPerOrder: Number(e.target.value) }))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                      min={1}
                      max={99}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Channel visibility (empty = ALL)</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CHANNELS.map((c) => {
                        const on = pChannelSet.has(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleProductChannel(c)}
                            className={[
                              'text-xs px-3 py-1.5 rounded-full border',
                              on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200',
                            ].join(' ')}
                          >
                            {c}
                          </button>
                        );
                      })}
                      <span className="text-xs text-gray-500 self-center">
                        Tip: leave ALL off to expose everywhere.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Variants list + editor */}
              <div className="border rounded-xl bg-white">
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Variants (SKUs)</div>
                    <div className="text-xs text-gray-500">
                      Decide visibility per SKU if needed (inherit from product if empty).
                    </div>
                  </div>

                  <button
                    onClick={startNewVariant}
                    className="text-xs px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    + New SKU
                  </button>
                </div>

                <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {selected.variants.length ? (
                      selected.variants.map((v) => (
                        <div key={v.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{v.label}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600">{formatZar(v.unitAmountZar)}</span>
                              <button
                                onClick={() => setActive('variant', v.id, !v.active)}
                                disabled={busy === `variant:${v.id}`}
                                className="text-[11px] px-2 py-1 rounded-full border bg-white hover:bg-gray-50 disabled:opacity-50"
                              >
                                {v.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => editVariant(v)}
                                className="text-[11px] px-2 py-1 rounded-full border bg-white hover:bg-gray-50"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">SKU: {v.sku}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            Stock: {v.stockQty === null || v.stockQty === undefined ? 'Untracked' : v.stockQty}
                            {v.allowBackorder ? ' • Backorder OK' : ''}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No variants yet.</div>
                    )}
                  </div>

                  <div className="border rounded-lg p-3">
                    <div className="text-sm font-medium">Variant Editor</div>
                    <div className="text-xs text-gray-500 mb-3">Create/update SKU, price and stock.</div>

                    {!vDraft ? (
                      <div className="text-sm text-gray-500">Select a variant or create a new SKU.</div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-gray-600">SKU</label>
                          <input
                            value={String(vDraft.sku || '')}
                            onChange={(e) => setVDraft((d) => (d ? { ...d, sku: e.target.value } : d))}
                            className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-gray-600">Label</label>
                          <input
                            value={String(vDraft.label || '')}
                            onChange={(e) => setVDraft((d) => (d ? { ...d, label: e.target.value } : d))}
                            className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Price (ZAR)</label>
                            <input
                              type="number"
                              value={Number(vDraft.unitAmountZar || 0)}
                              onChange={(e) => setVDraft((d) => (d ? { ...d, unitAmountZar: Number(e.target.value) } : d))}
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                              min={1}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Sale price (optional)</label>
                            <input
                              type="number"
                              value={vDraft.saleUnitAmountZar === null || vDraft.saleUnitAmountZar === undefined ? '' : Number(vDraft.saleUnitAmountZar)}
                              onChange={(e) => setVDraft((d) => (d ? { ...d, saleUnitAmountZar: e.target.value === '' ? null : Number(e.target.value) } : d))}
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                              min={0}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Stock qty (null = untracked)</label>
                            <input
                              type="number"
                              value={vDraft.stockQty === null || vDraft.stockQty === undefined ? '' : Number(vDraft.stockQty)}
                              onChange={(e) => setVDraft((d) => (d ? { ...d, stockQty: e.target.value === '' ? null : Number(e.target.value) } : d))}
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Allow backorder (null=inherits)</label>
                            <select
                              value={vDraft.allowBackorder === null || vDraft.allowBackorder === undefined ? 'inherit' : vDraft.allowBackorder ? 'true' : 'false'}
                              onChange={(e) =>
                                setVDraft((d) =>
                                  d
                                    ? {
                                        ...d,
                                        allowBackorder:
                                          e.target.value === 'inherit'
                                            ? null
                                            : e.target.value === 'true',
                                      }
                                    : d
                                )
                              }
                              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                            >
                              <option value="inherit">Inherit</option>
                              <option value="true">True</option>
                              <option value="false">False</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-600">Channel visibility (empty = inherit product)</label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {CHANNELS.map((c) => {
                              const on = vChannelSet.has(c);
                              return (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => toggleVariantChannel(c)}
                                  className={[
                                    'text-xs px-3 py-1.5 rounded-full border',
                                    on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200',
                                  ].join(' ')}
                                >
                                  {c}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={saveVariant}
                            disabled={busy === 'saveVariant'}
                            className="text-xs px-4 py-2 rounded-full bg-gray-900 text-white hover:bg-black disabled:opacity-50"
                          >
                            {busy === 'saveVariant' ? 'Saving…' : 'Save SKU'}
                          </button>

                          <button
                            onClick={() => setVDraft(null)}
                            className="text-xs px-4 py-2 rounded-full border bg-white hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock adjust */}
              <div className="border rounded-xl bg-white">
                <div className="p-4 border-b">
                  <div className="text-sm font-semibold">Quick Stock Adjust</div>
                  <div className="text-xs text-gray-500">
                    Creates an inventory movement log and updates stockQty safely.
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-600">Variant</label>
                    <select
                      value={stockVariantId}
                      onChange={(e) => setStockVariantId(e.target.value)}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Select SKU</option>
                      {selected.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sku} — {v.label} (qty: {v.stockQty === null || v.stockQty === undefined ? 'untracked' : v.stockQty})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Delta</label>
                    <input
                      type="number"
                      value={stockDelta}
                      onChange={(e) => setStockDelta(Number(e.target.value))}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-600">Reason</label>
                    <input
                      value={stockReason}
                      onChange={(e) => setStockReason(e.target.value)}
                      className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <button
                      onClick={adjustStock}
                      disabled={busy === 'adjustStock'}
                      className="text-xs px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy === 'adjustStock' ? 'Applying…' : 'Apply Stock Change'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
