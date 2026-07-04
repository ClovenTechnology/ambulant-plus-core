// apps/clinician-app/src/hooks/useAutocomplete.ts
'use client';

import { useEffect, useState } from 'react';

export type ICD10Hit = {
  code: string;
  title: string;
  score?: number;
  [key: string]: any;
};

export type RxNormHit = {
  rxcui?: string;
  rxCui?: string;
  code?: string;
  system?: string;
  name: string;
  title?: string;
  label?: string;
  tty?: string;
  generic?: boolean;
  source?: string;
  codes?: Array<{ system?: string; code?: string; display?: string }>;
  [key: string]: any;
};

export type MedicineHit = RxNormHit & {
  id?: string;
  aliases?: string[];
  country?: string;
};

export type LabTestHit = {
  id: string;
  code?: string;
  codeSystem?: string;
  name: string;
  label?: string;
  aliases?: string[];
  category?: string;
  specimen?: string;
  source?: string;
  [key: string]: any;
};

type Searcher<T> = (q: string) => Promise<T[]>;

export function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);

  return v;
}

export function useAutocomplete<T>(
  searcher: Searcher<T>,
  optionsOrMin: number | { min?: number; delay?: number } = 2,
  maybeDelayMs = 250,
) {
  const minLength = typeof optionsOrMin === 'number' ? optionsOrMin : optionsOrMin.min ?? 2;
  const delayMs = typeof optionsOrMin === 'number' ? maybeDelayMs : optionsOrMin.delay ?? 250;

  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();

    if (term.length < minLength) {
      setOpts([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const rows = await searcher(term);
        if (active) setOpts(Array.isArray(rows) ? rows : []);
      } catch (err: any) {
        if (active) {
          setOpts([]);
          setError(err?.message || 'Search unavailable');
        }
      } finally {
        if (active) setLoading(false);
      }
    }, delayMs);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [q, searcher, minLength, delayMs]);

  return {
    q,
    setQ,
    opts,
    setOpts,
    loading,
    busy: loading,
    error,
    clear: () => {
      setQ('');
      setOpts([]);
      setError(null);
    },
  };
}

function rowsFromPayload(json: any) {
  return Array.isArray(json)
    ? json
    : Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.results)
        ? json.results
        : Array.isArray(json?.data)
          ? json.data
          : [];
}

async function fetchJsonRows(path: string) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) return [];

  const json = await res.json().catch(() => null);
  if (json?.ok === false) return [];

  return rowsFromPayload(json);
}

export async function icdSearch(q: string): Promise<ICD10Hit[]> {
  const rows = await fetchJsonRows('/api/codes/icd10?q=' + encodeURIComponent(q) + '&limit=25');

  return rows
    .map((row: any) => ({
      ...row,
      code: String(row?.code || '').trim(),
      title: String(row?.title || row?.description || row?.name || '').trim(),
    }))
    .filter((row: ICD10Hit) => row.code || row.title);
}

export async function rxnormSearch(q: string): Promise<RxNormHit[]> {
  const rows = await fetchJsonRows(
    '/api/codes/medicines?q=' + encodeURIComponent(q) + '&limit=25&includeRxNorm=1',
  );

  return rows
    .map((row: any) => {
      const codes = Array.isArray(row?.codes) ? row.codes : [];
      const rx = codes.find((c: any) => String(c?.system || '').toLowerCase() === 'rxnorm');
      const primary = codes[0] || {};
      const name = String(row?.name || row?.label || row?.title || row?.display || primary?.display || '').trim();
      const code = String(rx?.code || row?.rxcui || row?.rxCui || row?.code || primary?.code || '').trim();

      return {
        ...row,
        name,
        title: row?.title || name,
        label: row?.label || name,
        rxcui: rx?.code || (String(row?.system || row?.codeSystem || '').toLowerCase() === 'rxnorm' ? code : undefined),
        code,
        system: rx ? 'rxnorm' : String(row?.system || row?.codeSystem || primary?.system || 'local_sa'),
        codes,
      };
    })
    .filter((row: RxNormHit) => row.name);
}

export const medicineSearch = rxnormSearch;

export async function labTestSearch(q: string): Promise<LabTestHit[]> {
  const rows = await fetchJsonRows('/api/codes/labs?q=' + encodeURIComponent(q) + '&limit=25');

  return rows
    .map((row: any) => ({
      ...row,
      id: String(row?.id || row?.code || row?.name || '').trim(),
      code: String(row?.code || row?.id || '').trim(),
      codeSystem: String(row?.codeSystem || 'local_sa_lab_catalog'),
      name: String(row?.name || row?.label || row?.title || '').trim(),
      label: String(row?.label || row?.name || row?.title || '').trim(),
      category: row?.category,
      specimen: row?.specimen,
    }))
    .filter((row: LabTestHit) => row.name);
}

export async function sigSearch(rxcui: string): Promise<string[]> {
  if (!rxcui) return [];

  const rows = await fetchJsonRows('/api/codes/sigs?rxCui=' + encodeURIComponent(rxcui));

  return rows
    .map((row: any) => String(row?.sig || row?.text || row?.label || row).trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function sigsForRxCui(rxCui?: string | null): Promise<string[]> {
  return sigSearch(String(rxCui || '').trim());
}

export const sigsSearch = sigSearch;
export const getSigSuggestions = sigSearch;
export const sigSuggestionsFor = sigSearch;
