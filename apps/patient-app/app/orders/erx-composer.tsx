'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '../../components/toast';

type Allergy = {
  id: string;
  substance: string;
  reaction: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active' | 'Resolved';
  notedAt: string;
};

type DrugSuggestion = {
  label: string;
  code?: string;
  system?: string;
  tty?: string;
  synonym?: string;
  raw?: unknown;
};

type RxDraft = {
  drug: string;
  sig: string;
  qty: string;
  refills: string;
  notes?: string;
  coding?: Array<{ system: string; code: string; display: string }>;
};

function cleanString(value: unknown) {
  return String(value ?? '').trim();
}

function suggestionLabel(row: any) {
  return (
    cleanString(row?.label) ||
    cleanString(row?.display) ||
    cleanString(row?.name) ||
    cleanString(row?.term) ||
    cleanString(row?.str) ||
    cleanString(row?.drug) ||
    cleanString(row?.rxcui)
  );
}

function suggestionCode(row: any) {
  return (
    cleanString(row?.rxcui) ||
    cleanString(row?.rxCui) ||
    cleanString(row?.code) ||
    cleanString(row?.id)
  );
}

function suggestionSystem(row: any) {
  return cleanString(row?.system) || 'rxnorm';
}

function normalizeSuggestion(row: any): DrugSuggestion | null {
  const label = suggestionLabel(row);
  if (!label) return null;

  return {
    label,
    code: suggestionCode(row) || undefined,
    system: suggestionSystem(row),
    tty: cleanString(row?.tty) || undefined,
    synonym: cleanString(row?.synonym) || undefined,
    raw: row,
  };
}

