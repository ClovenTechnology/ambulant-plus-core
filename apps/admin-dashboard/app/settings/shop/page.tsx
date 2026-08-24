'use client';

import { useEffect, useMemo, useState } from 'react';
import { uploadManagedImage } from '@/lib/managed-image-upload';

type ShopChannel = 'PATIENT' | 'CLINICIAN' | 'CAREPORT' | 'MEDREACH';
type BuyerType =
  | 'PATIENT'
  | 'CLINICIAN'
  | 'PHARMACY'
  | 'DELIVERY_RIDER'
  | 'LABORATORY'
  | 'PHLEBOTOMIST';

type Variant = {
  id?: string;
  productId?: string;
  sku: string;
  label: string;
  active: boolean;
  unitAmountZar: number;
  saleUnitAmountZar: number | null;
  imageUrl?: string | null;
  inStock: boolean;
  stockQty: number | null;
  allowBackorder: boolean | null;
  channels: ShopChannel[];
  buyerTypes: BuyerType[];
  inheritsProductPublication?: boolean;
};

type Product = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  tags: string[];
  images: string[];
  fallbackImage?: string | null;
  active: boolean;
  unitAmountZar: number | null;
  saleAmountZar: number | null;
  allowBackorder: boolean;
  maxQtyPerOrder: number;
  channels: ShopChannel[];
  buyerTypes: BuyerType[];
  published?: boolean;
  variants: Variant[];
};

const CHANNELS: ShopChannel[] = ['PATIENT', 'CLINICIAN', 'CAREPORT', 'MEDREACH'];
const BUYER_TYPES: BuyerType[] = [
  'PATIENT',
  'CLINICIAN',
  'PHARMACY',
  'DELIVERY_RIDER',
  'LABORATORY',
  'PHLEBOTOMIST',
];

const BUYERS_BY_CHANNEL: Record<ShopChannel, BuyerType[]> = {
  PATIENT: ['PATIENT'],
  CLINICIAN: ['CLINICIAN'],
  CAREPORT: ['PHARMACY', 'DELIVERY_RIDER'],
  MEDREACH: ['LABORATORY', 'PHLEBOTOMIST'],
};

const blankProduct = (): Product => ({
  slug: '',
  name: '',
  description: '',
  type: 'merch',
  tags: [],
  images: [],
  fallbackImage: null,
  active: false,
  unitAmountZar: null,
  saleAmountZar: null,
  allowBackorder: false,
  maxQtyPerOrder: 99,
  channels: [],
  buyerTypes: [],
  variants: [],
});

function blankVariant(productId: string): Variant {
  return {
    productId,
    sku: '',
    label: '',
    active: true,
    unitAmountZar: 0,
    saleUnitAmountZar: null,
    imageUrl: null,
    inStock: true,
    stockQty: 0,
    allowBackorder: null,
    channels: [],
    buyerTypes: [],
  };
}

function money(value: number | null | undefined) {
  return `R${Number(value || 0).toLocaleString('en-ZA')}`;
}

function asCsv(value: string[]) {
  return value.join(', ');
}

function fromCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toggle<T extends string>(items: T[], value: T) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function publicationWarnings(product: Pick<Product, 'active' | 'channels' | 'buyerTypes'>) {
  if (!product.active) return [];
  const warnings: string[] = [];
  if (!product.channels.length) warnings.push('Choose at least one channel before publishing.');
  for (const channel of product.channels) {
    if (!product.buyerTypes.some((buyer) => BUYERS_BY_CHANNEL[channel].includes(buyer))) {
      warnings.push(`${channel} needs at least one matching buyer type.`);
    }
  }
  return warnings;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

export default function CommerceStudioPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Product>(blankProduct());
  const [variantDraft, setVariantDraft] = useState<Variant | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [
        item.name,
        item.slug,
        item.description,
        item.type,
        ...item.tags,
        ...item.variants.flatMap((variant) => [variant.sku, variant.label]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [items, query]);

  async function load(preferredId?: string | null) {
    setError('');
    const response = await fetch('/api/settings/shop?includeInactive=1', {
      cache: 'no-store',
    });
    const json = await readJson(response);
    if (!response.ok || !json?.ok) {
      throw new Error(json?.error || 'Unable to load Commerce Studio.');
    }
    const next = (json.items || []) as Product[];
    setItems(next);
    const id =
      preferredId && next.some((item) => item.id === preferredId)
        ? preferredId
        : selectedId && next.some((item) => item.id === selectedId)
          ? selectedId
          : next[0]?.id || null;
    setSelectedId(id);
    if (id) {
      const product = next.find((item) => item.id === id);
      if (product) setDraft({ ...product });
    } else {
      setDraft(blankProduct());
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected]);

  async function mutate(method: 'POST' | 'PATCH' | 'DELETE', payload: any) {
    const response = await fetch('/api/settings/shop', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await readJson(response);
    if (!response.ok || !json?.ok) {
      const details = Array.isArray(json?.details) ? ` ${json.details.join(' ')}` : '';
      throw new Error((json?.error || 'Commerce operation failed.') + details);
    }
    return json;
  }

  function newProduct() {
    setSelectedId(null);
    setDraft(blankProduct());
    setVariantDraft(null);
    setMessage('');
    setError('');
  }

  function chooseProduct(product: Product) {
    setSelectedId(product.id || null);
    setDraft({ ...product });
    setVariantDraft(null);
    setMessage('');
    setError('');
  }

  async function saveProduct(publish?: boolean) {
    const nextDraft = publish === undefined ? draft : { ...draft, active: publish };
    const warnings = publicationWarnings(nextDraft);
    if (warnings.length) {
      setError(warnings.join(' '));
      return;
    }
    if (!nextDraft.name.trim()) {
      setError('Product name is required.');
      return;
    }

    setBusy('product');
    setError('');
    setMessage('');
    try {
      const payload = {
        kind: 'product',
        slug: nextDraft.slug,
        name: nextDraft.name,
        description: nextDraft.description,
        type: nextDraft.type,
        tags: nextDraft.tags,
        images: nextDraft.images,
        fallbackImage: nextDraft.fallbackImage,
        active: nextDraft.active,
        unitAmountZar: nextDraft.unitAmountZar,
        saleAmountZar: nextDraft.saleAmountZar,
        allowBackorder: nextDraft.allowBackorder,
        maxQtyPerOrder: nextDraft.maxQtyPerOrder,
        channels: nextDraft.channels,
        buyerTypes: nextDraft.buyerTypes,
      };
      const json = nextDraft.id
        ? await mutate('PATCH', { ...payload, id: nextDraft.id })
        : await mutate('POST', payload);
      const id = nextDraft.id || json.product?.id;
      setMessage(nextDraft.active ? 'Product published.' : 'Draft saved.');
      await load(id);
    } catch (err: any) {
      setError(err.message || 'Unable to save product.');
    } finally {
      setBusy('');
    }
  }

  async function uploadProductImage(file: File) {
    if (!draft.id) {
      setError('Save the product draft before uploading media.');
      return;
    }
    setBusy('product-image');
    setError('');
    try {
      await uploadManagedImage({
        file,
        presignUrl: '/api/settings/shop/media/presign',
        confirmUrl: '/api/settings/shop/media/confirm',
        confirmBody: { targetKind: 'product', targetId: draft.id },
      });
      setMessage('Product image uploaded.');
      await load(draft.id);
    } catch (err: any) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setBusy('');
    }
  }

  function applyChannel(channel: ShopChannel) {
    const channels = toggle(draft.channels, channel);
    let buyerTypes = [...draft.buyerTypes];
    if (channels.includes(channel)) {
      const defaults = BUYERS_BY_CHANNEL[channel];
      if (defaults.length === 1 && !buyerTypes.includes(defaults[0])) {
        buyerTypes.push(defaults[0]);
      }
    } else {
      const stillNeeded = new Set(channels.flatMap((value) => BUYERS_BY_CHANNEL[value]));
      buyerTypes = buyerTypes.filter((buyer) => stillNeeded.has(buyer));
    }
    setDraft((current) => ({ ...current, channels, buyerTypes }));
  }

  function startVariant(variant?: Variant) {
    if (!draft.id) return;
    setVariantDraft(variant ? { ...variant } : blankVariant(draft.id));
  }

  async function saveVariant() {
    if (!variantDraft || !draft.id) return;
    if (!variantDraft.sku.trim() || !variantDraft.label.trim()) {
      setError('Variant SKU and label are required.');
      return;
    }

    setBusy('variant');
    setError('');
    try {
      const payload = {
        kind: 'variant',
        productId: draft.id,
        sku: variantDraft.sku,
        label: variantDraft.label,
        active: variantDraft.active,
        unitAmountZar: variantDraft.unitAmountZar,
        saleUnitAmountZar: variantDraft.saleUnitAmountZar,
        imageUrl: variantDraft.imageUrl,
        inStock: variantDraft.inStock,
        stockQty: variantDraft.stockQty,
        allowBackorder: variantDraft.allowBackorder,
        channels: variantDraft.channels,
        buyerTypes: variantDraft.buyerTypes,
      };
      if (variantDraft.id) {
        await mutate('PATCH', { ...payload, id: variantDraft.id });
      } else {
        await mutate('POST', payload);
      }
      setVariantDraft(null);
      setMessage('SKU saved.');
      await load(draft.id);
    } catch (err: any) {
      setError(err.message || 'Unable to save SKU.');
    } finally {
      setBusy('');
    }
  }

  async function uploadVariantImage(file: File) {
    if (!variantDraft?.id) {
      setError('Save the SKU before uploading its image.');
      return;
    }
    setBusy('variant-image');
    setError('');
    try {
      await uploadManagedImage({
        file,
        presignUrl: '/api/settings/shop/media/presign',
        confirmUrl: '/api/settings/shop/media/confirm',
        confirmBody: {
          targetKind: 'variant',
          targetId: variantDraft.id,
        },
      });
      setMessage('SKU image uploaded.');
      await load(draft.id);
      setVariantDraft(null);
    } catch (err: any) {
      setError(err.message || 'Image upload failed.');
    } finally {
      setBusy('');
    }
  }

  async function adjustStock(variant: Variant, delta: number) {
    if (!variant.id || !delta) return;
    setBusy(`stock:${variant.id}`);
    setError('');
    try {
      await mutate('PATCH', {
        kind: 'variant_stock_adjust',
        variantId: variant.id,
        mode: 'delta',
        delta,
        reason: delta > 0 ? 'restock' : 'manual_reduction',
        note: 'Commerce Studio stock adjustment',
      });
      await load(draft.id);
    } catch (err: any) {
      setError(err.message || 'Stock adjustment failed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="space-y-5 p-6">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Ambulant+ owned commerce authority
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">
            Commerce Studio
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            One source of truth for Ambulant+-owned products, SKUs, managed media,
            platform stock, pricing, channel publication and eligible buyer types.
            Pharmacy-owned inventory and MedReach lab/test catalogues remain separate.
          </p>
        </div>
        <button
          type="button"
          onClick={newProduct}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
        >
          New product
        </button>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products, tags or SKU"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="max-h-[75vh] overflow-auto">
            {filtered.length ? (
              filtered.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => chooseProduct(product)}
                  className={`w-full border-b px-4 py-3 text-left hover:bg-slate-50 ${
                    product.id === selectedId ? 'bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{product.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        product.published
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {product.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{product.slug}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {product.channels.map((channel) => (
                      <span
                        key={channel}
                        className="rounded border px-1.5 py-0.5 text-[10px] text-slate-600"
                      >
                        {channel}
                      </span>
                    ))}
                  </div>
                </button>
              ))
            ) : (
              <div className="p-5 text-sm text-slate-500">
                No canonical products yet. Create the first Ambulant+ product here.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {draft.id ? 'Product authority' : 'New product'}
                </h2>
                <p className="text-xs text-slate-500">
                  Zero channel rows means unpublished. There is no implicit “all channels” mode.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy === 'product'}
                  onClick={() => saveProduct(false)}
                  className="rounded-lg border px-3 py-2 text-sm font-medium"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy === 'product'}
                  onClick={() => saveProduct(true)}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
                >
                  Publish
                </button>
                {draft.id && draft.active ? (
                  <button
                    type="button"
                    disabled={busy === 'product'}
                    onClick={() => saveProduct(false)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                  >
                    Unpublish
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Name
                <input
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Slug
                <input
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, slug: event.target.value }))
                  }
                  placeholder="auto-generated from name if blank"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="md:col-span-2 text-sm text-slate-700">
                Description
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1 min-h-24 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Product type
                <input
                  value={draft.type}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, type: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Tags
                <input
                  value={asCsv(draft.tags)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tags: fromCsv(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Base price (ZAR)
                <input
                  type="number"
                  min={0}
                  value={draft.unitAmountZar ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      unitAmountZar:
                        event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Sale price (ZAR)
                <input
                  type="number"
                  min={0}
                  value={draft.saleAmountZar ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      saleAmountZar:
                        event.target.value === '' ? null : Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-slate-700">
                Maximum quantity per order
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.maxQtyPerOrder}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxQtyPerOrder: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.allowBackorder}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allowBackorder: event.target.checked,
                    }))
                  }
                />
                Allow backorder
              </label>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Publication channels</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CHANNELS.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      onClick={() => applyChannel(channel)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        draft.channels.includes(channel)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Eligible buyer types</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BUYER_TYPES.map((buyer) => (
                    <button
                      type="button"
                      key={buyer}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          buyerTypes: toggle(current.buyerTypes, buyer),
                        }))
                      }
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                        draft.buyerTypes.includes(buyer)
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      {buyer}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-dashed p-4">
              <div className="text-sm font-semibold text-slate-900">Managed product media</div>
              <p className="mt-1 text-xs text-slate-500">
                Upload JPEG, PNG or WebP. Media is stored in managed object storage; base64 is not persisted.
              </p>
              <input
                className="mt-3 text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={!draft.id || busy === 'product-image'}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadProductImage(file);
                  event.currentTarget.value = '';
                }}
              />
              {draft.images.length ? (
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  {draft.images.map((image) => (
                    <div key={image} className="truncate">{image}</div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {draft.id ? (
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">SKUs / variants</h2>
                  <p className="text-xs text-slate-500">
                    Variant publication inherits the product unless an explicit override is supplied.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startVariant()}
                  className="rounded-lg border px-3 py-2 text-sm font-medium"
                >
                  New SKU
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4">Variant</th>
                      <th className="py-2 pr-4">Price</th>
                      <th className="py-2 pr-4">Stock</th>
                      <th className="py-2 pr-4">Publication</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.variants.map((variant) => (
                      <tr key={variant.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-mono text-xs">{variant.sku}</td>
                        <td className="py-3 pr-4">{variant.label}</td>
                        <td className="py-3 pr-4">{money(variant.saleUnitAmountZar || variant.unitAmountZar)}</td>
                        <td className="py-3 pr-4">
                          {variant.stockQty === null ? 'Untracked' : variant.stockQty}
                        </td>
                        <td className="py-3 pr-4 text-xs text-slate-600">
                          {variant.inheritsProductPublication
                            ? 'Inherits product'
                            : `${variant.channels.join(', ')} · ${variant.buyerTypes.join(', ')}`}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startVariant(variant)}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              Edit
                            </button>
                            {variant.stockQty !== null ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busy === `stock:${variant.id}`}
                                  onClick={() => adjustStock(variant, 1)}
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  +1
                                </button>
                                <button
                                  type="button"
                                  disabled={busy === `stock:${variant.id}`}
                                  onClick={() => adjustStock(variant, -1)}
                                  className="rounded border px-2 py-1 text-xs"
                                >
                                  −1
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!draft.variants.length ? (
                      <tr>
                        <td colSpan={6} className="py-5 text-sm text-slate-500">
                          No SKUs yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {variantDraft ? (
            <div className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {variantDraft.id ? 'Edit SKU' : 'New SKU'}
                </h2>
                <button
                  type="button"
                  onClick={() => setVariantDraft(null)}
                  className="text-sm text-slate-500"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm">
                  SKU
                  <input
                    value={variantDraft.sku}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current ? { ...current, sku: event.target.value } : current,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Label
                  <input
                    value={variantDraft.label}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current ? { ...current, label: event.target.value } : current,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Price (ZAR)
                  <input
                    type="number"
                    min={0}
                    value={variantDraft.unitAmountZar}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current
                          ? { ...current, unitAmountZar: Number(event.target.value) }
                          : current,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Sale price (ZAR)
                  <input
                    type="number"
                    min={0}
                    value={variantDraft.saleUnitAmountZar ?? ''}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current
                          ? {
                              ...current,
                              saleUnitAmountZar:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
                            }
                          : current,
                      )
                    }
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  Initial/tracked stock
                  <input
                    type="number"
                    min={0}
                    value={variantDraft.stockQty ?? ''}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current
                          ? {
                              ...current,
                              stockQty:
                                event.target.value === ''
                                  ? null
                                  : Number(event.target.value),
                            }
                          : current,
                      )
                    }
                    disabled={Boolean(variantDraft.id)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-slate-50"
                  />
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input
                    type="checkbox"
                    checked={variantDraft.active}
                    onChange={(event) =>
                      setVariantDraft((current) =>
                        current ? { ...current, active: event.target.checked } : current,
                      )
                    }
                  />
                  Active
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="text-sm font-semibold">Optional channel override</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => (
                      <button
                        type="button"
                        key={channel}
                        onClick={() =>
                          setVariantDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  channels: toggle(current.channels, channel),
                                }
                              : current,
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          variantDraft.channels.includes(channel)
                            ? 'bg-slate-900 text-white'
                            : ''
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">Optional buyer override</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {BUYER_TYPES.map((buyer) => (
                      <button
                        type="button"
                        key={buyer}
                        onClick={() =>
                          setVariantDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  buyerTypes: toggle(current.buyerTypes, buyer),
                                }
                              : current,
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          variantDraft.buyerTypes.includes(buyer)
                            ? 'bg-slate-900 text-white'
                            : ''
                        }`}
                      >
                        {buyer}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Leave both override groups empty to inherit the product authority.
                  </p>
                </div>
              </div>

              {variantDraft.id ? (
                <div className="mt-4 rounded-xl border border-dashed p-4">
                  <div className="text-sm font-semibold">Managed SKU image</div>
                  <input
                    className="mt-2 text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy === 'variant-image'}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadVariantImage(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </div>
              ) : null}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={busy === 'variant'}
                  onClick={saveVariant}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save SKU
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
