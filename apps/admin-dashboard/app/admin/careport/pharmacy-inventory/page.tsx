'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Pharmacy = {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  active?: boolean | null;
  currency?: string | null;
};

type InventoryItem = {
  id: string;
  name?: string | null;
  skuCode?: string | null;
  drugCode?: string | null;
  barcode?: string | null;
  productType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  isActive?: boolean | null;
  otc?: boolean | null;
  prescriptionRequired?: boolean | null;
  marketplaceVisible?: boolean | null;
  sellableOnline?: boolean | null;
  stockOnHand?: number | null;
  reservedStock?: number | null;
  normalisationStatus?: string | null;
  reviewRequired?: boolean | null;
  reviewReason?: string | null;
  canonicalName?: string | null;
  globalProductKey?: string | null;
};

type Taxonomy = {
  version?: string;
  productTypes?: any[];
  categories?: any[];
  attributeTemplates?: Record<string, any>;
  standardOptions?: Record<string, any[]>;
  csvHeaders?: string[];
};

type FormState = {
  name: string;
  pharmacySku: string;
  priceCents: string;
  currency: string;
  productType: string;
  category: string;
  subcategory: string;
  brand: string;
  manufacturer: string;
  barcode: string;
  description: string;
  packSize: string;
  variantGroupKey: string;
  variantName: string;
  stockOnHand: string;
  lowStockThreshold: string;
  maxOrderQty: string;
  otc: boolean;
  prescriptionRequired: boolean;
  marketplaceVisible: boolean;
  sellableOnline: boolean;
  ageRestricted: boolean;
  variantAttributesJson: string;
  attributesJson: string;
};

const defaultForm: FormState = {
  name: '',
  pharmacySku: '',
  priceCents: '',
  currency: 'ZAR',
  productType: 'MEDICATION',
  category: '',
  subcategory: '',
  brand: '',
  manufacturer: '',
  barcode: '',
  description: '',
  packSize: '',
  variantGroupKey: '',
  variantName: '',
  stockOnHand: '0',
  lowStockThreshold: '',
  maxOrderQty: '',
  otc: false,
  prescriptionRequired: true,
  marketplaceVisible: false,
  sellableOnline: false,
  ageRestricted: false,
  variantAttributesJson: '{}',
  attributesJson: '{}',
};

function labelOf(option: any): string {
  if (option == null) return '';
  if (typeof option === 'string') return option;
  return String(option.label ?? option.name ?? option.title ?? option.value ?? option.key ?? option.code ?? option.id ?? '');
}

function valueOf(option: any): string {
  if (option == null) return '';
  if (typeof option === 'string') return option;
  return String(option.value ?? option.key ?? option.code ?? option.id ?? option.name ?? option.label ?? '');
}

function normaliseOptionList(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => {
      if (typeof val === 'string') return { key, label: val, value: key };
      if (val && typeof val === 'object') return { key, ...(val as Record<string, any>) };
      return { key, label: key, value: key };
    });
  }
  return [];
}

function pretty(value?: string | null) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(cents?: number | null, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format((Number(cents || 0) || 0) / 100);
}

function parseJsonObject(raw: string, label: string): Record<string, any> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(label + ' must be a JSON object.');
  }
  return parsed as Record<string, any>;
}

function categoryProductTypes(category: any): string[] {
  const values = [
    category?.productType,
    category?.type,
    category?.product_type,
    ...(Array.isArray(category?.productTypes) ? category.productTypes : []),
    ...(Array.isArray(category?.types) ? category.types : []),
  ].filter(Boolean);

  return values.map((value) => String(value));
}

function categoryMatches(category: any, productType: string) {
  const values = categoryProductTypes(category);
  if (!values.length) return true;
  return values.includes(productType);
}

function categoryAttributeKeys(category: any): string[] {
  const keys = new Set<string>();

  for (const field of [
    'attributeKeys',
    'attributeTemplateKeys',
    'variantAttributeKeys',
    'requiredAttributeKeys',
    'recommendedAttributeKeys',
    'attributes',
    'attributeTemplates',
  ]) {
    const raw = category?.[field];
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        const key = valueOf(item);
        if (key) keys.add(key);
      });
    }
  }

  return Array.from(keys);
}

