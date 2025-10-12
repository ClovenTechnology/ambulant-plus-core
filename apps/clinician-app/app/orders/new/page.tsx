// apps/clinician-app/app/orders/new/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCombobox } from 'downshift';
import { useAutocomplete, rxnormSearch } from '@/src/hooks/useAutocomplete';
import type { RxNormHit } from '@/src/hooks/useAutocomplete';

type ErxItem = {
  id: string;
  drugName: string;
  rxCui?: string | null;
  dose?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: string;
  refills?: number;
  notes?: string;
};

function makeId(prefix = 'i') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/* Small presentational sig pill */
function SigPill({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200"
    >
      {text}
    </button>
  );
}

export default function NewOrderPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const urlEncounter = useMemo(() => sp.get('encounterId') || sp.get('encId') || '', [sp]);

  // allow user to edit or type an encounterId (fallback to url param)
  const [encounterId, setEncounterId] = useState<string>(urlEncounter || '');
  const [encInput, setEncInput] = useState<string>(urlEncounter || '');

  const [tab, setTab] = useState<'erx' | 'lab'>('erx');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // rxnorm autocomplete hook (client wrapper)
  const drugAuto = useAutocomplete<RxNormHit>(rxnormSearch);

  // items state
  const [items, setItems] = useState<ErxItem[]>(() => [
    { id: makeId('item'), drugName: '', rxCui: null, dose: '', route: '', frequency: '', duration: '', quantity: '', refills: 0, notes: '' },
  ]);

  const storageKey = useMemo(() => `erx-composer:${encounterId || 'ad-hoc'}`, [encounterId]);

  // load draft when encounterId changes or on mount (try URL first)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: ErxItem[]; tab?: 'erx' | 'lab' };
        if (parsed.items && Array.isArray(parsed.items) && parsed.items.length) setItems(parsed.items);
        if (parsed.tab) setTab(parsed.tab);
      }
    } catch {}
  }, [storageKey]);

  // autosave
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ items, tab }));
      } catch {}
    }, 400);
    return () => window.clearTimeout(t);
  }, [items, tab, storageKey]);

  const updateItem = useCallback((id: string, patch: Partial<ErxItem>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { id: makeId('item'), drugName: '', rxCui: null, dose: '', route: '', frequency: '', duration: '', quantity: '', refills: 0, notes: '' },
    ]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((p) => p.id !== id)));
  }, []);

  // sig suggestions by rxCUI
  const [sigMap, setSigMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const cuis = Array.from(new Set(items.map((i) => i.rxCui).filter(Boolean) as string[]));
    cuis.forEach((cui) => {
      if (sigMap[cui]) return;
      (async () => {
        try {
          const r = await fetch(`/api/codes/sigs?rxCui=${encodeURIComponent(cui)}`, { cache: 'no-store' });
          if (r.ok) {
            const js = await r.json();
            if (Array.isArray(js.items)) {
              setSigMap((s) => ({ ...s, [cui]: js.items }));
              return;
            }
          }
        } catch {
          // ignore
        }
        setSigMap((s) => ({ ...s, [cui]: ['1 tab nocte', '1 tab bd', '5 ml bd x5d'] }));
      })();
    });
  }, [items, sigMap]);

  // Build items list for POST
  const buildItemsForPost = useCallback(() => items.map(it => ({
    drugName: it.drugName || '',
    dose: it.dose || undefined,
    route: it.route || undefined,
    frequency: it.frequency || undefined,
    duration: it.duration || undefined,
    quantity: it.quantity || undefined,
    refills: typeof it.refills === 'number' ? it.refills : 0,
    notes: it.notes || undefined,
    rxCui: it.rxCui || undefined,
  })), [items]);

  // submission: use env base if present (helps when gateway on different host)
  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    if (!encounterId) {
      setErr('Missing encounterId — please enter one or add ?encounterId=... to the URL.');
      setBusy(false);
      return;
    }
    try {
      const body = { appointmentId: encounterId, items: buildItemsForPost() };
      const base = (process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || '').replace(/\/$/, '');
      const url = base ? `${base}/api/erx` : '/api/erx';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        throw new Error(`HTTP ${r.status} ${txt}`);
      }
      // clear draft and redirect to case view
      try { localStorage.removeItem(storageKey); } catch {}
      router.push(`/cases/${encodeURIComponent(encounterId)}`);
    } catch (e: any) {
      setErr(e?.message || 'Failed to create order');
    } finally {
      setBusy(false);
    }
  }, [encounterId, buildItemsForPost, router, storageKey]);

  // Common lab panels
  const COMMON_PANELS = useMemo(() => [
    { id: 'CBC', title: 'CBC', details: 'Full blood count (Hb, WCC, platelets)' },
    { id: 'LIPID', title: 'Lipid panel', details: 'Total cholesterol, HDL, LDL, TG' },
    { id: 'LFT', title: 'Liver function tests (LFT)', details: 'AST, ALT, ALP, bilirubin' },
    { id: 'RFT', title: 'Renal function tests (RFT)', details: 'Urea, creatinine, electrolytes' },
    { id: 'HBA1C', title: 'HbA1c', details: 'Glycemic control' },
  ], []);

  /* -------------------------
     Per-row Downshift combobox
     ------------------------- */
  function DrugCombobox({ row }: { row: ErxItem }) {
    // items list derived from drugAuto.opts (names)
    const options = useMemo(() => {
      if (drugAuto.opts && drugAuto.opts.length) return drugAuto.opts.map(h => ({ label: h.name, rxcui: h.rxcui }));
      return [{ label: 'Atorvastatin 20mg', rxcui: '1049630' }];
    }, [drugAuto.opts]);

    const itemsList = options.map(o => o.label);

    const {
      isOpen,
      getMenuProps,
      getInputProps,
      getItemProps,
      highlightedIndex,
      // we won't use getComboboxProps (some downshift versions don't expose it)
    } = useCombobox({
      items: itemsList,
      inputValue: row.drugName || '',
      onInputValueChange: ({ inputValue }) => {
        // update local row value and also kick off remote search
        if (typeof inputValue === 'string') {
          updateItem(row.id, { drugName: inputValue, rxCui: null });
          drugAuto.setQ(inputValue);
        }
      },
      onSelectedItemChange: ({ selectedItem }) => {
        if (!selectedItem) return;
        const hit = drugAuto.opts.find(h => h.name === selectedItem) || null;
        updateItem(row.id, { drugName: selectedItem, rxCui: hit ? hit.rxcui : null });
      },
      itemToString: (i: any) => i ?? '',
    });

    return (
      <div className="relative">
        <input
          {...getInputProps({
            placeholder: 'Type drug name…',
            className: 'w-full border rounded px-2 py-1',
            onFocus: () => { /* no-op */ },
          })}
        />
        <ul {...getMenuProps()} className={`absolute z-40 mt-1 w-full max-h-56 overflow-auto rounded border bg-white ${isOpen && itemsList.length ? '' : 'hidden'}`}>
          {itemsList.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">No results</li>
          ) : (
            itemsList.map((label, index) => (
              <li
                key={`${label}-${index}`}
                {...getItemProps({ item: label, index })}
                className={`px-3 py-2 text-sm cursor-pointer ${highlightedIndex === index ? 'bg-gray-100' : ''}`}
                onClick={() => {
                  // selecting via onSelectedItemChange will handle rxCUI assignment
                }}
              >
                {label}
              </li>
            ))
          )}
        </ul>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-xl font-semibold">New Order</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
        <div className="col-span-2">
          <div className="text-sm text-gray-600">Encounter / Case ID</div>
          <input
            className="w-full border rounded px-2 py-1"
            placeholder="Enter encounterId (or leave blank for ad-hoc)"
            value={encInput}
            onChange={(e) => setEncInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEncounterId(encInput.trim()); }}
          />
        </div>
        <div className="flex gap-2 items-end">
          <button
            className="px-3 py-1 rounded border bg-white"
            onClick={() => { setEncInput(''); setEncounterId(''); }}
          >
            Clear
          </button>
          <button
            className="px-3 py-1.5 rounded bg-emerald-600 text-white"
            onClick={() => setEncounterId(encInput.trim())}
          >
            Use ID
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-500">Active encounter: <code>{encounterId || 'ad-hoc'}</code></div>

      <div className="flex gap-2">
        <button onClick={() => setTab('erx')} className={`px-3 py-1 rounded border ${tab === 'erx' ? 'bg-gray-900 text-white' : 'bg-white'}`}>Pharmacy (eRx)</button>
        <button onClick={() => setTab('lab')} className={`px-3 py-1 rounded border ${tab === 'lab' ? 'bg-gray-900 text-white' : 'bg-white'}`}>Lab</button>
      </div>

      {tab === 'erx' ? (
        <section className="space-y-4 border rounded p-4 bg-white">
          {items.map((it, idx) => {
            const sigs = it.rxCui ? (sigMap[it.rxCui] || []) : [];
            return (
              <div key={it.id} className="border rounded p-3 bg-gray-50">
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600">Drug</label>
                    <DrugCombobox row={it} />
                    {it.rxCui && <div className="text-[11px] text-gray-600 mt-1">RxCUI: <span className="font-mono">{it.rxCui}</span></div>}
                  </div>

                  <div className="w-36">
                    <label className="text-xs text-gray-600">Dose</label>
                    <input className="w-full border rounded px-2 py-1" value={it.dose || ''} onChange={(e) => updateItem(it.id, { dose: e.target.value })} placeholder="e.g. 500 mg" />
                  </div>

                  <div className="w-36">
                    <label className="text-xs text-gray-600">Route</label>
                    <input className="w-full border rounded px-2 py-1" value={it.route || ''} onChange={(e) => updateItem(it.id, { route: e.target.value })} placeholder="PO / IM / Topical" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3">
                  <input className="border rounded px-2 py-1" placeholder="Frequency (e.g. BD)" value={it.frequency || ''} onChange={(e) => updateItem(it.id, { frequency: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Duration (e.g. x5d)" value={it.duration || ''} onChange={(e) => updateItem(it.id, { duration: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Quantity" value={it.quantity || ''} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                  <input type="number" min={0} className="border rounded px-2 py-1" placeholder="Refills" value={it.refills ?? 0} onChange={(e) => updateItem(it.id, { refills: Number(e.target.value || 0) })} />
                </div>

                <div className="mt-3">
                  <label className="text-xs text-gray-600">Sig / Notes</label>
                  <input className="w-full border rounded px-2 py-1" value={it.notes || ''} onChange={(e) => updateItem(it.id, { notes: e.target.value })} placeholder="e.g. 1 tab nocte" />
                  <div className="flex gap-2 flex-wrap mt-2">
                    {(sigs.length ? sigs : ['1 tab nocte', '1 tab bd', '5 ml bd x5d']).map((s) => (
                      <SigPill key={s} text={s} onClick={() => updateItem(it.id, { notes: s })} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => removeItem(it.id)} disabled={items.length === 1} className="px-3 py-1 rounded border bg-white">Remove</button>
                  <button type="button" onClick={() => setItems((p) => [...p, { ...it, id: makeId('dup') }])} className="px-3 py-1 rounded border bg-white">Duplicate</button>
                  <div className="ml-auto text-xs text-gray-500">Row {idx + 1}</div>
                </div>
              </div>
            );
          })}

          <div className="flex gap-2">
            <button onClick={addItem} className="px-3 py-1 rounded border bg-white">Add medication</button>
            <div className="flex-1" />
            <div className="text-xs text-gray-500">Draft autosaved</div>
          </div>
        </section>
      ) : (
        <section className="space-y-2 border rounded p-3 bg-white">
          <div>
            <label className="text-xs text-gray-600 block">Choose panel</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {COMMON_PANELS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setItems([{ id: makeId('lab'), drugName: p.id, notes: p.details }])}
                  className="text-left border rounded p-2 hover:bg-gray-50"
                >
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-gray-600">{p.details}</div>
                </button>
              ))}
            </div>

            <div className="mt-2">
              <label className="text-xs text-gray-600">Panel code / custom</label>
              <input className="w-full border rounded px-2 py-1" value={items[0]?.drugName || ''} onChange={(e) => updateItem(items[0].id, { drugName: e.target.value })} />
            </div>
          </div>
        </section>
      )}

      {err && <div className="text-sm text-rose-600">{err}</div>}

      <div className="flex gap-2">
        <button disabled={busy} onClick={submit} className="px-3 py-1.5 rounded bg-indigo-600 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create'}</button>
        <button onClick={() => history.back()} className="px-3 py-1.5 rounded border bg-white">Cancel</button>
      </div>
    </main>
  );
}