function normalizeSuggestionPayload(json: any): DrugSuggestion[] {
  const rows = Array.isArray(json)
    ? json
    : Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.results)
        ? json.results
        : Array.isArray(json?.data)
          ? json.data
          : [];

  const seen = new Set<string>();

  return rows
    .map(normalizeSuggestion)
    .filter((item): item is DrugSuggestion => Boolean(item))
    .filter((item) => {
      const key = `${item.system}:${item.code || item.label}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export default function ErxComposer() {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [choices, setChoices] = useState<DrugSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [draft, setDraft] = useState<RxDraft>({
    drug: '',
    sig: '',
    qty: '',
    refills: '0',
    notes: '',
    coding: [],
  });

  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [loadingAllergies, setLoadingAllergies] = useState(true);

  useEffect(() => {
    let abort = false;

    (async () => {
      try {
        const r = await fetch('/api/allergies', { cache: 'no-store' });
        const j: Allergy[] = await r.json();
        if (!abort) setAllergies(Array.isArray(j) ? j : []);
      } catch {
        if (!abort) setAllergies([]);
      } finally {
        if (!abort) setLoadingAllergies(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, []);

  useEffect(() => {
    const term = q.trim();

    if (term.length < 2) {
      setChoices([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams({
          q: term,
          limit: '10',
          preferGeneric: 'true',
        });

        const res = await fetch(`/api/codes/rxnorm?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || `RxNorm search failed (${res.status})`);
        }

        setChoices(normalizeSuggestionPayload(json));
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setChoices([]);
        setSearchError(err?.message || 'Medicine search unavailable');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const allergyHits = useMemo(() => {
    const name = (draft.drug || '').toLowerCase();
    if (!name) return [] as Allergy[];

    return allergies
      .filter((a) => a.status === 'Active')
      .filter((a) => name.includes(a.substance.toLowerCase()));
  }, [draft.drug, allergies]);

  const canSubmit =
    draft.drug.trim() && draft.sig.trim() && draft.qty.trim() && draft.refills.trim();

  const submit = async () => {
    if (!canSubmit) {
      toast('Please complete drug, SIG, quantity and refills', { type: 'error' });
      return;
    }

    if (allergyHits.length > 0) {
      const names = allergyHits.map((a) => a.substance).join(', ');
      const ok = confirm(
        `Possible drug-allergy match with: ${names}.\n\nContinue and submit anyway?`,
      );
      if (!ok) return;
    }

    try {
      const body = {
        rx: {
          drug: draft.drug.trim(),
          sig: draft.sig.trim(),
          qty: draft.qty.trim(),
          refills: Number(draft.refills) || 0,
          notes: draft.notes?.trim() || undefined,
          coding: draft.coding?.length ? draft.coding : undefined,
        },
      };

      const res = await fetch('/api/erx', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Could not submit eRx');
      }

      toast('eRx queued successfully', { type: 'success' });
      setTimeout(() => router.push('/orders/print'), 250);
    } catch (e: any) {
      toast(e?.message ?? 'Could not submit eRx', { type: 'error' });
    }
  };

  return (
    <section className="p-4 border rounded-lg bg-white space-y-4">
      <h2 className="font-semibold">eRx Composer</h2>

      <div className="space-y-2">
        <label className="text-xs text-gray-600">Find Medicine</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search formulary..."
          className="w-full border rounded p-2"
          autoComplete="off"
        />

        {q.trim().length >= 2 && (
          <ul className="border rounded divide-y max-h-48 overflow-auto">
            {searching ? (
              <li className="p-2 text-sm text-gray-500">Searching medicines...</li>
            ) : searchError ? (
              <li className="p-2 text-sm text-rose-600">{searchError}</li>
            ) : choices.length === 0 ? (
              <li className="p-2 text-sm text-gray-500">No matches</li>
            ) : (
              choices.map((choice) => (
                <li key={`${choice.system}:${choice.code || choice.label}`}>
                  <button
                    type="button"
                    className="w-full text-left p-2 hover:bg-gray-50 text-sm"
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        drug: choice.label,
                        coding: choice.code
                          ? [
                              {
                                system: choice.system || 'rxnorm',
                                code: choice.code,
                                display: choice.label,
                              },
                            ]
                          : [],
                      }));
                      setQ('');
                      setChoices([]);
                    }}
                  >
                    <span className="block font-medium">{choice.label}</span>
                    {choice.code ? (
                      <span className="block text-xs text-gray-500">
                        {(choice.system || 'rxnorm').toUpperCase()} {choice.code}
                        {choice.tty ? ` · ${choice.tty}` : ''}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Selected Drug</label>
          <input
            value={draft.drug}
            onChange={(e) =>
              setDraft((d) => ({ ...d, drug: e.target.value, coding: [] }))
            }
            className="w-full border rounded p-2"
            placeholder="e.g. Amoxicillin 500 mg capsule"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">SIG (directions)</label>
          <input
            value={draft.sig}
            onChange={(e) => setDraft((d) => ({ ...d, sig: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="e.g. 1 cap PO TID x 7 days"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Quantity</label>
          <input
            value={draft.qty}
            onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="e.g. 21"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-600">Refills</label>
          <input
            value={draft.refills}
            onChange={(e) => setDraft((d) => ({ ...d, refills: e.target.value }))}
            className="w-full border rounded p-2"
            placeholder="0"
            inputMode="numeric"
          />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs text-gray-600">Notes (optional)</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            className="w-full border rounded p-2 min-h-[80px]"
            placeholder="Pharmacy instructions or clinical note..."
          />
        </div>
      </div>

      <div className="text-xs">
        {loadingAllergies ? (
          <span className="text-gray-500">Checking allergies...</span>
        ) : allergyHits.length > 0 ? (
          <span className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200">
            ⚠ Possible allergy match: {allergyHits.map((a) => a.substance).join(', ')}
          </span>
        ) : (
          <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            ✓ No active allergy match detected
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={submit}
          className="px-3 py-2 border rounded bg-black text-white hover:opacity-90"
          disabled={!canSubmit}
        >
          Submit eRx
        </button>
        <button
          onClick={() => {
            setDraft({ drug: '', sig: '', qty: '', refills: '0', notes: '', coding: [] });
            setQ('');
            setChoices([]);
            setSearchError(null);
          }}
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </section>
  );
}