function inputClass(extra = '') {
  return 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 ' + extra;
}

function checkboxClass() {
  return 'h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500';
}

function statusClass(item: InventoryItem) {
  if (item.reviewRequired) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (item.normalisationStatus === 'ADMIN_VERIFIED' || item.normalisationStatus === 'GLOBAL_CATALOGUE_MATCHED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (item.normalisationStatus === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function CarePortPharmacyInventoryTaxonomyPage() {
  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [attributeValues, setAttributeValues] = useState<Record<string, string>>({});
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const productTypeOptions = useMemo(() => normaliseOptionList(taxonomy?.productTypes), [taxonomy]);

  const categoryOptions = useMemo(() => {
    return normaliseOptionList(taxonomy?.categories).filter((category) => categoryMatches(category, form.productType));
  }, [taxonomy, form.productType]);

  const selectedCategory = useMemo(() => {
    return categoryOptions.find((category) => valueOf(category) === form.category || labelOf(category) === form.category) || null;
  }, [categoryOptions, form.category]);

  const selectedAttributeKeys = useMemo(() => categoryAttributeKeys(selectedCategory), [selectedCategory]);

  const csvHeaders = useMemo(() => {
    const headers = Array.isArray(taxonomy?.csvHeaders) && taxonomy?.csvHeaders?.length
      ? taxonomy.csvHeaders
      : [
          'pharmacySku',
          'name',
          'priceCents',
          'currency',
          'productType',
          'category',
          'subcategory',
          'otc',
          'prescriptionRequired',
          'marketplaceVisible',
          'sellableOnline',
          'stockOnHand',
          'variantAttributes',
          'attributes',
        ];

    return headers.join(',');
  }, [taxonomy]);

  async function loadBootstrap() {
    setLoading(true);
    setError('');

    try {
      const [taxonomyRes, pharmaciesRes] = await Promise.all([
        fetch('/api/admin/careport/catalogue/taxonomy', { cache: 'no-store' }),
        fetch('/api/admin/careport/pharmacies?limit=100', { cache: 'no-store' }),
      ]);

      const taxonomyPayload = await taxonomyRes.json().catch(() => null);
      const pharmaciesPayload = await pharmaciesRes.json().catch(() => null);

      if (!taxonomyRes.ok) throw new Error(taxonomyPayload?.error || 'Failed to load CarePort taxonomy');
      if (!pharmaciesRes.ok) throw new Error(pharmaciesPayload?.error || 'Failed to load CarePort pharmacies');

      setTaxonomy(taxonomyPayload || null);

      const list = Array.isArray(pharmaciesPayload?.pharmacies)
        ? pharmaciesPayload.pharmacies
        : Array.isArray(pharmaciesPayload?.items)
          ? pharmaciesPayload.items
          : Array.isArray(pharmaciesPayload)
            ? pharmaciesPayload
            : [];

      setPharmacies(list);

      if (!selectedPharmacyId && list[0]?.id) {
        setSelectedPharmacyId(list[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialise CarePort inventory taxonomy page');
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory(pharmacyId = selectedPharmacyId) {
    if (!pharmacyId) {
      setItems([]);
      return;
    }

    setError('');

    try {
      const res = await fetch('/api/admin/careport/pharmacies/me/inventory?pharmacyId=' + encodeURIComponent(pharmacyId) + '&limit=100', {
        cache: 'no-store',
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to load pharmacy inventory');

      const list = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.inventory)
          ? payload.inventory
          : Array.isArray(payload)
            ? payload
            : [];

      setItems(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacy inventory');
    }
  }

  useEffect(() => {
    loadBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPharmacyId) loadInventory(selectedPharmacyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPharmacyId]);

  useEffect(() => {
    if (!csvText) {
      setCsvText(csvHeaders + '\n');
    }
  }, [csvHeaders, csvText]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setAttribute(key: string, value: string) {
    setAttributeValues((current) => ({ ...current, [key]: value }));
  }

  async function submitSku(event: FormEvent) {
    event.preventDefault();

    if (!selectedPharmacyId) {
      setError('Select a pharmacy before creating inventory.');
      return;
    }

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (!form.pharmacySku.trim()) {
      setError('Pharmacy SKU is required.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const extraVariantAttributes = parseJsonObject(form.variantAttributesJson, 'Variant attributes');
      const extraAttributes = parseJsonObject(form.attributesJson, 'Metadata attributes');

      const variantAttributes = {
        ...Object.fromEntries(Object.entries(attributeValues).filter(([, value]) => String(value || '').trim())),
        ...extraVariantAttributes,
      };

      const body = {
        name: form.name.trim(),
        pharmacySku: form.pharmacySku.trim(),
        sku: form.pharmacySku.trim(),
        priceCents: Number(form.priceCents || 0),
        currency: form.currency.trim() || 'ZAR',
        productType: form.productType,
        category: form.category || undefined,
        subcategory: form.subcategory || undefined,
        brand: form.brand || undefined,
        manufacturer: form.manufacturer || undefined,
        barcode: form.barcode || undefined,
        description: form.description || undefined,
        packSize: form.packSize || undefined,
        variantGroupKey: form.variantGroupKey || undefined,
        variantName: form.variantName || undefined,
        variantAttributes,
        attributes: extraAttributes,
        stockOnHand: Number(form.stockOnHand || 0),
        lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
        maxOrderQty: form.maxOrderQty ? Number(form.maxOrderQty) : undefined,
        otc: form.otc,
        prescriptionRequired: form.prescriptionRequired,
        marketplaceVisible: form.marketplaceVisible,
        sellableOnline: form.sellableOnline,
        ageRestricted: form.ageRestricted,
        isActive: true,
        active: true,
      };

      const res = await fetch('/api/admin/careport/pharmacies/me/inventory?pharmacyId=' + encodeURIComponent(selectedPharmacyId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || 'Inventory save failed');
      }

      setNotice('Inventory SKU saved and sent through CarePort catalogue normalisation.');
      setForm({
        ...defaultForm,
        currency: form.currency,
        productType: form.productType,
        category: form.category,
      });
      setAttributeValues({});
      await loadInventory(selectedPharmacyId);
    } catch (err: any) {
      setError(err?.message || 'Inventory save failed');
    } finally {
      setBusy(false);
    }
  }

  async function importCsv() {
    if (!selectedPharmacyId) {
      setError('Select a pharmacy before importing inventory.');
      return;
    }

    if (!csvText.trim()) {
      setError('Paste CSV content before importing.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/admin/careport/pharmacies/me/inventory/import?pharmacyId=' + encodeURIComponent(selectedPharmacyId), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error || 'Inventory import failed');
      }

      const saved = payload?.created ?? payload?.createdCount ?? payload?.inserted ?? payload?.upserted ?? payload?.count ?? '';
      setNotice(saved ? `Inventory import completed. ${saved} row(s) processed.` : 'Inventory import completed.');
      await loadInventory(selectedPharmacyId);
    } catch (err: any) {
      setError(err?.message || 'Inventory import failed');
    } finally {
      setBusy(false);
    }
  }

  const selectedPharmacy = pharmacies.find((pharmacy) => pharmacy.id === selectedPharmacyId);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">CarePort inventory taxonomy</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Pharmacy inventory catalogue setup</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/admin/careport/catalogue"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Catalogue hub
                </a>
                <a
                  href="/admin/careport/catalogue/global-products"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Global products
                </a>
                <a
                  href="/admin/careport/catalogue/normalisation"
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Normalisation queue
                </a>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Create and import pharmacy SKUs against the CarePort taxonomy. Standard taxonomy values are shown first, custom
                attributes remain allowed, and every save flows into catalogue normalisation governance before public marketplace use.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <div className="font-semibold">Taxonomy version</div>
              <div>{taxonomy?.version || (loading ? 'Loading…' : 'Unavailable')}</div>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <form onSubmit={submitSku} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Create SKU with taxonomy</h2>
                <p className="mt-1 text-sm text-slate-600">Use this for pharmacy-managed items before admin catalogue verification.</p>
              </div>

              <button
                type="submit"
                disabled={busy || loading}
                className="rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save SKU'}
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pharmacy</span>
                <select
                  value={selectedPharmacyId}
                  onChange={(event) => setSelectedPharmacyId(event.target.value)}
                  className={inputClass()}
                >
                  <option value="">Select pharmacy</option>
                  {pharmacies.map((pharmacy) => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name || pharmacy.id}{pharmacy.city ? ` · ${pharmacy.city}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Currency</span>
                <input
                  value={form.currency}
                  onChange={(event) => updateForm('currency', event.target.value.toUpperCase())}
                  className={inputClass()}
                  placeholder={selectedPharmacy?.currency || 'ZAR'}
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className={inputClass()}
                  placeholder="e.g. Vitamin C 500mg 30 tablets"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pharmacy SKU</span>
                <input
                  value={form.pharmacySku}
                  onChange={(event) => updateForm('pharmacySku', event.target.value)}
                  className={inputClass()}
                  placeholder="Internal pharmacy SKU"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Price cents</span>
                <input
                  type="number"
                  min="0"
                  value={form.priceCents}
                  onChange={(event) => updateForm('priceCents', event.target.value)}
                  className={inputClass()}
                  placeholder="1299"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product type</span>
                <select
                  value={form.productType}
                  onChange={(event) => {
                    updateForm('productType', event.target.value);
                    updateForm('category', '');
                    updateForm('subcategory', '');
                    setAttributeValues({});
                  }}
                  className={inputClass()}
                >
                  {productTypeOptions.map((option) => (
                    <option key={valueOf(option)} value={valueOf(option)}>
                      {labelOf(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</span>
                <select
                  value={form.category}
                  onChange={(event) => {
                    updateForm('category', event.target.value);
                    setAttributeValues({});
                  }}
                  className={inputClass()}
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((option) => (
                    <option key={valueOf(option)} value={valueOf(option)}>
                      {labelOf(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subcategory</span>
                <input
                  value={form.subcategory}
                  onChange={(event) => updateForm('subcategory', event.target.value)}
                  className={inputClass()}
                  placeholder="e.g. Vitamin C, Water bottles"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Barcode / NAPPI / local code</span>
                <input
                  value={form.barcode}
                  onChange={(event) => updateForm('barcode', event.target.value)}
                  className={inputClass()}
                  placeholder="Barcode, NAPPI, RxNorm or local code"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Brand</span>
                <input
                  value={form.brand}
                  onChange={(event) => updateForm('brand', event.target.value)}
                  className={inputClass()}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manufacturer</span>
                <input
                  value={form.manufacturer}
                  onChange={(event) => updateForm('manufacturer', event.target.value)}
                  className={inputClass()}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pack size</span>
                <input
                  value={form.packSize}
                  onChange={(event) => updateForm('packSize', event.target.value)}
                  className={inputClass()}
                  placeholder="30 tablets, 750ml, 1 unit"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variant group</span>
                <input
                  value={form.variantGroupKey}
                  onChange={(event) => updateForm('variantGroupKey', event.target.value)}
                  className={inputClass()}
                  placeholder="Shared key for product variants"
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Variant name</span>
                <input
                  value={form.variantName}
                  onChange={(event) => updateForm('variantName', event.target.value)}
                  className={inputClass()}
                  placeholder="Orange 500mg 30 tablets"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock on hand</span>
                <input
                  type="number"
                  value={form.stockOnHand}
                  onChange={(event) => updateForm('stockOnHand', event.target.value)}
                  className={inputClass()}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Low stock threshold</span>
                <input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(event) => updateForm('lowStockThreshold', event.target.value)}
                  className={inputClass()}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max order quantity</span>
                <input
                  type="number"
                  value={form.maxOrderQty}
                  onChange={(event) => updateForm('maxOrderQty', event.target.value)}
                  className={inputClass()}
                />
              </label>

              <label className="space-y-1 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  className={inputClass('min-h-[88px]')}
                  placeholder="Internal product description"
                />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-900">Taxonomy attributes</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Standard options are available through dropdown suggestions where the taxonomy defines them. Custom values are accepted
                and will be sent to catalogue governance for normalisation.
              </p>

              {selectedAttributeKeys.length ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {selectedAttributeKeys.map((key) => {
                    const template = taxonomy?.attributeTemplates?.[key] || {};
                    const options = normaliseOptionList(taxonomy?.standardOptions?.[key] || template.standardOptions || template.options);
                    const listId = 'taxonomy-' + key;

                    return (
                      <label key={key} className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {labelOf(template) || pretty(key)}
                        </span>
                        <input
                          list={options.length ? listId : undefined}
                          value={attributeValues[key] || ''}
                          onChange={(event) => setAttribute(key, event.target.value)}
                          className={inputClass()}
                          placeholder="Standard or custom value"
                        />
                        {options.length > 0 && (
                          <datalist id={listId}>
                            {options.map((option) => (
                              <option key={valueOf(option)} value={valueOf(option)}>
                                {labelOf(option)}
                              </option>
                            ))}
                          </datalist>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                  Select a category to display recommended taxonomy attributes. You can still add custom JSON attributes below.
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extra variant attributes JSON</span>
                <textarea
                  value={form.variantAttributesJson}
                  onChange={(event) => updateForm('variantAttributesJson', event.target.value)}
                  className={inputClass('min-h-[120px] font-mono')}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metadata attributes JSON</span>
                <textarea
                  value={form.attributesJson}
                  onChange={(event) => updateForm('attributesJson', event.target.value)}
                  className={inputClass('min-h-[120px] font-mono')}
                />
              </label>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[
                ['OTC item', 'otc'],
                ['Prescription required', 'prescriptionRequired'],
                ['Visible in marketplace', 'marketplaceVisible'],
                ['Sellable online', 'sellableOnline'],
                ['Age restricted', 'ageRestricted'],
              ].map(([label, key]) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form[key as keyof FormState])}
                    onChange={(event) => updateForm(key as keyof FormState, event.target.checked as any)}
                    className={checkboxClass()}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </form>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">CSV import</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Paste pharmacy CSV rows using the CarePort taxonomy headers. Rows are normalised at import time and routed to the
                governance queue when custom or risky values are detected.
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended headers</div>
                <div className="mt-2 break-words font-mono text-xs text-slate-700">{csvHeaders}</div>
              </div>

              <textarea
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                className={inputClass('mt-4 min-h-[260px] font-mono')}
              />

              <button
                type="button"
                onClick={importCsv}
                disabled={busy || loading || !selectedPharmacyId}
                className="mt-4 rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Importing…' : 'Import CSV'}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">Inventory governance status</h2>
              <p className="mt-1 text-sm text-slate-600">
                Last loaded items for the selected pharmacy, including normalisation and marketplace safety flags.
              </p>

              <div className="mt-5 space-y-3">
                {items.length ? (
                  items.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={'rounded-full border px-3 py-1 text-xs font-semibold ' + statusClass(item)}>
                          {item.reviewRequired ? 'Needs review · ' : ''}{pretty(item.normalisationStatus || 'Raw pharmacy supplied')}
                        </span>
                        {item.prescriptionRequired && (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                            Prescription required
                          </span>
                        )}
                        {item.marketplaceVisible && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            Marketplace visible
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 font-bold text-slate-950">{item.name || 'Unnamed SKU'}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {pretty(item.productType || 'Unclassified')} · {item.category || 'No category'}{item.subcategory ? ` · ${item.subcategory}` : ''} · {money(item.priceCents, item.currency || 'ZAR')}
                      </p>

                      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">SKU / barcode</dt>
                          <dd className="mt-1 font-mono text-xs text-slate-900">{item.skuCode || item.barcode || item.drugCode || '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock</dt>
                          <dd className="mt-1 text-slate-900">{Number(item.stockOnHand || 0)} on hand · {Number(item.reservedStock || 0)} reserved</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Canonical name</dt>
                          <dd className="mt-1 text-slate-900">{item.canonicalName || 'Pending'}</dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global key</dt>
                          <dd className="mt-1 font-mono text-xs text-slate-900">{item.globalProductKey || 'Pending'}</dd>
                        </div>
                      </dl>

                      {item.reviewReason && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          {item.reviewReason}
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                    {loading ? 'Loading inventory…' : 'No inventory items loaded for this pharmacy yet.'}
                  </div>
                )}
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
